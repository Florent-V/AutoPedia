<?php

declare(strict_types=1);

namespace App\Bots\Service;

use App\Bots\Domain\BotBrain;
use App\Bots\Domain\BotProfile;
use App\Bots\Domain\CardFacts;
use App\Catalog\Repository\CarRepository;
use App\Collection\Service\BoostersService;
use App\Identity\Entity\User;
use App\Marketplace\Entity\Auction;
use App\Marketplace\Service\AuctionsService;
use App\Marketplace\Service\TradesService;
use App\Player\Repository\PlayerRepository;
use App\Player\Service\PlayerProvisioning;
use App\Progression\Service\DailyRewardService;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\GameCalendar;
use App\Shared\Domain\Random;
use App\Shared\Domain\Shuffle;
use App\Shared\Transaction\UnitOfWork;
use App\Wallet\Domain\LedgerReason;
use App\Wallet\Service\WalletService;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Joueurs simulés (voir docs/fonctionnel/13-bots.md) : ils passent par les mêmes services que les joueurs. */
final class BotsService
{
    /** Bots traités au plus par tour de boucle. */
    private const PER_TICK = 4;

    private readonly BotBrain $brain;
    private readonly int $count;

    public function __construct(
        private readonly Connection $db,
        private readonly EntityManagerInterface $em,
        private readonly UnitOfWork $uow,
        private readonly PlayerRepository $players,
        private readonly PlayerProvisioning $provisioning,
        private readonly CarRepository $cars,
        private readonly BoostersService $boosters,
        private readonly DailyRewardService $daily,
        private readonly AuctionsService $auctions,
        private readonly TradesService $trades,
        private readonly WalletService $wallet,
        private readonly GameSettings $settings,
        private readonly GameCalendar $calendar,
        private readonly Random $random,
        private readonly LoggerInterface $logger,
        #[Autowire(env: 'bool:BOTS_ENABLED')] public readonly bool $enabled,
        #[Autowire(env: 'int:BOTS_COUNT')] int $count,
        #[Autowire(env: 'int:BOTS_START_CREDITS')] private readonly int $startCredits,
    ) {
        $this->brain = new BotBrain($random);
        $this->count = min(max(0, $count), \count(BotBrain::NAMES));
    }

    /** Un tour de boucle : crée les bots manquants, puis fait agir ceux dont le passage est dû. */
    public function tick(): void
    {
        if (!$this->enabled || 0 === $this->count || 0 === $this->cars->activeCount()) {
            return; // pas de catalogue, rien à faire
        }
        $this->ensureBots();
        $due = $this->db->fetchAllAssociative(
            'SELECT "userId", "botProfile" FROM "player" WHERE "isBot" AND ("botNextActionAt" IS NULL OR "botNextActionAt" <= now())
             ORDER BY "botNextActionAt" ASC NULLS FIRST LIMIT '.self::PER_TICK,
        );
        foreach ($due as $bot) {
            $profile = BotProfile::fromArray(json_decode($bot['botProfile'], true, 8, \JSON_THROW_ON_ERROR));
            try {
                $this->act($bot['userId'], $profile);
            } catch (\Throwable $e) {
                $this->logger->warning(\sprintf('Bot %s : %s', $bot['userId'], $e->getMessage()));
            }
            $this->em->clear(); // repartir d'un état propre pour chaque bot
            $this->uow->run(fn () => $this->players->lock($bot['userId'])[$bot['userId']]->scheduleBot($this->nextAction($profile)));
        }
    }

    /** Prochain passage : irrégulier, et beaucoup plus espacé la nuit (heure du jeu). */
    private function nextAction(BotProfile $profile): \DateTimeImmutable
    {
        $hour = $this->calendar->hour(new \DateTimeImmutable());
        $night = $hour >= 1 && $hour < 7 ? 4 : 1;
        $seconds = (int) round($profile->activityMinutes * $this->rand(0.5, 1.5) * $night * 60);

        return new \DateTimeImmutable("+$seconds seconds");
    }

    private function ensureBots(): void
    {
        $existing = (int) $this->db->fetchOne('SELECT count(*) FROM "player" WHERE "isBot"');
        if ($existing >= $this->count) {
            return;
        }
        $brands = $this->db->fetchFirstColumn('SELECT DISTINCT "manufacturer" FROM "car" WHERE "active" AND "manufacturer" IS NOT NULL LIMIT 200');
        $taken = $this->db->fetchFirstColumn('SELECT "name" FROM "user" WHERE "name" IN (?)', [BotBrain::NAMES], [ArrayParameterType::STRING]);
        $free = array_slice(array_values(array_diff(BotBrain::NAMES, $taken)), 0, $this->count - $existing);
        foreach ($free as $name) {
            $style = Shuffle::pick(array_keys(BotProfile::STYLE_PRESETS), $this->random);
            $profile = BotProfile::create(
                $style,
                (int) round($this->rand(10, 45)),
                $brands && $this->random->next() < 0.7 ? Shuffle::pick($brands, $this->random) : null,
                $this->random->next() < 0.3,
            );
            $id = 'bot_'.bin2hex(random_bytes(12));
            // Pas de compte de connexion (table account) : un bot ne peut pas se connecter.
            $this->em->persist(new User($id, $name, "$id@bots.garage.invalid", new \DateTimeImmutable()));
            $this->em->flush();
            $this->provisioning->ensure($id);
            $this->uow->run(function () use ($id, $profile) {
                $player = $this->players->lock($id)[$id];
                // Arrivées échelonnées sur l'heure qui suit.
                $player->becomeBot($profile->toArray(), new \DateTimeImmutable('+'.(int) $this->rand(0, 3600).' seconds'));
                // Dotation de départ au-delà des crédits de bienvenue : passe par le portefeuille (journal).
                $bonus = $this->startCredits - $this->settings->startingCredits;
                if ($bonus > 0) {
                    $this->wallet->credit($id, $bonus, LedgerReason::BOT_ENDOWMENT);
                }
            });
            $this->logger->info(\sprintf('Bot créé : %s (%s%s)', $name, $style, $profile->favoriteBrand ? ', fan de '.$profile->favoriteBrand : ''));
        }
    }

    /** Un passage d'un bot. Chaque étape est indépendante : l'échec de l'une n'empêche pas les autres. */
    private function act(string $botId, BotProfile $profile): void
    {
        foreach (['claimDaily', 'openBoosters', 'browseAuctions', 'browseTrades', 'sellDuplicate'] as $step) {
            try {
                $this->{$step}($botId, $profile);
            } catch (\Throwable $e) {
                $this->logger->debug(\sprintf('Bot %s, %s : %s', $botId, $step, $e->getMessage()));
            }
        }
    }

    /** Récompense du jour + crédits simulant ses parties de mini-jeux (une fois par jour). */
    private function claimDaily(string $botId): void
    {
        if (!$this->daily->status($botId)['canClaim']) {
            return;
        }
        $this->daily->claim($botId);
        $income = (int) round($this->rand(80, 320));
        $this->uow->run(function () use ($botId, $income) {
            $this->players->lock($botId);
            $this->wallet->credit($botId, $income, LedgerReason::BOT_GAMES);
        });
    }

    private function openBoosters(string $botId): void
    {
        $n = min($this->boosters->status($botId)['available'], (int) ceil($this->rand(0, 3)));
        for ($i = 0; $i < $n; ++$i) {
            $this->boosters->open($botId);
        }
    }

    /** Parcourt les enchères (les plus proches de la fin d'abord) et enchérit parfois, selon sa valeur estimée. */
    private function browseAuctions(string $botId, BotProfile $profile): void
    {
        $open = $this->db->fetchAllAssociative(
            'SELECT a."id", a."carId", a."startPrice", a."currentBid", a."endsAt", COALESCE(sp."isBot", false) AS "sellerIsBot"
             FROM "auction" a LEFT JOIN "player" sp ON sp."userId" = a."sellerId"
             WHERE a."status" = \'OPEN\' AND a."endsAt" > now() AND a."sellerId" <> :bot AND (a."bidderId" IS NULL OR a."bidderId" <> :bot)
             ORDER BY a."endsAt" ASC LIMIT 8',
            ['bot' => $botId],
        );
        if (!$open) {
            return;
        }
        $cars = $this->cars->byIds(array_map('intval', array_column($open, 'carId')));
        $qty = $this->owned($botId);
        $budget = $this->balance($botId) * 0.6; // garde une réserve
        $bids = 0;
        foreach ($open as $a) {
            if ($bids >= 2) {
                break;
            }
            $carId = (int) $a['carId'];
            $value = $this->brain->valuation($profile, CardFacts::of($cars[$carId]), $qty[$carId] ?? 0);
            $msLeft = (int) ((new \DateTimeImmutable($a['endsAt'], new \DateTimeZone('UTC')))->format('Uv') - (new \DateTimeImmutable())->format('Uv'));
            $min = Auction::minimumAfter((int) $a['startPrice'], null === $a['currentBid'] ? null : (int) $a['currentBid']);
            $amount = $this->brain->decideBid($profile, $value, $min, $msLeft, (bool) $a['sellerIsBot']);
            if (null === $amount || $amount > $budget) {
                continue;
            }
            try {
                $this->auctions->bid($botId, $a['id'], $amount);
                ++$bids;
                $budget -= $amount;
            } catch (\Throwable) {
                // surenchéri entre-temps, enchère close… on passe
            }
        }
    }

    /** Parcourt la bourse et accepte les échanges avantageux pour lui (en priorité ceux des joueurs). */
    private function browseTrades(string $botId, BotProfile $profile): void
    {
        $offers = $this->db->fetchAllAssociative(
            'SELECT t."id", t."offeredCarId", t."wantedCarId", t."price", COALESCE(sp."isBot", false) AS "sellerIsBot"
             FROM "trade_offer" t LEFT JOIN "player" sp ON sp."userId" = t."sellerId"
             WHERE t."status" = \'OPEN\' AND t."expiresAt" > now() AND t."sellerId" <> :bot
             ORDER BY t."createdAt" DESC LIMIT 10',
            ['bot' => $botId],
        );
        if (!$offers) {
            return;
        }
        $cars = $this->cars->byIds(array_map('intval', [...array_column($offers, 'offeredCarId'), ...array_filter(array_column($offers, 'wantedCarId'))]));
        $qty = $this->owned($botId);
        $credits = $this->balance($botId);
        foreach ($offers as $o) {
            if ($o['sellerIsBot'] && $this->random->next() < 0.7) {
                continue; // surtout les offres des joueurs
            }
            $offeredId = (int) $o['offeredCarId'];
            $offeredValue = $this->brain->valuation($profile, CardFacts::of($cars[$offeredId]), $qty[$offeredId] ?? 0);
            $ok = false;
            if (null !== $o['price']) {
                $ok = (int) $o['price'] <= $credits * 0.6 && $this->brain->acceptsPriceOffer($profile, $offeredValue, (int) $o['price']);
            } elseif (null !== $o['wantedCarId'] && isset($cars[(int) $o['wantedCarId']])) {
                $wantedQty = $qty[(int) $o['wantedCarId']] ?? 0;
                $wantedValue = $this->brain->valuation($profile, CardFacts::of($cars[(int) $o['wantedCarId']]), $wantedQty - 1);
                $ok = $this->brain->acceptsSwap($profile, $offeredValue, $wantedValue, $wantedQty);
            }
            if ($ok) {
                try {
                    $this->trades->accept($botId, $o['id']);
                } catch (\Throwable) {
                }

                return; // un échange par passage
            }
        }
    }

    /** Met parfois un doublon en vente : aux enchères (souvent) ou à la bourse. */
    private function sellDuplicate(string $botId, BotProfile $profile): void
    {
        if ($this->random->next() > $profile->sellChance) {
            return;
        }
        $dupes = $this->db->fetchFirstColumn('SELECT "carId" FROM "user_card" WHERE "userId" = ? AND "quantity" >= 2 LIMIT 30', [$botId]);
        if (!$dupes) {
            return;
        }
        $car = $this->cars->find((int) Shuffle::pick($dupes, $this->random));
        $facts = CardFacts::of($car);
        $openAuctions = (int) $this->db->fetchOne('SELECT count(*) FROM "auction" WHERE "sellerId" = ? AND "status" = \'OPEN\'', [$botId]);
        $openTrades = (int) $this->db->fetchOne('SELECT count(*) FROM "trade_offer" WHERE "sellerId" = ? AND "status" = \'OPEN\'', [$botId]);
        if ($openAuctions < 2 && $this->random->next() < 0.7) {
            $this->auctions->create($botId, $car->getId(), $this->brain->auctionStartPrice($facts), Shuffle::pick([1, 3, 3, 6, 12], $this->random));
        } elseif ($openTrades < 2) {
            $this->trades->create($botId, $car->getId(), null, $this->brain->tradeAskPrice($profile, $facts));
        }
    }

    /** @return array<int, int> */
    private function owned(string $botId): array
    {
        return array_map('intval', $this->db->fetchAllKeyValue('SELECT "carId", "quantity" FROM "user_card" WHERE "userId" = ?', [$botId]));
    }

    private function balance(string $botId): int
    {
        return (int) $this->db->fetchOne('SELECT "credits" FROM "player" WHERE "userId" = ?', [$botId]);
    }

    private function rand(float $min, float $max): float
    {
        return $min + $this->random->next() * ($max - $min);
    }
}
