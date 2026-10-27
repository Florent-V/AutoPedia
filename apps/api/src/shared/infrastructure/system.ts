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
    // randomInt accepte un écart d'au plus 2^48 - 1 ; résultat dans [0, 1[.
    return randomInt(0, 2 ** 48 - 1) / 2 ** 48;
  }
}
