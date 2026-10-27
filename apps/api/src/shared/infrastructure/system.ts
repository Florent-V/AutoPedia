import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Clock, RandomSource } from '../application/ports';

@Injectable()
export class SystemClock extends Clock {
  now() {
    return new Date();
  }
}

/** Aléatoire cryptographique : les tirages ne sont pas prévisibles depuis l'extérieur. */
@Injectable()
export class CryptoRandom extends RandomSource {
  next() {
    return randomInt(0, 2 ** 48) / 2 ** 48;
  }
}
