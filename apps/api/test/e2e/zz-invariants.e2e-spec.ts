import { db } from '../helpers';

/** Vérifié en dernier, après tous les scénarios : l'économie reste cohérente. */
describe('Invariants de l’économie', () => {
  it('chaque solde est égal aux crédits de départ plus le journal', async () => {
    const rows = await db.$queryRaw<Array<{ userId: string; credits: number; ledger: bigint | null }>>`
      SELECT p."userId", p."credits", (SELECT SUM(t."amount") FROM "credit_transaction" t WHERE t."userId" = p."userId") AS ledger
      FROM "player" p WHERE NOT p."isBot"`;
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(r.credits).toBe(100 + Number(r.ledger ?? 0));
  });

  it('aucun solde ni aucune quantité négatifs', async () => {
    expect(await db.player.count({ where: { credits: { lt: 0 } } })).toBe(0);
    expect(await db.userCard.count({ where: { quantity: { lt: 1 } } })).toBe(0);
  });
});
