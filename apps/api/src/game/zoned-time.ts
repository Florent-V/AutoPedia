/** Outils de date dans un fuseau horaire donné (sans dépendance externe). */

export interface ZonedParts {
  /** AAAA-MM-JJ dans le fuseau */
  date: string;
  hour: number;
  minute: number;
  second: number;
  /** Décalage du fuseau par rapport à UTC, en millisecondes. */
  offsetMs: number;
}

export function zonedParts(at: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  const [y, m, d, h, mi, s] = [p.year, p.month, p.day, p.hour, p.minute, p.second].map(Number);
  const asUtc = Date.UTC(y, m - 1, d, h, mi, s);
  const offsetMs = Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000) * 60_000;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: h, minute: mi, second: s, offsetMs };
}

/** Début (minuit) de la journée en cours dans le fuseau. */
export function startOfZonedDay(at: Date, timeZone: string): Date {
  const z = zonedParts(at, timeZone);
  const [y, m, d] = z.date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - z.offsetMs);
}

/** Début de l'heure suivante (instant de la prochaine rotation). */
export function nextZonedHour(at: Date, timeZone: string): Date {
  const z = zonedParts(at, timeZone);
  const ms = at.getTime() % 1000;
  return new Date(at.getTime() - ms + ((59 - z.minute) * 60 + (60 - z.second)) * 1000);
}
