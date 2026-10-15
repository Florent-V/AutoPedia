import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { GameSession, GameType, Prisma } from '@prisma/client';
import { economyConfig } from '../config';
import { AchievementsService } from '../achievements/achievements.service';
import { BoostersService } from '../boosters/boosters.service';
import { toCardDto } from '../cars/card.dto';
import { addCard, lockPlayers, moveCredits } from '../economy/wallet';
import { rollRarity } from '../game/rarity';
import { startOfZonedDay } from '../game/zoned-time';
import { PlayerService } from '../player/player.service';
import { PrismaService } from '../prisma/prisma.service';
import { DuelRound, makeDuelRound, makeQuizRound, QuizRound } from './questions';

type Tx = Prisma.TransactionClient;
type Round = (DuelRound | QuizRound) & { answer: unknown };

interface SessionState {
  used: number[];
  current: Round | null;
  history: Array<{ correct: boolean }>;
}

export const GAMES: Record<GameType, { name: string; description: string; rounds: number; creditsPerWin: number }> = {
  DUEL: {
    name: 'Duel de stats',
    description: 'Deux voitures, une question : laquelle est la plus rapide, la plus lourde, la plus ancienne… La partie s’arrête à la première erreur.',
    rounds: economyConfig.duelRounds,
    creditsPerWin: economyConfig.duelCreditsPerWin,
  },
  QUIZ: {
    name: 'Quiz auto',
    description: 'Cinq questions à 4 choix : marque, pays, décennie ou modèle en photo. Chaque bonne réponse rapporte des crédits.',
    rounds: economyConfig.quizQuestions,
    creditsPerWin: economyConfig.quizCreditsPerWin,
  },
};

/** Abandon automatique d'une partie restée ouverte. */
const ABANDON_AFTER_MS = 60 * 60 * 1000;

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly players: PlayerService,
    private readonly boosters: BoostersService,
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
        return {
          type,
          ...GAMES[type],
          playsPerDay: economyConfig.gamesPerDay,
          playsLeft: Math.max(0, economyConfig.gamesPerDay - today.length),
          active: today.find((s) => s.status === 'ACTIVE')?.id ?? null,
          bestScore: best.find((b) => b.type === type)?._max.score ?? 0,
        };
      }),
    };
  }

  async start(userId: string, type: GameType) {
    await this.players.ensure(this.prisma, userId);
    return this.prisma.$transaction(
      async (tx) => {
        await lockPlayers(tx, userId);
        const now = new Date();
        // Une partie en cours de ce jeu est reprise plutôt que d'en commencer une nouvelle.
        const active = await tx.gameSession.findFirst({ where: { userId, type, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
        if (active && now.getTime() - active.createdAt.getTime() < ABANDON_AFTER_MS) return this.view(active);
        if (active) await tx.gameSession.update({ where: { id: active.id }, data: { status: 'FINISHED', finishedAt: now } });

        const playedToday = await tx.gameSession.count({ where: { userId, type, createdAt: { gte: this.dayStart(now) } } });
        if (playedToday >= economyConfig.gamesPerDay) {
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
    return this.prisma.$transaction(
      async (tx) => {
        // Verrou sur la partie : une seule réponse traitée par manche, même en cas de double clic.
        await tx.$queryRaw`SELECT 1 FROM "game_session" WHERE "id" = ${id} FOR UPDATE`;
        const session = await tx.gameSession.findFirst({ where: { id, userId } });
        if (!session) throw new NotFoundException('Partie introuvable');
        if (session.status !== 'ACTIVE') throw new ConflictException('Cette partie est terminée');
        const state = session.state as unknown as SessionState;
        const round = state.current;
        if (!round) throw new ConflictException('Aucune question en cours');

        const valid = session.type === 'DUEL' ? choice === 'a' || choice === 'b' : Number.isInteger(choice) && (choice as number) >= 0 && (choice as number) < 4;
        if (!valid) throw new BadRequestException('Réponse invalide');

        const correct = choice === round.answer;
        const game = GAMES[session.type];
        await lockPlayers(tx, userId);
        const gained = correct ? game.creditsPerWin : 0;
        if (gained) await moveCredits(tx, userId, gained, `game:${session.type.toLowerCase()}`, session.id);

        const score = session.score + (correct ? 1 : 0);
        const history = [...state.history, { correct }];
        const lastRound = session.round >= game.rounds;
        const ends = lastRound || (session.type === 'DUEL' && !correct);

        let next: Round | null = null;
        if (!ends) {
          next = await this.makeRound(tx, session.type, state.used);
        }
        const finished = ends || !next;

        let rewardCard = null;
        let newAchievements: Awaited<ReturnType<AchievementsService['evaluate']>> = [];
        if (finished && score >= game.rounds) {
          // Sans-faute : une carte bonus (peu commune ou mieux).
          const car = await this.boosters.pickCar(tx, rollRarity(true), []);
          if (car) {
            const { quantity, isNew } = await addCard(tx, userId, car.id);
            rewardCard = { ...toCardDto(car), quantity, isNew };
          }
        }
        if (finished) {
          await tx.player.update({ where: { userId }, data: { gamesPlayed: { increment: 1 } } });
        }

        const updated = await tx.gameSession.update({
          where: { id },
          data: {
            score,
            credits: { increment: gained },
            round: finished ? session.round : session.round + 1,
            status: finished ? 'FINISHED' : 'ACTIVE',
            finishedAt: finished ? new Date() : null,
            rewardCarId: rewardCard?.id ?? null,
            state: {
              used: next ? [...state.used, ...this.usedBy(next)] : state.used,
              current: next,
              history,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        if (finished) newAchievements = await this.achievements.evaluate(tx, userId);
        const balance = (await tx.player.findUniqueOrThrow({ where: { userId }, select: { credits: true } })).credits;

        return {
          correct,
          answer: round.answer,
          reveal: 'reveal' in round ? round.reveal : null,
          gained,
          balance,
          session: this.view(updated),
          summary: finished ? { score, credits: updated.credits, rewardCard, newAchievements } : null,
        };
      },
      { timeout: 15_000 },
    );
  }

  private makeRound(tx: Tx, type: GameType, used: number[]): Promise<Round | null> {
    return type === 'DUEL' ? makeDuelRound(tx, used) : makeQuizRound(tx, used);
  }

  private usedBy(round: Round): number[] {
    return 'carId' in round ? [round.carId] : [(round as DuelRound).a.id, (round as DuelRound).b.id];
  }

  /** Vue d'une partie pour le client : la question en cours, sans la réponse. */
  private view(session: GameSession) {
    const state = session.state as unknown as SessionState;
    const game = GAMES[session.type];
    let question = null;
    if (state.current && session.status === 'ACTIVE') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { answer, reveal, carId, ...rest } = state.current as Round & { reveal?: unknown; carId?: number };
      question = rest;
    }
    return {
      id: session.id,
      type: session.type,
      name: game.name,
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
