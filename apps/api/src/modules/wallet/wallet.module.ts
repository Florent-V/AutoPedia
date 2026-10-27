import { Module } from '@nestjs/common';
import { WalletHistoryQuery } from './application/wallet-history.query';
import { WalletService } from './application/wallet.service';
import { WalletRepository } from './domain/wallet';
import { WalletController } from './http/wallet.controller';
import { PrismaWalletRepository } from './infrastructure/prisma-wallet.repository';

/** Contexte « Portefeuille » : solde et journal des crédits. N'expose que `WalletService`. */
@Module({
  controllers: [WalletController],
  providers: [WalletService, WalletHistoryQuery, { provide: WalletRepository, useClass: PrismaWalletRepository }],
  exports: [WalletService],
})
export class WalletModule {}
