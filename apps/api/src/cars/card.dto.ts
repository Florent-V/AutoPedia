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
  racing: boolean;
  rarity: Rarity;
  points: number;
  powerHp: number | null;
  topSpeedKmh: number | null;
  massKg: number | null;
  lengthMm: number | null;
  wikiUrl: string | null;
}

export function effectiveRarity(car: Pick<Car, 'rarity' | 'rarityOverride'>): Rarity {
  return car.rarityOverride ?? car.rarity;
}

export function wikiUrl(car: Pick<Car, 'wikiTitle' | 'wikiLang'>): string | null {
  if (!car.wikiTitle) return null;
  return `https://${car.wikiLang ?? 'fr'}.wikipedia.org/wiki/${encodeURIComponent(car.wikiTitle.replace(/ /g, '_'))}`;
}

const REMOTE_FALLBACK = process.env.MEDIA_REMOTE_FALLBACK !== 'false';

/** Photo servie par l'API si elle a été rapatriée, sinon (optionnellement) l'URL Wikimedia d'origine. */
export function imageUrlOf(car: Pick<Car, 'imagePath' | 'imageUrl'>): string | null {
  if (car.imagePath) return `/api/media/${car.imagePath}`;
  return REMOTE_FALLBACK ? car.imageUrl : null;
}

export function imageCreditOf(car: Car) {
  if (!car.imageFile || !car.imagePath) return null;
  return {
    author: car.imageAuthor,
    license: car.imageLicense,
    licenseUrl: car.imageLicenseUrl,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(car.imageFile.replace(/ /g, '_'))}`,
  };
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
    imageUrl: imageUrlOf(car),
    racing: car.racing,
    rarity,
    points: RARITY_INFO[rarity].points,
    powerHp: car.powerKw ? Math.round(car.powerKw * 1.35962) : null,
    topSpeedKmh: car.topSpeedKmh ? Math.round(car.topSpeedKmh) : null,
    massKg: car.massKg ? Math.round(car.massKg) : null,
    lengthMm: car.lengthMm,
    wikiUrl: wikiUrl(car),
  };
}
