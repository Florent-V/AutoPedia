import { legacyTransaction } from '../shared/infrastructure/prisma/legacy-transaction';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { GameSession, GameType, Prisma, Rarity } from '@prisma/client';
import { economyConfig } from '../config';
import { AchievementsService } from '../modules/progression/application/achievements.service';
import { CatalogReader } from '../modules/catalog/application/catalog-reader';
import { toCardDto } from '../modules/catalog/application/card-view';
import { addCard, lockPlayers, moveCredits } from '../economy/wallet';
import { rollRarity } from '../modules/catalog/domain/rarity';
import { startOfZonedDay } from '../shared/domain/zoned-time';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';
import { DuelRound, makeDuelRound, makeMysteryRound, makeQuizRound, makeWeightRound, MysteryRound, QuizRound, WeightRound } from './questions';

type Tx = Prisma.TransactionClient;

/** Contenu d'une porte des « 3 garages ». */
interface Door {
  tier: 'none' | 'standard' | 'top';
  carId: number | null;
}

interface DoorsRound {
  kind: 'doors';
  prompt: string;
  doors: number;
  outcomes: Door[];
}

type Round = (DuelRound | QuizRound | WeightRound | MysteryRound | DoorsRound) & {
  answer?: unknown;
  prizeCarId?: number;
};

interface SessionState {
  used: number[];
  current: Round | null;
  history: Array<{ correct: boolean }>;
}

export interface GameDef {
  name: string;
  description: string;
  rounds: number;
  /** Crédits par bonne réponse (jeux à crédits). */
  creditsPerWin: number;
  /** Parties par jour. */
  playsPerDay: number;
  /** « credits » : on gagne des crédits ; « card » : on remporte la carte en jeu. */
  reward: 'credits' | 'card';
  /** La partie s'arrête à la première erreur. */
  endsOnMistake: boolean;
  /** Carte bonus pour un sans-faute (jeux à crédits). */
  perfectBonus: boolean;
  /** Nombre de choix possibles (validation de la réponse). */
  choices: 'ab' | 3 | 4;
}

export const GAMES: Record<GameType, GameDef> = {
  DUEL: {
    name: 'Duel de stats',
    description:
      'Deux voitures, une question : laquelle est la plus rapide, la plus lourde, la plus ancienne… La partie s’arrête à la première erreur.',
    rounds: economyConfig.duelRounds,
    creditsPerWin: economyConfig.duelCreditsPerWin,
    playsPerDay: economyConfig.gamesPerDay,
    reward: 'credits',
    endsOnMistake: true,
    perfectBonus: true,
    choices: 'ab',
  },
  QUIZ: {
    name: 'Quiz auto',
    description: 'Cinq questions à 4 choix : marque, pays, décennie ou modèle en photo. Chaque bonne réponse rapporte des crédits.',
    rounds: economyConfig.quizQuestions,
    creditsPerWin: economyConfig.quizCreditsPerWin,
    playsPerDay: economyConfig.gamesPerDay,
    reward: 'credits',
    endsOnMistake: false,
    perfectBonus: true,
    choices: 4,
  },
  WEIGHT: {
    name: 'Poids lourds',
    description: 'Deux voitures s’affrontent sur la balance. Désignez la plus lourde et elle rejoint votre garage !',
    rounds: 1,
    creditsPerWin: 0,
    playsPerDay: economyConfig.quickGamesPerDay,
    reward: 'card',
    endsOnMistake: true,
    perfectBonus: false,
    choices: 'ab',
  },
  MYSTERY: {
    name: 'Question pour une carte',
    description: 'Une carte, une question, quatre réponses. Plus la carte est rare, plus la question est pointue. Bonne réponse = carte gagnée.',
    rounds: 1,
    creditsPerWin: 0,
    playsPerDay: economyConfig.quickGamesPerDay,
    reward: 'card',
    endsOnMistake: true,
    perfectBonus: false,
    choices: 4,
  },
  DOORS: {
    name: 'Les 3 garages',
    description: 'Trois portes fermées : un garage vide, une carte standard et une carte Épique ou Légendaire. À vous de choisir !',
    rounds: 1,
    creditsPerWin: 0,
    playsPerDay: economyConfig.doorsPerDay,
    reward: 'card',
    endsOnMistake: true,
    perfectBonus: false,
    choices: 3,
  },
};

/** Abandon automatique d'une partie restée ouverte. */
const ABANDON_AFTER_MS = 60 * 60 * 1000;

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogReader,
    private readonly achievements: AchievementsService,
  ) {}

  private dayStart(now = new Date()) {
    return startOfZonedDay(now, economyConfig.timezone);
  }

  async overview(userId: string) {
    const now = new Date();
    const since = this.dayStart(now);
    const sessions = await this.prisma.gameSession.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { id: true, type: true, status: true, score: true },
    });
    const best = await this.prisma.gameSession.groupBy({
      by: ['type'],
      where: { userId, status: 'FINISHED' },
      _max: { score: true },
    });
    // Minuit suivant dans le fuseau (robuste aux jours de 23 h / 25 h des changements d'heure).
    const resetsAt = startOfZonedDay(new Date(since.getTime() + 26 * 3600 * 1000), economyConfig.timezone);
    return {
      resetsAt: resetsAt.toISOString(),
      games: (Object.keys(GAMES) as GameType[]).map((type) => {
        const today = sessions.filter((s) => s.type === type);
        const { choices: _choices, ...def } = GAMES[type];
        return {
          type,
          ...def,
          playsLeft: Math.max(0, def.playsPerDay - today.length),
          active: today.find((s) => s.status === 'ACTIVE')?.id ?? null,
          bestScore: best.find((b) => b.type === type)?._max.score ?? 0,
        };
      }),
    };
  }

  async start(userId: string, type: GameType) {
    return legacyTransaction(
      async (tx) => {
        await lockPlayers(tx, userId);
        const now = new Date();
        // Une partie en cours de ce jeu est reprise plutôt que d'en commencer une nouvelle.
        const active = await tx.gameSession.findFirst({ where: { userId, type, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
        if (active && now.getTime() - active.createdAt.getTime() < ABANDON_AFTER_MS) return this.view(active);
        if (active) await tx.gameSession.update({ where: { id: active.id }, data: { status: 'FINISHED', finishedAt: now } });

        const playedToday = await tx.gameSession.count({ where: { userId, type, createdAt: { gte: this.dayStart(now) } } });
        if (playedToday >= GAMES[type].playsPerDay) {
          throw new ConflictException('Plus de partie disponible aujourd’hui pour ce jeu : revenez demain !');
        }

        const round = await this.makeRound(tx, type, []);
        if (!round) throw new ServiceUnavailableException('Pas assez de cartes dans le catalogue pour ce jeu');
        const state: SessionState = { used: this.usedBy(round), current: round, history: [] };
        const session = await tx.gameSession.create({
          data: { userId, type, state: state as unknown as Prisma.InputJsonValue, round: 1 },
        });
        return this.view(session);
      },
      { timeout: 15_000 },
    );
  }

  async get(userId: string, id: string) {
    const session = await this.prisma.gameSession.findFirst({ where: { id, userId } });
    if (!session) throw new NotFoundException('Partie introuvable');
    return this.view(session);
  }

  async answer(userId: string, id: string, choice: unknown) {
    return legacyTransaction(
      async (tx) => {
        // Verrou sur la partie : une seule réponse traitée par manche, même en cas de double clic.
        await tx.$queryRaw`SELECT 1 FROM "game_session" WHERE "id" = ${id} FOR UPDATE`;
        const session = await tx.gameSession.findFirst({ where: { id, userId } });
        if (!session) throw new NotFoundException('Partie introuvable');
        if (session.status !== 'ACTIVE') throw new ConflictException('Cette partie est terminée');
        const state = session.state as unknown as SessionState;
        const round = state.current;
        if (!round) throw new ConflictException('Aucune question en cours');

        const game = GAMES[session.type];
        const valid =
          game.choices === 'ab'
            ? choice === 'a' || choice === 'b'
            : Number.isInteger(choice) && (choice as number) >= 0 && (choice as number) < game.choices;
        if (!valid) throw new BadRequestException('Réponse invalide');

        await lockPlayers(tx, userId);

        // Résultat de la manche
        let correct: boolean;
        let prizeCarId: number | null = null;
        let jackpot = false;
        if ('outcomes' in round) {
          const door = round.outcomes[choice as number];
          correct = door.tier !== 'none';
          prizeCarId = door.carId;
          jackpot = door.tier === 'top';
        } else {
          correct = choice === round.answer;
          if (correct && game.reward === 'card') prizeCarId = round.prizeCarId ?? null;
        }

        const gained = correct ? game.creditsPerWin : 0;
        if (gained) await moveCredits(tx, userId, gained, `game:${session.type.toLowerCase()}`, session.id);

        let prize = null;
        if (prizeCarId) {
          const car = await tx.car.findUniqueOrThrow({ where: { id: prizeCarId } });
          const { quantity, isNew } = await addCard(tx, userId, car.id);
          prize = { ...toCardDto(car), quantity, isNew };
          await tx.player.update({
            where: { userId },
            data: { gameCardsWon: { increment: 1 }, ...(jackpot ? { doorsJackpots: { increment: 1 } } : {}) },
          });
        }

        const score = session.score + (correct ? 1 : 0);
        const history = [...state.history, { correct }];
        const ends = session.round >= game.rounds || (game.endsOnMistake && !correct);

        const next = ends ? null : await this.makeRound(tx, session.type, state.used);
        const finished = ends || !next;

        let rewardCard = null;
        if (finished && game.perfectBonus && score >= game.rounds) {
          // Sans-faute : une carte bonus (peu commune ou mieux).
          const car = await this.pickCar(tx, rollRarity(true), []);
          if (car) {
            const { quantity, isNew } = await addCard(tx, userId, car.id);
            rewardCard = { ...toCardDto(car), quantity, isNew };
            await tx.player.update({ where: { userId }, data: { gameCardsWon: { increment: 1 } } });
          }
        }
        if (finished) await tx.player.update({ where: { userId }, data: { gamesPlayed: { increment: 1 } } });

        const updated = await tx.gameSession.update({
          where: { id },
          data: {
            score,
            credits: { increment: gained },
            round: finished ? session.round : session.round + 1,
            status: finished ? 'FINISHED' : 'ACTIVE',
            finishedAt: finished ? new Date() : null,
            rewardCarId: rewardCard?.id ?? prize?.id ?? null,
            state: {
              used: next ? [...state.used, ...this.usedBy(next)] : state.used,
              current: next,
              history,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        const newAchievements = finished ? await this.achievements.evaluate(userId) : [];
        const balance = (await tx.player.findUniqueOrThrow({ where: { userId }, select: { credits: true } })).credits;

        return {
          correct,
          answer: 'outcomes' in round ? null : round.answer,
          reveal: 'reveal' in round ? round.reveal : null,
          doors: 'outcomes' in round ? await this.revealDoors(tx, round.outcomes) : null,
          prize,
          gained,
          balance,
          session: this.view(updated),
          summary: finished ? { score, credits: updated.credits, rewardCard, prize, newAchievements } : null,
        };
      },
      { timeout: 15_000 },
    );
  }

  private async makeRound(tx: Tx, type: GameType, used: number[]): Promise<Round | null> {
    switch (type) {
      case 'DUEL':
        return makeDuelRound(tx, used);
      case 'QUIZ':
        return makeQuizRound(tx, used);
      case 'WEIGHT':
        return makeWeightRound(tx, used);
      case 'MYSTERY':
        return makeMysteryRound(tx, used);
      case 'DOORS':
        return this.makeDoorsRound(tx);
    }
  }

  /** Carte au hasard de la rareté voulue (ou de la plus proche). */
  private async pickCar(tx: Tx, rarity: Rarity, exclude: number[]) {
    const drawn = await this.catalog.randomCar(rarity, exclude);
    return drawn ? tx.car.findUnique({ where: { id: drawn.id } }) : null;
  }

  /** Trois portes : une vide, une carte standard (Commune / Peu commune), une haut de gamme (Épique / Légendaire). */
  private async makeDoorsRound(tx: Tx): Promise<DoorsRound | null> {
    const standard: Rarity = Math.random() < 0.7 ? 'COMMON' : 'UNCOMMON';
    const top: Rarity = Math.random() < 0.8 ? 'EPIC' : 'LEGENDARY';
    const s = await this.pickCar(tx, standard, []);
    const t = await this.pickCar(tx, top, s ? [s.id] : []);
    if (!s || !t) return null;
    const outcomes: Door[] = [
      { tier: 'none', carId: null },
      { tier: 'standard', carId: s.id },
      { tier: 'top', carId: t.id },
    ];
    for (let i = outcomes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [outcomes[i], outcomes[j]] = [outcomes[j], outcomes[i]];
    }
    return { kind: 'doors', prompt: 'Derrière quelle porte se cache la meilleure voiture ?', doors: 3, outcomes };
  }

  /** Contenu des trois portes, révélé après le choix. */
  private async revealDoors(tx: Tx, outcomes: Door[]) {
    const ids = outcomes.map((o) => o.carId).filter((v): v is number => v !== null);
    const cars = await tx.car.findMany({ where: { id: { in: ids } } });
    return outcomes.map((o) => ({ tier: o.tier, card: o.carId ? toCardDto(cars.find((c) => c.id === o.carId)!) : null }));
  }

  private usedBy(round: Round): number[] {
    if ('outcomes' in round) return [];
    if ('carId' in round) return [round.carId];
    const duel = round as DuelRound;
    return [duel.a.id, duel.b.id];
  }

  /** Vue d'une partie pour le client : la question en cours, sans la réponse ni le contenu des portes. */
  private view(session: GameSession) {
    const state = session.state as unknown as SessionState;
    const game = GAMES[session.type];
    let question = null;
    if (state.current && session.status === 'ACTIVE') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { answer, reveal, carId, prizeCarId, outcomes, ...rest } = state.current as Round & {
        reveal?: unknown;
        carId?: number;
        outcomes?: unknown;
      };
      question = rest;
    }
    return {
      id: session.id,
      type: session.type,
      name: game.name,
      reward: game.reward,
      status: session.status,
      round: session.round,
      total: game.rounds,
      score: session.score,
      credits: session.credits,
      creditsPerWin: game.creditsPerWin,
      history: state.history,
      question,
    };
  }
}
