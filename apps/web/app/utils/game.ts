export type Rarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface Card {
  id: number;
  name: string;
  manufacturer: string | null;
  country: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  imageUrl: string | null;
  racing?: boolean;
  rarity: Rarity;
  points: number;
  powerHp: number | null;
  topSpeedKmh: number | null;
  massKg: number | null;
  lengthMm?: number | null;
  wikiUrl: string | null;
  quantity?: number;
  isNew?: boolean;
  firstObtainedAt?: string | null;
  summary?: string | null;
  imageCredit?: { author: string | null; license: string | null; licenseUrl: string | null; sourceUrl: string } | null;
}

export interface BoosterView {
  available: number;
  max: number;
  regenMs: number;
  nextAt: string | null;
  serverTime: string;
}

export interface Stats {
  boostersOpened: number;
  cardsObtained: number;
  uniqueCards: number;
  points: number;
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
  racing?: number;
  maxPerBrand: number;
  countries: number;
  decades: number;
  maxQuantity: number;
  catalogSize?: number;
  achievements?: number;
}

export interface Me {
  user: { id: string; name: string; email: string; image: string | null };
  boosters: BoosterView;
  stats: Stats;
  game: { cardsPerBooster: number };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  category: string;
  goal: number;
  progress?: number;
  unlockedAt?: string | null;
}

export interface OpenResult {
  cards: Card[];
  boosters: BoosterView;
  stats: Stats;
  newAchievements: Achievement[];
}

export const RARITY_META: Record<Rarity, { label: string; short: string; points: number; holo: boolean }> = {
  COMMON: { label: 'Commune', short: 'C', points: 1, holo: false },
  UNCOMMON: { label: 'Peu commune', short: 'PC', points: 3, holo: false },
  RARE: { label: 'Rare', short: 'R', points: 10, holo: false },
  EPIC: { label: 'Épique', short: 'É', points: 30, holo: true },
  LEGENDARY: { label: 'Légendaire', short: 'L', points: 100, holo: true },
};

export const RARITY_ORDER: Rarity[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY'];

export function formatYears(card: Pick<Card, 'yearStart' | 'yearEnd'>): string {
  if (!card.yearStart) return '';
  if (!card.yearEnd) return `${card.yearStart}`;
  if (card.yearEnd === card.yearStart) return `${card.yearStart}`;
  return `${card.yearStart}–${card.yearEnd}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const formatNumber = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
