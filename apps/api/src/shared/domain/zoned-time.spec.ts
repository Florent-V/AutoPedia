import { nextZonedHour, startOfZonedDay, zonedParts } from './zoned-time';

describe('zoned time', () => {
  it('handles Paris summer time', () => {
    const at = new Date('2026-07-01T22:30:00Z'); // 00:30 à Paris
    expect(zonedParts(at, 'Europe/Paris')).toMatchObject({ date: '2026-07-02', hour: 0, minute: 30 });
    expect(startOfZonedDay(at, 'Europe/Paris').toISOString()).toBe('2026-07-01T22:00:00.000Z');
  });

  it('handles Paris winter time', () => {
    const at = new Date('2026-12-01T10:15:20Z'); // 11:15:20 à Paris
    expect(zonedParts(at, 'Europe/Paris').hour).toBe(11);
    expect(startOfZonedDay(at, 'Europe/Paris').toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(nextZonedHour(at, 'Europe/Paris').toISOString()).toBe('2026-12-01T11:00:00.000Z');
  });
});
