import { carOfRarity, giveCard, newPlayer, newTrader, quantityOf, setCredits } from '../helpers';

/** Garde-fous contre les comptes multiples (transferts de cartes ou de crédits vers un compte principal). */
describe('Garde-fous du marché', () => {
  it('un compte tout neuf ne peut ni vendre, ni acheter, ni enchérir', async () => {
    const fresh = await newPlayer();
    const trader = await newTrader();
    const car = await carOfRarity('COMMON', 12);
    await giveCard(fresh.id, car.id);
    await giveCard(trader.id, car.id);

    const list = await fresh.agent.get('/api/trades').expect(200);
    expect(list.body.market).toMatchObject({ canTrade: false });
    expect(list.body.market.reason).toContain('24 h');

    await fresh.agent.post('/api/trades').send({ offeredCarId: car.id, price: 10 }).expect(409);
    await fresh.agent.post('/api/auctions').send({ carId: car.id, startPrice: 10, durationHours: 1 }).expect(409);
    expect(await quantityOf(fresh.id, car.id)).toBe(1);

    const trade = await trader.agent.post('/api/trades').send({ offeredCarId: car.id, price: 10 }).expect(201);
    await fresh.agent.post(`/api/trades/${trade.body.id}/accept`).expect(409);
  });

  it('refuse de brader une carte rare sous le prix plancher', async () => {
    const p = await newTrader();
    const legend = await carOfRarity('LEGENDARY');
    await giveCard(p.id, legend.id);
    await p.agent.post('/api/trades').send({ offeredCarId: legend.id, price: 1 }).expect(409);
    await p.agent.post('/api/auctions').send({ carId: legend.id, startPrice: 1, durationHours: 1 }).expect(409);
    expect(await quantityOf(p.id, legend.id)).toBe(1);
    const res = await p.agent.get('/api/trades').expect(200);
    expect(res.body.market.priceFloor.LEGENDARY).toBe(500);
    await p.agent.post('/api/trades').send({ offeredCarId: legend.id, price: 500 }).expect(201);
  });

  it('refuse les échanges carte contre carte trop déséquilibrés', async () => {
    const p = await newTrader();
    const legend = await carOfRarity('LEGENDARY', 1);
    const common = await carOfRarity('COMMON', 13);
    await giveCard(p.id, legend.id);
    await p.agent.post('/api/trades').send({ offeredCarId: legend.id, wantedCarId: common.id }).expect(409);
    expect(await quantityOf(p.id, legend.id)).toBe(1);
  });

  it('un nouveau compte ne peut pas enchérir pour gonfler une vente', async () => {
    const seller = await newTrader();
    const fresh = await newPlayer();
    const car = await carOfRarity('COMMON', 14);
    await giveCard(seller.id, car.id);
    await setCredits(fresh.id, 1000);
    const { body } = await seller.agent.post('/api/auctions').send({ carId: car.id, startPrice: 5, durationHours: 1 }).expect(201);
    await fresh.agent.post(`/api/auctions/${body.id}/bid`).send({ amount: 900 }).expect(409);
  });
});
