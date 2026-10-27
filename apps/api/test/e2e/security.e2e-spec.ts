import { anonymous, newPlayer } from '../helpers';

describe('Sécurité HTTP', () => {
  it('refuse les routes de jeu sans session', async () => {
    const anon = anonymous();
    for (const [method, path] of [
      ['get', '/api/me'],
      ['post', '/api/boosters/open'],
      ['get', '/api/collection'],
      ['post', '/api/shop/buy'],
      ['post', '/api/trades'],
      ['post', '/api/daily/claim'],
    ] as const) {
      await anon[method](path).expect(401);
    }
  });

  it('laisse passer les routes publiques', async () => {
    const res = await anonymous().get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    await anonymous().get('/api/push/public-key').expect(200);
  });

  it('ne sert pas de fichiers hors du dossier des photos', async () => {
    const res = await anonymous().get('/api/media/..%2f.env');
    expect([400, 403, 404]).toContain(res.status);
    const dot = await anonymous().get('/api/media/.env');
    expect([403, 404]).toContain(dot.status);
  });

  it('protège l’administration par jeton', async () => {
    const { agent } = await newPlayer();
    await agent.get('/api/admin/catalog/status').expect(403);
    await agent.get('/api/admin/catalog/status').set('x-admin-token', 'mauvais-jeton-mauvais-jeton').expect(403);
    await anonymous().get('/api/admin/catalog/status').set('x-admin-token', 'e2e-admin-token-0123456789').expect(200);
  });

  it('rejette les identifiants mal formés', async () => {
    const { agent } = await newPlayer();
    await agent.post('/api/trades/pas-un-uuid/accept').expect(400);
    await agent.get('/api/games/sessions/1%20OR%201=1').expect(400);
    await agent.post('/api/games/NOPE/start').expect(400);
    await agent.get('/api/cars/abc').expect(400);
  });

  it('refuse tout champ non prévu dans une requête', async () => {
    const p = await newPlayer();
    await p.agent.post('/api/trades').send({ offeredCarId: 1, price: 10, sellerId: 'autre' }).expect(400);
    await p.agent.post('/api/auctions').send({ carId: 1, startPrice: 5, durationHours: 1, currentBid: 999 }).expect(400);
    const { body } = await p.agent.post('/api/games/QUIZ/start').expect(200);
    await p.agent.post(`/api/games/sessions/${body.id}/answer`).send({ choice: 0, correct: true }).expect(400);
    await p.agent.get('/api/collection?owned=all&isAdmin=true').expect(400);
  });

  it('borne la pagination', async () => {
    const p = await newPlayer();
    await p.agent.get('/api/collection?page=1000000').expect(400);
    await p.agent.get('/api/collection?pageSize=1000').expect(400);
    await p.agent.get('/api/trades?page=-1').expect(400);
  });

  it('envoie les en-têtes de sécurité', async () => {
    const res = await anonymous().get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('protège l’administration contre une valeur d’import démesurée', async () => {
    await anonymous()
      .post('/api/admin/catalog/import')
      .set('x-admin-token', 'e2e-admin-token-0123456789')
      .send({ source: 'seed', limit: 10_000_000 })
      .expect(400);
  });

  it('refuse les actions envoyées depuis un autre site (CSRF)', async () => {
    const p = await newPlayer();
    await p.agent.post('/api/boosters/open').set('Origin', 'https://site-pirate.example').expect(403);
    await p.agent.post('/api/daily/claim').set('Sec-Fetch-Site', 'cross-site').expect(403);
    const me = await p.agent.get('/api/me').expect(200);
    expect(me.body.boosters.available).toBe(10);
  });
});
