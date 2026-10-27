import { creditsOf, creditsWithoutAchievements, db, newPlayer, quantityOf, setCredits, statuses } from '../helpers';

describe('Boutique', () => {
  it('vend au prix du serveur, une seule fois par offre, même en rafale', async () => {
    const p = await newPlayer();
    const shop = await p.agent.get('/api/shop').expect(200);
    const offer = shop.body.offers.find((o: { card: { rarity: string } }) => o.card.rarity === 'COMMON') ?? shop.body.offers[0];
    await setCredits(p.id, offer.price + 1000);

    const codes = await statuses(
      Array.from({ length: 5 }, () => p.agent.post('/api/shop/buy').send({ offerKey: offer.offerKey })),
    );
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(4);
    expect(await creditsWithoutAchievements(p.id)).toBe(1000);
    expect(await quantityOf(p.id, offer.card.id)).toBe(1);
    const debits = await db.creditTransaction.count({ where: { userId: p.id, reason: { startsWith: 'shop' } } });
    expect(debits).toBe(1);
  });

  it('refuse un achat sans crédits suffisants sans rien modifier', async () => {
    const p = await newPlayer();
    const shop = await p.agent.get('/api/shop').expect(200);
    const offer = shop.body.offers.find((o: { price: number }) => o.price > 1);
    await setCredits(p.id, offer.price - 1);
    await p.agent.post('/api/shop/buy').send({ offerKey: offer.offerKey }).expect(409);
    expect(await creditsOf(p.id)).toBe(offer.price - 1);
    expect(await quantityOf(p.id, offer.card.id)).toBe(0);
    expect(await db.shopPurchase.count({ where: { userId: p.id } })).toBe(0);
  });

  it('refuse une offre inventée ou périmée', async () => {
    const p = await newPlayer();
    await setCredits(p.id, 100_000);
    await p.agent.post('/api/shop/buy').send({ offerKey: '2001-01-01T00:LEGENDARY:0' }).expect(404);
    await p.agent.post('/api/shop/buy').send({ offerKey: 'nimporte-quoi' }).expect(404);
    await p.agent.post('/api/shop/buy').send({}).expect(400);
    await p.agent.post('/api/shop/buy').send({ offerKey: 42 }).expect(400);
    expect(await creditsOf(p.id)).toBe(100_000);
  });

  it('ignore un prix envoyé par le client', async () => {
    const p = await newPlayer();
    const shop = await p.agent.get('/api/shop').expect(200);
    const offer = shop.body.offers.find((o: { price: number }) => o.price >= 10);
    await setCredits(p.id, offer.price);
    const res = await p.agent.post('/api/shop/buy').send({ offerKey: offer.offerKey, price: 1 });
    if (res.status === 200) expect(await creditsWithoutAchievements(p.id)).toBe(0);
    else expect(res.status).toBe(400);
  });
});
