import { carOfRarity, creditsWithoutAchievements as creditsOf, db, giveCard, newPlayer, quantityOf, setCredits, statuses, waitFor } from '../helpers';

describe('Bourse d’échanges', () => {
  it('met la carte en séquestre et la vend contre des crédits', async () => {
    const seller = await newPlayer();
    const buyer = await newPlayer();
    const car = await carOfRarity('RARE');
    await giveCard(seller.id, car.id);

    const { body } = await seller.agent.post('/api/trades').send({ offeredCarId: car.id, price: 80 }).expect(201);
    expect(await quantityOf(seller.id, car.id)).toBe(0);
    // La même carte ne peut pas être proposée deux fois.
    await seller.agent.post('/api/trades').send({ offeredCarId: car.id, price: 80 }).expect(400);
    // On n'accepte pas sa propre offre.
    await seller.agent.post(`/api/trades/${body.id}/accept`).expect(400);

    await setCredits(buyer.id, 100);
    await buyer.agent.post(`/api/trades/${body.id}/accept`).expect(200);
    expect(await quantityOf(buyer.id, car.id)).toBe(1);
    expect(await creditsOf(buyer.id)).toBe(20);
    expect(await creditsOf(seller.id)).toBe(180);
  });

  it('une seule acceptation passe en cas de double clic', async () => {
    const seller = await newPlayer();
    const b1 = await newPlayer();
    const b2 = await newPlayer();
    const car = await carOfRarity('COMMON');
    await giveCard(seller.id, car.id);
    const { body } = await seller.agent.post('/api/trades').send({ offeredCarId: car.id, price: 10 }).expect(201);
    const codes = await statuses([
      b1.agent.post(`/api/trades/${body.id}/accept`),
      b2.agent.post(`/api/trades/${body.id}/accept`),
      b1.agent.post(`/api/trades/${body.id}/accept`),
    ]);
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect((await quantityOf(b1.id, car.id)) + (await quantityOf(b2.id, car.id))).toBe(1);
    expect(await creditsOf(seller.id)).toBe(110);
  });

  it('échange carte contre carte, seulement si l’acheteur possède la carte demandée', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const offered = await carOfRarity('UNCOMMON');
    const wanted = await carOfRarity('UNCOMMON', 1);
    await giveCard(a.id, offered.id);
    const { body } = await a.agent.post('/api/trades').send({ offeredCarId: offered.id, wantedCarId: wanted.id }).expect(201);
    await b.agent.post(`/api/trades/${body.id}/accept`).expect(400);
    await giveCard(b.id, wanted.id);
    await b.agent.post(`/api/trades/${body.id}/accept`).expect(200);
    expect(await quantityOf(a.id, wanted.id)).toBe(1);
    expect(await quantityOf(b.id, offered.id)).toBe(1);
    expect(await quantityOf(b.id, wanted.id)).toBe(0);
  });

  it('valide les contreparties', async () => {
    const p = await newPlayer();
    const car = await carOfRarity('COMMON', 2);
    await giveCard(p.id, car.id);
    for (const payload of [
      { offeredCarId: car.id },
      { offeredCarId: car.id, price: 10, wantedCarId: car.id + 1 },
      { offeredCarId: car.id, price: -5 },
      { offeredCarId: car.id, price: 0 },
      { offeredCarId: car.id, price: 1.5 },
      { offeredCarId: car.id, price: 10_000_000 },
      { offeredCarId: 'x', price: 10 },
      { offeredCarId: car.id, wantedCarId: 99_999_999 },
    ]) {
      const res = await p.agent.post('/api/trades').send(payload);
      expect([400, 404]).toContain(res.status);
    }
    // Carte non possédée.
    const other = await carOfRarity('COMMON', 3);
    await p.agent.post('/api/trades').send({ offeredCarId: other.id, price: 10 }).expect(400);
    expect(await quantityOf(p.id, car.id)).toBe(1);
  });

  it('rend la carte à l’annulation, et seul le vendeur peut annuler', async () => {
    const seller = await newPlayer();
    const other = await newPlayer();
    const car = await carOfRarity('COMMON', 4);
    await giveCard(seller.id, car.id);
    const { body } = await seller.agent.post('/api/trades').send({ offeredCarId: car.id, price: 10 }).expect(201);
    const res = await other.agent.post(`/api/trades/${body.id}/cancel`);
    expect([403, 404]).toContain(res.status);
    await seller.agent.post(`/api/trades/${body.id}/cancel`).expect(200);
    expect(await quantityOf(seller.id, car.id)).toBe(1);
    await seller.agent.post(`/api/trades/${body.id}/cancel`).expect(409);
  });

  it('refuse une offre expirée et rend la carte à l’expiration', async () => {
    const seller = await newPlayer();
    const buyer = await newPlayer();
    const car = await carOfRarity('COMMON', 5);
    await giveCard(seller.id, car.id);
    const { body } = await seller.agent.post('/api/trades').send({ offeredCarId: car.id, price: 10 }).expect(201);
    await db.tradeOffer.update({ where: { id: body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await buyer.agent.post(`/api/trades/${body.id}/accept`).expect(409);
    await waitFor(async () => (await db.tradeOffer.findUnique({ where: { id: body.id } }))?.status !== 'OPEN');
    expect(await quantityOf(seller.id, car.id)).toBe(1);
  });
});
