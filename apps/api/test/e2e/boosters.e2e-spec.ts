import { db, newPlayer, statuses } from '../helpers';

describe('Boosters', () => {
  it('donne la réserve de départ et ouvre un booster de 5 cartes', async () => {
    const p = await newPlayer();
    const me = await p.agent.get('/api/me').expect(200);
    expect(me.body.boosters.available).toBe(10);
    expect(me.body.stats.credits).toBe(100);

    const res = await p.agent.post('/api/boosters/open').expect(200);
    expect(res.body.cards).toHaveLength(5);
    expect(res.body.boosters.available).toBe(9);
    const owned = await db.userCard.aggregate({ where: { userId: p.id }, _sum: { quantity: true } });
    expect(owned._sum.quantity).toBe(5);
  });

  it('ne permet pas d’ouvrir plus de boosters que la réserve, même en rafale', async () => {
    const p = await newPlayer();
    await p.agent.post('/api/boosters/open').expect(200);
    const codes = await statuses(Array.from({ length: 12 }, () => p.agent.post('/api/boosters/open')));
    expect(codes.filter((c) => c === 200)).toHaveLength(9);
    expect(codes.filter((c) => c === 409)).toHaveLength(3);
    const player = await db.player.findUniqueOrThrow({ where: { userId: p.id } });
    expect(player.boostersOpened).toBe(10);
    const owned = await db.userCard.aggregate({ where: { userId: p.id }, _sum: { quantity: true } });
    expect(owned._sum.quantity).toBe(50);
  });

  it('applique la garantie Épique côté serveur', async () => {
    const p = await newPlayer();
    await db.player.update({ where: { userId: p.id }, data: { sinceEpic: 9 } });
    const res = await p.agent.post('/api/boosters/open').expect(200);
    expect(res.body.cards.some((c: { rarity: string }) => c.rarity === 'EPIC' || c.rarity === 'LEGENDARY')).toBe(true);
    const player = await db.player.findUniqueOrThrow({ where: { userId: p.id } });
    expect(player.sinceEpic).toBe(0);
  });

  it('ignore toute tentative d’influencer le tirage depuis la requête', async () => {
    const p = await newPlayer();
    const res = await p.agent.post('/api/boosters/open').send({ rarity: 'LEGENDARY', count: 50, cards: [1, 2, 3] });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) expect(res.body.cards).toHaveLength(5);
    const owned = await db.userCard.aggregate({ where: { userId: p.id }, _sum: { quantity: true } });
    expect(owned._sum.quantity ?? 0).toBeLessThanOrEqual(5);
  });
});
