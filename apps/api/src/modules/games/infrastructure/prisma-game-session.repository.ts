import { Injectable } from '@nestjs/common';
import { GameSession as GameSessionRow, Prisma } from '@prisma/client';
import { Db } from '../../../shared/infrastructure/prisma/transaction';
import { GameType } from '../domain/game-rules';
import { GameSession, GameSessionSnapshot } from '../domain/game-session';
import { GameSessionRepository } from '../domain/ports';
import { GAMES } from '../application/games.config';

const toDomain = (row: GameSessionRow) =>
  GameSession.restore(
    {
      id: row.id,
      userId: row.userId,
      type: row.type,
      status: row.status,
      round: row.round,
      score: row.score,
      credits: row.credits,
      createdAt: row.createdAt,
      finishedAt: row.finishedAt,
      rewardCarId: row.rewardCarId,
      state: row.state as unknown as GameSessionSnapshot['state'],
    },
    GAMES[row.type],
  );

const data = (s: GameSessionSnapshot) => ({
  status: s.status,
  round: s.round,
  score: s.score,
  credits: s.credits,
  finishedAt: s.finishedAt,
  rewardCarId: s.rewardCarId,
  state: s.state as unknown as Prisma.InputJsonValue,
});

@Injectable()
export class PrismaGameSessionRepository extends GameSessionRepository {
  constructor(private readonly db: Db) {
    super();
  }

  async findActive(userId: string, type: GameType) {
    const row = await this.db.tx.gameSession.findFirst({ where: { userId, type, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    return row ? toDomain(row) : null;
  }

  async getForUpdate(id: string, userId: string) {
    await this.db.tx.$queryRaw`SELECT 1 FROM "game_session" WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`;
    return this.find(id, userId);
  }

  async find(id: string, userId: string) {
    const row = await this.db.tx.gameSession.findFirst({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }

  async bestScore(userId: string, type: GameType) {
    const best = await this.db.tx.gameSession.aggregate({ where: { userId, type, status: 'FINISHED' }, _max: { score: true } });
    return best._max.score ?? 0;
  }

  countStartedSince(userId: string, type: GameType, since: Date) {
    return this.db.tx.gameSession.count({ where: { userId, type, createdAt: { gte: since } } });
  }

  async create(session: GameSession) {
    const s = session.snapshot();
    await this.db.tx.gameSession.create({ data: { id: s.id, userId: s.userId, type: s.type, createdAt: s.createdAt, ...data(s) } });
  }

  async save(session: GameSession) {
    const s = session.snapshot();
    await this.db.tx.gameSession.update({ where: { id: s.id }, data: data(s) });
  }

  async addPlayerCounters(userId: string, c: { gamesPlayed?: number; gameCardsWon?: number; doorsJackpots?: number }) {
    await this.db.tx.player.update({
      where: { userId },
      data: {
        gamesPlayed: { increment: c.gamesPlayed ?? 0 },
        gameCardsWon: { increment: c.gameCardsWon ?? 0 },
        doorsJackpots: { increment: c.doorsJackpots ?? 0 },
      },
    });
  }
}
