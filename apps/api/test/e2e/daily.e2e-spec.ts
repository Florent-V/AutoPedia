import { zonedParts } from '../../src/game/zoned-time';
import { creditsOf, db, newPlayer, statuses } from '../helpers';

function parisDay(offsetDays: number) {
  return zonedParts(new Date(Date.now() + offsetDays * 86_400_000), 'Europe/Paris').date;
}

describe('Récompense quotidienne', () => {
  it('se réclame une seule fois par jour, même en rafale', async () => {
    const p = await newPlayer();
    const codes = await statuses(Array.from({ length: 4 }, () => p.agent.post('/api/daily/claim')));
    expect(codes.filter((c) => c === 201 || c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(3);
    expect(await creditsOf(p.id)).toBe(150);
  });

  it('donne la carte Épique au 7ᵉ jour d’une série', async () => {
    const p = await newPlayer();
    await p.agent.get('/api/daily').expect(200);
    await db.player.update({ where: { userId: p.id }, data: { dailyStreak: 6, lastDailyClaim: parisDay(-1) } });
    const res = await p.agent.post('/api/daily/claim');
    expect([200, 201]).toContain(res.status);
    expect(res.body.day).toBe(7);
    expect(['EPIC', 'LEGENDARY']).toContain(res.body.card.rarity);
  });

  it('remet la série à 1 après un jour manqué', async () => {
    const p = await newPlayer();
    await p.agent.get('/api/daily').expect(200);
    await db.player.update({ where: { userId: p.id }, data: { dailyStreak: 5, lastDailyClaim: parisDay(-2) } });
    const res = await p.agent.post('/api/daily/claim');
    expect(res.body.streak).toBe(1);
  });
});
