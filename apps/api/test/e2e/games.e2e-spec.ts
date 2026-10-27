import { creditsWithoutAchievements, db, newPlayer } from '../helpers';

/** Champs secrets qui ne doivent jamais quitter le serveur avant la réponse. */
const SECRETS = ['answer', 'reveal', 'carId', 'prizeCarId', 'outcomes'];

function expectNoSecret(question: Record<string, unknown> | null) {
  expect(question).toBeTruthy();
  for (const key of SECRETS) expect(question).not.toHaveProperty(key);
}

async function currentRound(sessionId: string) {
  const s = await db.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
  return (s.state as { current: Record<string, unknown> }).current;
}

describe('Mini-jeux', () => {
  it('ne révèle aucune réponse et paie exactement les bonnes réponses du quiz', async () => {
    const p = await newPlayer();
    const start = await p.agent.post('/api/games/QUIZ/start').expect(200);
    const id = start.body.id;
    expectNoSecret(start.body.question);

    // Relancer la même partie la reprend au lieu d'en ouvrir une nouvelle.
    const again = await p.agent.post('/api/games/QUIZ/start').expect(200);
    expect(again.body.id).toBe(id);

    let expected = 100;
    for (let round = 1; round <= 5; round++) {
      const current = await currentRound(id);
      const right = current.answer as number;
      const choice = round % 2 ? right : (right + 1) % 4;
      const res = await p.agent.post(`/api/games/sessions/${id}/answer`).send({ choice }).expect(200);
      expect(res.body.correct).toBe(choice === right);
      if (choice === right) expected += 15;
      expect(res.body.gained).toBe(choice === right ? 15 : 0);
      expect(await creditsWithoutAchievements(p.id)).toBe(expected);
      if (round < 5) expectNoSecret(res.body.session.question);
    }
    await p.agent.post(`/api/games/sessions/${id}/answer`).send({ choice: 0 }).expect(409);
    expect(await creditsWithoutAchievements(p.id)).toBe(expected);
  });

  it('refuse les réponses hors format', async () => {
    const p = await newPlayer();
    const { body } = await p.agent.post('/api/games/DUEL/start').expect(200);
    for (const choice of ['c', 0, null, ['a'], { a: 1 }, 'a; DROP TABLE player']) {
      await p.agent.post(`/api/games/sessions/${body.id}/answer`).send({ choice }).expect(400);
    }
    const q = await p.agent.post('/api/games/QUIZ/start').expect(200);
    for (const choice of [4, -1, 1.5, '1', 'a']) {
      await p.agent.post(`/api/games/sessions/${q.body.id}/answer`).send({ choice }).expect(400);
    }
  });

  it('interdit de répondre à la partie d’un autre joueur', async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const { body } = await a.agent.post('/api/games/DUEL/start').expect(200);
    await b.agent.post(`/api/games/sessions/${body.id}/answer`).send({ choice: 'a' }).expect(404);
    await b.agent.get(`/api/games/sessions/${body.id}`).expect(404);
  });

  it('les jeux à carte cachent la carte en jeu et donnent la bonne', async () => {
    const p = await newPlayer();
    for (const type of ['WEIGHT', 'MYSTERY'] as const) {
      const start = await p.agent.post(`/api/games/${type}/start`).expect(200);
      expectNoSecret(start.body.question);
      const current = await currentRound(start.body.id);
      const res = await p.agent.post(`/api/games/sessions/${start.body.id}/answer`).send({ choice: current.answer }).expect(200);
      expect(res.body.correct).toBe(true);
      expect(res.body.prize.id).toBe(current.prizeCarId);
      expect((await db.userCard.findUnique({ where: { userId_carId: { userId: p.id, carId: current.prizeCarId as number } } }))?.quantity).toBeGreaterThan(0);
    }
  });

  it('les 3 garages donnent le contenu de la porte choisie, et pas plus de 2 parties par jour', async () => {
    const p = await newPlayer();
    for (let i = 0; i < 2; i++) {
      const start = await p.agent.post('/api/games/DOORS/start').expect(200);
      expectNoSecret(start.body.question);
      const outcomes = (await currentRound(start.body.id)).outcomes as Array<{ tier: string; carId: number | null }>;
      const pick = outcomes.findIndex((o) => o.tier === 'top');
      const res = await p.agent.post(`/api/games/sessions/${start.body.id}/answer`).send({ choice: pick }).expect(200);
      expect(res.body.prize.id).toBe(outcomes[pick].carId);
      expect(res.body.doors).toHaveLength(3);
    }
    await p.agent.post('/api/games/DOORS/start').expect(409);
    const player = await db.player.findUniqueOrThrow({ where: { userId: p.id } });
    expect(player.doorsJackpots).toBe(2);
  });

  it('respecte la limite quotidienne des jeux à crédits', async () => {
    const p = await newPlayer();
    for (let i = 0; i < 3; i++) {
      const { body } = await p.agent.post('/api/games/DUEL/start').expect(200);
      const current = await currentRound(body.id);
      // Une mauvaise réponse termine le duel.
      await p.agent.post(`/api/games/sessions/${body.id}/answer`).send({ choice: current.answer === 'a' ? 'b' : 'a' }).expect(200);
    }
    await p.agent.post('/api/games/DUEL/start').expect(409);
  });
});
