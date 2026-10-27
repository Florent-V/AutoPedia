import { InvalidRequest, RuleViolation } from '../../../shared/domain/errors';
import { defineGames } from './game-rules';
import { GameSession } from './game-session';
import { DoorsRound, DuelRound, QuizRound } from './rounds';

const GAMES = defineGames({ duelRounds: 3, duelCreditsPerWin: 10, quizQuestions: 2, quizCreditsPerWin: 15, gamesPerDay: 3, quickGamesPerDay: 5, doorsPerDay: 2 });
const now = new Date('2026-05-01T10:00:00Z');
const card = (id: number) => ({ id, name: `Voiture ${id}`, manufacturer: null, imageUrl: null, rarity: 'COMMON' as const });
const duel = (a: number, b: number, answer: 'a' | 'b'): DuelRound => ({
  stat: 'massKg', question: 'Laquelle est la plus lourde ?', a: card(a), b: card(b), answer, reveal: { a: '1 t', b: '2 t' },
});
const quiz = (carId: number, answer: number): QuizRound => ({
  kind: 'brand', prompt: 'Quelle marque ?', car: { name: 'X', imageUrl: null }, choices: ['A', 'B', 'C', 'D'], answer, carId,
});
const start = (type: 'DUEL' | 'QUIZ' | 'WEIGHT' | 'DOORS', first: DuelRound | QuizRound | DoorsRound) =>
  GameSession.start({ id: 's', userId: 'u', type, def: GAMES[type], first, now });

describe('GameSession', () => {
  it('ne montre jamais la réponse au client', () => {
    const s = start('DUEL', { ...duel(1, 2, 'b'), prizeCarId: 2 });
    const q = s.view().question!;
    for (const key of ['answer', 'reveal', 'prizeCarId', 'carId', 'outcomes']) expect(q).not.toHaveProperty(key);
    expect(q).toHaveProperty('a');
  });

  it('le duel s’arrête à la première erreur', () => {
    const s = start('DUEL', duel(1, 2, 'a'));
    expect(s.answer('a')).toMatchObject({ correct: true, gained: 10, continues: true });
    s.continueWith(duel(3, 4, 'b'), now);
    expect(s.usedCars).toEqual([1, 2, 3, 4]);
    expect(s.answer('a')).toMatchObject({ correct: false, gained: 0, continues: false });
    s.finish(now);
    expect(s.earnedPerfectBonus).toBe(false);
    expect(() => s.answer('a')).toThrow(RuleViolation);
  });

  it('un sans-faute au quiz donne droit au bonus', () => {
    const s = start('QUIZ', quiz(1, 2));
    expect(s.answer(2).continues).toBe(true);
    s.continueWith(quiz(2, 0), now);
    expect(s.answer(0)).toMatchObject({ correct: true, continues: false });
    s.finish(now);
    expect(s.earnedPerfectBonus).toBe(true);
    expect(s.view()).toMatchObject({ score: 2, credits: 30, status: 'FINISHED', question: null });
  });

  it('refuse les réponses hors format', () => {
    const s = start('QUIZ', quiz(1, 2));
    for (const choice of [4, -1, 1.5, '1', 'a', null, undefined, [0]]) expect(() => s.answer(choice)).toThrow(InvalidRequest);
    const d = start('DUEL', duel(1, 2, 'a'));
    for (const choice of ['c', 0, 'A']) expect(() => d.answer(choice)).toThrow(InvalidRequest);
  });

  it('poids lourds : la carte n’est gagnée qu’avec la bonne réponse', () => {
    expect(start('WEIGHT', { ...duel(1, 2, 'b'), prizeCarId: 2 }).answer('a')).toMatchObject({ correct: false, prizeCarId: null });
    expect(start('WEIGHT', { ...duel(1, 2, 'b'), prizeCarId: 2 }).answer('b')).toMatchObject({ correct: true, prizeCarId: 2 });
  });

  it('les 3 garages donnent le contenu de la porte choisie', () => {
    const doors: DoorsRound = {
      kind: 'doors', prompt: '?', doors: 3,
      outcomes: [{ tier: 'standard', carId: 7 }, { tier: 'none', carId: null }, { tier: 'top', carId: 9 }],
    };
    expect(start('DOORS', doors).answer(1)).toMatchObject({ correct: false, prizeCarId: null, jackpot: false });
    expect(start('DOORS', doors).answer(2)).toMatchObject({ correct: true, prizeCarId: 9, jackpot: true });
    expect(() => start('DOORS', doors).answer(3)).toThrow(InvalidRequest);
  });
});
