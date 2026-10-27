import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Clock, EventBus, PlayerLocks, RandomSource, UnitOfWork } from '../../../shared/application/ports';
import { NotFound, RuleViolation, Unavailable } from '../../../shared/domain/errors';
import { startOfZonedDay } from '../../../shared/domain/zoned-time';
import { economyConfig } from '../../../config';
import { rollRarity } from '../../catalog/domain/rarity';
import { CardsService } from '../../collection/application/cards.service';
import { WalletService } from '../../wallet/application/wallet.service';
import { GameRoundPlayed } from '../domain/events';
import { GAME_TYPES, GameType } from '../domain/game-rules';
import { GameSession } from '../domain/game-session';
import { GameSessionRepository, QuestionFactory } from '../domain/ports';
import { Door } from '../domain/rounds';
import { ABANDON_AFTER_MS, GAMES } from './games.config';

@Injectable()
export class GamesService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
    private readonly sessions: GameSessionRepository,
    private readonly questions: QuestionFactory,
    private readonly wallet: WalletService,
    private readonly cards: CardsService,
    private readonly events: EventBus,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  private dayStart(now: Date) {
    return startOfZonedDay(now, economyConfig.timezone);
  }

  /** Une partie par jeu et par jour au plus : la manche de départ est tirée ici, jamais par le client. */
  start(userId: string, type: GameType) {
    return this.uow.run(async () => {
      await this.locks.lock(userId);
      const now = this.clock.now();
      // Une partie en cours de ce jeu est reprise plutôt que d'en commencer une nouvelle.
      const active = await this.sessions.findActive(userId, type);
      if (active && !active.isStale(now, ABANDON_AFTER_MS)) return active.view();
      if (active) {
        active.finish(now);
        await this.sessions.save(active);
      }

      const played = await this.sessions.countStartedSince(userId, type, this.dayStart(now));
      if (played >= GAMES[type].playsPerDay) throw new RuleViolation('Plus de partie disponible aujourd’hui pour ce jeu : revenez demain !');

      const first = await this.questions.make(type, []);
      if (!first) throw new Unavailable('Pas assez de cartes dans le catalogue pour ce jeu');
      const session = GameSession.start({ id: randomUUID(), userId, type, def: GAMES[type], first, now });
      await this.sessions.create(session);
      return session.view();
    });
  }

  async get(userId: string, id: string) {
    const session = await this.sessions.find(id, userId);
    if (!session) throw new NotFound('Partie introuvable');
    return session.view();
  }

  /**
   * Répond à la manche en cours. Le serveur juge la réponse avec la manche qu'il a gardée,
   * verse les gains et prépare la manche suivante. Une seule réponse par manche (verrous).
   */
  answer(userId: string, id: string, choice: unknown) {
    return this.uow.run(async () => {
      // Ordre des verrous : joueur puis partie, comme au démarrage (pas d'interblocage).
      await this.locks.lock(userId);
      const session = await this.sessions.getForUpdate(id, userId);
      if (!session) throw new NotFound('Partie introuvable');
      const now = this.clock.now();
      const outcome = session.answer(choice);

      if (outcome.gained) await this.wallet.credit(userId, outcome.gained, session.type === 'DUEL' ? 'game:duel' : 'game:quiz', session.id);
      let prize: { carId: number; quantity: number; isNew: boolean } | null = null;
      if (outcome.prizeCarId) {
        prize = { carId: outcome.prizeCarId, ...(await this.cards.grant(userId, outcome.prizeCarId)) };
        await this.sessions.addPlayerCounters(userId, { gameCardsWon: 1, doorsJackpots: outcome.jackpot ? 1 : 0 });
      }

      session.continueWith(outcome.continues ? await this.questions.make(session.type, session.usedCars) : null, now);

      let bonus: { carId: number; quantity: number; isNew: boolean } | null = null;
      if (session.earnedPerfectBonus) {
        // Sans-faute : une carte bonus (peu commune ou mieux).
        const car = await this.cards.draw(rollRarity(true, () => this.random.next()));
        bonus = { carId: car.id, ...(await this.cards.grant(userId, car.id)) };
        session.setBonusCard(car.id);
        await this.sessions.addPlayerCounters(userId, { gameCardsWon: 1 });
      }
      if (session.finished) await this.sessions.addPlayerCounters(userId, { gamesPlayed: 1 });
      await this.sessions.save(session);
      await this.events.publish(new GameRoundPlayed(userId, session.id, session.finished));

      const view = session.view();
      return {
        correct: outcome.correct,
        answer: outcome.round.kind === 'doors' ? null : outcome.round.answer,
        reveal: 'reveal' in outcome.round ? outcome.round.reveal : null,
        doors: outcome.round.kind === 'doors' ? (outcome.round.outcomes as Door[]) : null,
        prize,
        bonus,
        gained: outcome.gained,
        balance: await this.wallet.balance(userId),
        session: view,
        finished: session.finished,
      };
    });
  }

  /** Jeux du jour : parties restantes, partie en cours, meilleur score. */
  async overview(userId: string) {
    const now = this.clock.now();
    const since = this.dayStart(now);
    const resetsAt = startOfZonedDay(new Date(since.getTime() + 26 * 3600 * 1000), economyConfig.timezone);
    const games = [];
    for (const type of GAME_TYPES) {
      const { choices: _choices, ...def } = GAMES[type];
      const [played, active, best] = await Promise.all([
        this.sessions.countStartedSince(userId, type, since),
        this.sessions.findActive(userId, type),
        this.sessions.bestScore(userId, type),
      ]);
      games.push({
        type,
        ...def,
        playsLeft: Math.max(0, def.playsPerDay - played),
        active: active && !active.isStale(now, ABANDON_AFTER_MS) ? active.id : null,
        bestScore: best,
      });
    }
    return { resetsAt: resetsAt.toISOString(), games };
  }
}
