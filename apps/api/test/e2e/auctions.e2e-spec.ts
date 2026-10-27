import { carOfRarity, creditsWithoutAchievements as creditsOf, db, giveCard, newPlayer, quantityOf, setCredits, waitFor } from '../helpers';

describe('Enchères', () => {
  it('bloque les crédits, rembourse le surenchéri et règle la vente', async () => {
    const seller = await newPlayer();
    const b1 = await newPlayer();
    const b2 = await newPlayer();
    const car = await carOfRarity('RARE', 1);
    await giveCard(seller.id, car.id);
    await setCredits(b1.id, 500);
    await setCredits(b2.id, 500);

    const { body } = await seller.agent.post('/api/auctions').send({ carId: car.id, startPrice: 20, durationHours: 1 }).expect(201);
    expect(await quantityOf(seller.id, car.id)).toBe(0);

    await seller.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 50 }).expect(400);
    await b1.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 19 }).expect(400);
    await b1.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 20 }).expect(200);
    expect(await creditsOf(b1.id)).toBe(480);
    // Le meilleur enchérisseur ne surenchérit pas sur lui-même.
    await b1.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 40 }).expect(409);
    // Minimum suivant : 20 + max(1, 5 %) = 21.
    await b2.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 20 }).expect(400);
    await b2.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 21 }).expect(200);
    expect(await creditsOf(b1.id)).toBe(500);
    expect(await creditsOf(b2.id)).toBe(479);

    // Une offre déjà faite interdit l'annulation.
    await seller.agent.post(`/api/auctions/${body.id}/cancel`).expect(409);

    const sellerBefore = await creditsOf(seller.id);
    await db.auction.update({ where: { id: body.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const done = await waitFor(async () => {
      const a = await db.auction.findUnique({ where: { id: body.id } });
      return a?.status === 'SOLD' && a;
    });
    expect(done.status).toBe('SOLD');
    expect(await quantityOf(b2.id, car.id)).toBe(1);
    expect(await creditsOf(seller.id)).toBe(sellerBefore + 21 - 1);
    expect(await creditsOf(b2.id)).toBe(479);
  });

  it('prolonge une enchère qui reçoit une offre dans les dernières secondes', async () => {
    const seller = await newPlayer();
    const bidder = await newPlayer();
    const car = await carOfRarity('COMMON', 6);
    await giveCard(seller.id, car.id);
    const { body } = await seller.agent.post('/api/auctions').send({ carId: car.id, startPrice: 5, durationHours: 1 }).expect(201);
    await db.auction.update({ where: { id: body.id }, data: { endsAt: new Date(Date.now() + 30_000) } });
    const res = await bidder.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 5 }).expect(200);
    const remaining = new Date(res.body.endsAt).getTime() - Date.now();
    expect(remaining).toBeGreaterThan(110_000);
  });

  it('rend la carte d’une enchère annulée ou invendue', async () => {
    const seller = await newPlayer();
    const c1 = await carOfRarity('COMMON', 7);
    const c2 = await carOfRarity('COMMON', 8);
    await giveCard(seller.id, c1.id);
    await giveCard(seller.id, c2.id);
    const a1 = await seller.agent.post('/api/auctions').send({ carId: c1.id, startPrice: 5, durationHours: 1 }).expect(201);
    await seller.agent.post(`/api/auctions/${a1.body.id}/cancel`).expect(200);
    expect(await quantityOf(seller.id, c1.id)).toBe(1);

    const a2 = await seller.agent.post('/api/auctions').send({ carId: c2.id, startPrice: 5, durationHours: 1 }).expect(201);
    await db.auction.update({ where: { id: a2.body.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    await waitFor(async () => (await db.auction.findUnique({ where: { id: a2.body.id } }))?.status === 'UNSOLD');
    expect(await quantityOf(seller.id, c2.id)).toBe(1);
  });

  it('valide la mise en vente et les offres', async () => {
    const p = await newPlayer();
    const car = await carOfRarity('COMMON', 9);
    await giveCard(p.id, car.id);
    for (const payload of [
      { carId: car.id, startPrice: 5, durationHours: 2 },
      { carId: car.id, startPrice: 0, durationHours: 1 },
      { carId: car.id, startPrice: -10, durationHours: 1 },
      { carId: car.id, startPrice: 5 },
      { carId: car.id, startPrice: '5abc', durationHours: 1 },
    ]) {
      await p.agent.post('/api/auctions').send(payload).expect(400);
    }
    const missing = await carOfRarity('COMMON', 10);
    await p.agent.post('/api/auctions').send({ carId: missing.id, startPrice: 5, durationHours: 1 }).expect(400);
    expect(await quantityOf(p.id, car.id)).toBe(1);

    const { body } = await p.agent.post('/api/auctions').send({ carId: car.id, startPrice: 5, durationHours: 1 }).expect(201);
    const bidder = await newPlayer();
    for (const amount of [0, -5, 2.5, 'abc', 99_999_999]) {
      await bidder.agent.post(`/api/auctions/${body.id}/bid`).send({ amount }).expect(400);
    }
    // Plus que son solde : refusé, rien n'est débité.
    await bidder.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 5000 }).expect(409);
    expect(await creditsOf(bidder.id)).toBe(100);
  });
});
