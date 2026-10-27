import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Clock, EventBus, PlayerLocks, UnitOfWork } from '../../../shared/application/ports';
import { RuleViolation } from '../../../shared/domain/errors';
import { economyConfig } from '../../../config';
import { CardsService } from '../../collection/application/cards.service';
import { WalletService } from '../../wallet/application/wallet.service';
import { Auction } from '../domain/auction';
import { AuctionOutbid, AuctionSettled } from '../domain/events';
import { AuctionRepository, MarketCounters } from '../domain/ports';
import { auctionRules } from './market.config';

/**
 * Enchères. Verrous : l'enchère d'abord, puis les joueurs (triés) — même ordre partout.
 */
@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly locks: PlayerLocks,
    private readonly auctions: AuctionRepository,
    private readonly counters: MarketCounters,
    private readonly wallet: WalletService,
    private readonly cards: CardsService,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {}

  create(sellerId: string, input: { carId: number; startPrice: number; durationHours: number }) {
    return this.uow.run(async () => {
      const auction = Auction.open({ id: randomUUID(), sellerId, ...input, now: this.clock.now(), rules: auctionRules });
      await this.locks.lock(sellerId);
      const open = await this.auctions.countOpenBySeller(sellerId);
      if (open >= economyConfig.maxOpenAuctions) {
        throw new RuleViolation(`Vous avez déjà ${open} enchères en cours (maximum ${economyConfig.maxOpenAuctions})`);
      }
      // Séquestre : la carte quitte la collection jusqu'à la fin de l'enchère.
      await this.cards.take(sellerId, auction.carId);
      await this.auctions.create(auction);
      return { id: auction.id };
    });
  }

  /** Offre : les crédits de l'enchérisseur sont bloqués, le précédent meilleur enchérisseur est remboursé. */
  bid(userId: string, id: string, amount: number) {
    return this.uow.run(async () => {
      const auction = await this.auctions.getForUpdate(id);
      const { previous } = auction.bid(userId, amount, this.clock.now(), auctionRules);
      await this.locks.lock(userId, ...(previous ? [previous.userId] : []));
      await this.wallet.debit(userId, amount, 'auction:bid', auction.id);
      if (previous) await this.wallet.credit(previous.userId, previous.amount, 'auction:refund', auction.id);
      await this.auctions.recordBid(auction.id, userId, amount);
      await this.auctions.save(auction);
      if (previous) await this.events.publish(new AuctionOutbid(auction.id, previous.userId, auction.carId, amount));
      return { id, currentBid: auction.currentBid, minBid: auction.minBid(), endsAt: auction.endsAt, balance: await this.wallet.balance(userId) };
    });
  }

  cancel(userId: string, id: string) {
    return this.uow.run(async () => {
      const auction = await this.auctions.getForUpdate(id);
      auction.cancel(userId, this.clock.now());
      await this.locks.lock(userId);
      await this.cards.grant(userId, auction.carId);
      await this.auctions.save(auction);
      return { ok: true };
    });
  }

  /** Clôt les enchères échues (tâche de fond) : carte à l'acheteur, prix moins la commission au vendeur. */
  async settleDue() {
    const ids = await this.auctions.dueIds(this.clock.now(), 200);
    for (const id of ids) {
      try {
        await this.uow.run(async () => {
          const auction = await this.auctions.getForUpdate(id);
          if (!auction.isDue(this.clock.now())) return;
          const result = auction.settle(this.clock.now(), auctionRules);
          if (result.outcome === 'UNSOLD') {
            await this.locks.lock(result.sellerId);
            await this.cards.grant(result.sellerId, result.carId);
          } else {
            await this.locks.lock(result.sellerId, result.buyerId);
            await this.cards.grant(result.buyerId, result.carId);
            if (result.sellerProceeds > 0) await this.wallet.credit(result.sellerId, result.sellerProceeds, 'auction:sale', auction.id);
            await this.counters.add(result.buyerId, { auctionsWon: 1 });
            await this.counters.add(result.sellerId, { auctionsSold: 1 });
          }
          await this.auctions.save(auction);
          await this.events.publish(
            new AuctionSettled(
              auction.id,
              result.outcome === 'SOLD',
              result.sellerId,
              result.outcome === 'SOLD' ? result.buyerId : null,
              result.carId,
              result.outcome === 'SOLD' ? result.price : null,
            ),
          );
        });
      } catch (err) {
        this.logger.warn(`Règlement de l'enchère ${id} impossible : ${(err as Error).message}`);
      }
    }
  }
}
