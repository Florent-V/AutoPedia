import { InvalidRequest } from '../shared/domain/errors';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import webpush from 'web-push';
import { gameConfig } from '../config';
import { PrismaService } from '../shared/infrastructure/prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Services de notification des navigateurs. Le serveur envoie des requêtes à l'adresse fournie par le client :
 * on la limite à ces services pour qu'elle ne puisse pas viser une machine interne (SSRF).
 */
const PUSH_HOSTS = (process.env.PUSH_ALLOWED_HOSTS ??
  'fcm.googleapis.com,android.googleapis.com,updates.push.services.mozilla.com,.push.apple.com,.notify.windows.com')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function assertPushEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new InvalidRequest('Adresse de notification invalide');
  }
  const host = url.hostname.toLowerCase();
  const allowed = PUSH_HOSTS.some((h) => (h.startsWith('.') ? host.endsWith(h) : host === h));
  if (url.protocol !== 'https:' || url.port !== '' || url.username || !allowed) {
    throw new InvalidRequest('Service de notification non pris en charge');
  }
}

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private timer?: NodeJS.Timeout;
  private readonly publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
  private readonly privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
  readonly enabled = !!(this.publicKey && this.privateKey);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Notifications push désactivées (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents)');
      return;
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', this.publicKey, this.privateKey);
    const everyMs = Number(process.env.PUSH_CHECK_SECONDS ?? 60) * 1000;
    this.timer = setInterval(() => void this.notifyFullReserves().catch((e) => this.logger.error(e)), everyMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  getPublicKey() {
    return this.enabled ? this.publicKey : null;
  }

  async subscribe(userId: string, sub: { endpoint: string; p256dh: string; auth: string }, userAgent?: string) {
    assertPushEndpoint(sub.endpoint);
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, ...sub, userAgent: userAgent?.slice(0, 300) },
      update: { userId, p256dh: sub.p256dh, auth: sub.auth, userAgent: userAgent?.slice(0, 300) },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /**
   * Prévient les joueurs dont la réserve vient de se remplir (une seule fois par « remplissage »).
   * La mise à jour sert de verrou : un joueur n'est réclamé que par une seule exécution.
   */
  async notifyFullReserves() {
    const max = gameConfig.boosterMax;
    const regenSec = gameConfig.boosterRegenMs / 1000;
    const players = await this.prisma.$queryRaw<Array<{ userId: string }>>`
      UPDATE "player" p SET "fullNotifiedAnchor" = p."boosterAnchor"
      WHERE p."boosters" < ${max}
        AND p."boosterAnchor" + make_interval(secs => (${max} - p."boosters") * ${regenSec}::float8) <= now()
        AND (p."fullNotifiedAnchor" IS NULL OR p."fullNotifiedAnchor" <> p."boosterAnchor")
        AND EXISTS (SELECT 1 FROM "push_subscription" s WHERE s."userId" = p."userId")
      RETURNING p."userId"`;

    for (const { userId } of players) {
      await this.sendToUser(userId, {
        title: 'Ta réserve est pleine 🎁',
        body: `${max} boosters t'attendent au garage. Ouvre-les pour relancer le compteur !`,
        url: '/boosters',
        tag: 'boosters-full',
      });
    }
  }

  async sendToUser(userId: string, payload: PushPayload) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 6 * 3600, timeout: 10_000 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
          } else {
            this.logger.warn(`Échec d'envoi push (${status ?? 'réseau'})`);
          }
        }
      }),
    );
  }
}
