import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { DomainError } from '../domain/errors';

const STATUS: Record<DomainError['kind'], HttpStatus> = {
  invalid: HttpStatus.BAD_REQUEST,
  'not-found': HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  conflict: HttpStatus.CONFLICT,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
};

const ERROR: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  403: 'Forbidden',
  409: 'Conflict',
  503: 'Service Unavailable',
};

/**
 * Traduit les erreurs métier en réponses HTTP (même format que NestJS : statusCode, message, error).
 * Une violation d'unicité en base (deux requêtes simultanées pour la même action) devient un 409.
 */
@Catch(DomainError, Prisma.PrismaClientKnownRequestError)
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(error: DomainError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status: number;
    let message: string;
    if (error instanceof DomainError) {
      status = STATUS[error.kind];
      message = error.message;
    } else if (error.code === 'P2002' || error.code === 'P2034') {
      // P2002 : unicité ; P2034 : conflit d'écriture concurrente.
      status = HttpStatus.CONFLICT;
      message = 'Action déjà effectuée ou en conflit avec une autre : réessayez';
    } else {
      this.logger.error(error);
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Erreur interne';
    }
    res.status(status).json({ statusCode: status, message, error: ERROR[status] ?? 'Internal Server Error' });
  }
}
