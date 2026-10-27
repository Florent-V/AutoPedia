import { CryptoRandom } from './system';

describe('CryptoRandom', () => {
  it('renvoie des nombres dans [0, 1[', () => {
    const random = new CryptoRandom();
    for (let i = 0; i < 10_000; i++) {
      const x = random.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
