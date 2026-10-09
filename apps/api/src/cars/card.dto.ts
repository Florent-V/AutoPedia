import { Car, Rarity } from '@prisma/client';
import { RARITY_INFO } from '../game/rarity';

export interface CardDto {
  id: number;
  name: string;
  manufacturer: string | null;
  country: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  imageUrl: string | null;
  rarity: Rarity;
  points: number;
  powerHp: number | null;
  topSpeedKmh: number | null;
  massKg: number | null;
  wikiUrl: string | null;
}

export function effectiveRarity(car: Pick<Car, 'rarity' | 'rarityOverride'>): Rarity {
  return car.rarityOverride ?? car.rarity;
}

export function wikiUrl(car: Pick<Car, 'wikiTitle' | 'wikiLang'>): string | null {
  if (!car.wikiTitle) return null;
  return `https://${car.wikiLang ?? 'fr'}.wikipedia.org/wiki/${encodeURIComponent(car.wikiTitle.replace(/ /g, '_'))}`;
}

export function toCardDto(car: Car): CardDto {
  const rarity = effectiveRarity(car);
  return {
    id: car.id,
    name: car.name,
    manufacturer: car.manufacturer,
    country: car.country,
    yearStart: car.yearStart,
    yearEnd: car.yearEnd,
    imageUrl: car.imageUrl,
    rarity,
    points: RARITY_INFO[rarity].points,
    powerHp: car.powerKw ? Math.round(car.powerKw * 1.35962) : null,
    topSpeedKmh: car.topSpeedKmh ? Math.round(car.topSpeedKmh) : null,
    massKg: car.massKg ? Math.round(car.massKg) : null,
    wikiUrl: wikiUrl(car),
  };
}
