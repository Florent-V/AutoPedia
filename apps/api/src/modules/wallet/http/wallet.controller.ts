import { Controller, Get } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../../auth/auth.guard';
import { WalletHistoryQuery } from '../application/wallet-history.query';

@Controller('wallet')
export class WalletController {
  constructor(private readonly history: WalletHistoryQuery) {}

  /** Solde et 30 derniers mouvements de crédits. */
  @Get()
  wallet(@CurrentUser() user: AuthUser) {
    return this.history.forUser(user.id);
  }
}
