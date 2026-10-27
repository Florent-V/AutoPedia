import { db, newPlayer, statuses } from '../helpers';

describe('Succès et portefeuille', () => {
  it('le premier booster débloque un succès, payé une seule fois et signalé dans la réponse', async () => {
    const p = await newPlayer();
    const res = await p.agent.post('/api/boosters/open').expect(200);
    expect(res.body.newAchievements.length).toBeGreaterThan(0);
    const rewards = res.body.newAchievements.reduce((sum: number, a: { reward: number }) => sum + a.reward, 0);

    const paid = await db.creditTransaction.aggregate({ where: { userId: p.id, reason: 'achievement' }, _sum: { amount: true } });
    expect(paid._sum.amount).toBe(rewards);
    expect(res.body.stats.credits).toBe(100 + rewards);

    // Les rafales d'ouvertures et de consultations ne paient jamais deux fois le même succès.
    await statuses([
      ...Array.from({ length: 4 }, () => p.agent.post('/api/boosters/open')),
      ...Array.from({ length: 4 }, () => p.agent.get('/api/achievements')),
    ]);
    const rows = await db.creditTransaction.groupBy({ by: ['ref'], where: { userId: p.id, reason: 'achievement' }, _count: true });
    for (const r of rows) expect(r._count).toBe(1);
    expect(await db.userAchievement.count({ where: { userId: p.id } })).toBe(rows.length);
  });

  it('le portefeuille liste les mouvements avec leur solde', async () => {
    const p = await newPlayer();
    await p.agent.post('/api/daily/claim').expect(200);
    const res = await p.agent.get('/api/wallet').expect(200);
    expect(res.body.balance).toBe(150);
    expect(res.body.history[0]).toMatchObject({ reason: 'daily', amount: 50, balance: 150, label: 'Récompense du jour' });
  });

  it('la liste des succès montre la progression', async () => {
    const p = await newPlayer();
    const res = await p.agent.get('/api/achievements').expect(200);
    expect(res.body.total).toBeGreaterThan(40);
    expect(res.body.achievements[0]).toHaveProperty('progress');
  });
});
