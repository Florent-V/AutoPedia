<?php

declare(strict_types=1);

namespace App\Marketplace\Service;

use App\Catalog\Domain\Rarity;
use App\Catalog\Repository\CarRepository;
use App\Catalog\View\CardView;
use App\Marketplace\Domain\ShopRotation;
use App\Marketplace\Dto\AuctionListFilter;
use App\Marketplace\Dto\TradeListFilter;
use App\Marketplace\Entity\Auction;
use App\Shared\Config\GameSettings;
use App\Shared\Domain\GameCalendar;
use App\Shared\Domain\Iso;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;

/**
 * Lectures du marché (CQRS léger) : SQL direct via DBAL, sans passer par les entités.
 * Les cartes sont ensuite chargées en une requête et mises en forme par CardView.
 */
final class MarketQueries
{
    private const PAGE_SIZE = 24;

    public function __construct(
        private readonly Connection $db,
        private readonly ShopService $shop,
        private readonly MarketAccess $access,
        private readonly CarRepository $cars,
        private readonly CardView $view,
        private readonly GameCalendar $calendar,
        private readonly GameSettings $settings,
    ) {
    }

    /** @return array<string, mixed> */
    public function shop(string $userId): array
    {
        $now = new \DateTimeImmutable();
        ['date' => $date, 'hour' => $hour, 'offers' => $offers] = $this->shop->currentOffers($now);
        $cars = $this->cars->byIds(array_column($offers, 'carId'));
        $bought = array_flip($this->db->fetchFirstColumn(
            'SELECT "offerKey" FROM "shop_purchase" WHERE "userId" = ? AND "offerKey" IN (?)',
            [$userId, array_column($offers, 'offerKey') ?: ['']],
            [1 => ArrayParameterType::STRING],
        ));
        $owned = $this->owned($userId);
        $nextRotation = $this->calendar->nextHour($now);
        $rules = [];
        foreach (Rarity::cases() as $r) {
            $rule = ShopRotation::rule($r);
            $rules[$r->value] = ['price' => $rule['price'], 'everyHours' => $rule['everyHours']];
        }

        return [
            'date' => $date,
            'hour' => $hour,
            'balance' => $this->balance($userId),
            'nextRotationAt' => Iso::format($nextRotation),
            'rules' => $rules,
            'offers' => array_map(fn (array $o) => [
                'offerKey' => $o['offerKey'],
                'price' => $o['price'],
                'basePrice' => $o['basePrice'],
                'deal' => $o['deal'],
                // Fin de l'offre : début de l'heure « untilHour » du jour (calculé depuis la prochaine rotation).
                'endsAt' => Iso::format($nextRotation->modify(\sprintf('%+d hours', $o['untilHour'] - $hour - 1))),
                'purchased' => isset($bought[$o['offerKey']]),
                'card' => $this->view->card($cars[$o['carId']]) + ['quantity' => $owned[$o['carId']] ?? 0],
            ], $offers),
        ];
    }

    /** @return array<string, mixed> */
    public function trades(string $userId, TradeListFilter $q): array
    {
        $where = ['t."status" = \'OPEN\'', 't."expiresAt" > now()', 'mine' === $q->tab ? 't."sellerId" = :user' : 't."sellerId" <> :user'];
        $params = ['user' => $userId];
        if ('forme' === $q->tab) {
            // Offres intéressantes : la carte proposée me manque, et je peux payer ou je possède la carte demandée.
            $where[] = 't."offeredCarId" NOT IN (SELECT "carId" FROM "user_card" WHERE "userId" = :user)';
            $where[] = '(t."wantedCarId" IN (SELECT "carId" FROM "user_card" WHERE "userId" = :user) OR t."price" <= (SELECT "credits" FROM "player" WHERE "userId" = :user))';
        }
        $this->carFilters($where, $params, $q->search, $q->rarity);
        $from = 'FROM "trade_offer" t JOIN "car" c ON c."id" = t."offeredCarId" JOIN "user" s ON s."id" = t."sellerId" LEFT JOIN "player" sp ON sp."userId" = t."sellerId" WHERE '.implode(' AND ', $where);

        $total = (int) $this->db->fetchOne("SELECT count(*) $from", $params);
        $rows = $this->db->fetchAllAssociative(
            "SELECT t.*, s.\"name\" AS \"sellerName\", COALESCE(sp.\"isBot\", false) AS \"sellerIsBot\" $from ORDER BY t.\"createdAt\" DESC LIMIT ".self::PAGE_SIZE.' OFFSET '.(($q->page - 1) * self::PAGE_SIZE),
            $params,
        );
        $cars = $this->cars->byIds([...array_column($rows, 'offeredCarId'), ...array_filter(array_column($rows, 'wantedCarId'))]);
        $owned = $this->owned($userId);
        $balance = $this->balance($userId);
        $card = fn (?int $id) => null === $id ? null : $this->view->card($cars[$id]) + ['quantity' => $owned[$id] ?? 0];

        return [
            'page' => $q->page,
            'pages' => max(1, (int) ceil($total / self::PAGE_SIZE)),
            'total' => $total,
            'balance' => $balance,
            'openLimit' => $this->settings->maxOpenTrades,
            'market' => $this->access->describe($userId, new \DateTimeImmutable()),
            'offers' => array_map(fn (array $o) => [
                'id' => $o['id'],
                'mine' => $o['sellerId'] === $userId,
                'seller' => $o['sellerName'],
                'sellerIsBot' => (bool) $o['sellerIsBot'],
                'createdAt' => self::iso($o['createdAt']),
                'expiresAt' => self::iso($o['expiresAt']),
                'price' => null === $o['price'] ? null : (int) $o['price'],
                'offered' => $card((int) $o['offeredCarId']),
                'wanted' => $card(null === $o['wantedCarId'] ? null : (int) $o['wantedCarId']),
                'canAccept' => $o['sellerId'] !== $userId
                    && (null !== $o['wantedCarId'] ? ($owned[(int) $o['wantedCarId']] ?? 0) > 0 : $balance >= (int) $o['price']),
            ], $rows),
        ];
    }

    /** @return array<string, mixed> */
    public function auctions(string $userId, AuctionListFilter $q): array
    {
        $where = ['a."status" = \'OPEN\'', 'a."endsAt" > now()'];
        $params = ['user' => $userId];
        if ('selling' === $q->tab) {
            $where[] = 'a."sellerId" = :user';
        } elseif ('bidding' === $q->tab) {
            $where[] = 'EXISTS (SELECT 1 FROM "bid" b WHERE b."auctionId" = a."id" AND b."userId" = :user)';
        }
        $this->carFilters($where, $params, $q->search, $q->rarity);
        $from = 'FROM "auction" a JOIN "car" c ON c."id" = a."carId"';
        $filter = ' WHERE '.implode(' AND ', $where);

        $total = (int) $this->db->fetchOne("SELECT count(*) $from $filter", $params);
        $rows = $this->db->fetchAllAssociative(
            'SELECT a.*, s."name" AS "sellerName", COALESCE(sp."isBot", false) AS "sellerIsBot", bu."name" AS "bidderName", COALESCE(bp."isBot", false) AS "bidderIsBot" '
            .$from.' JOIN "user" s ON s."id" = a."sellerId" LEFT JOIN "player" sp ON sp."userId" = a."sellerId"'
            .' LEFT JOIN "user" bu ON bu."id" = a."bidderId" LEFT JOIN "player" bp ON bp."userId" = a."bidderId"'
            .$filter.' ORDER BY a."endsAt" ASC LIMIT '.self::PAGE_SIZE.' OFFSET '.(($q->page - 1) * self::PAGE_SIZE),
            $params,
        );
        $cars = $this->cars->byIds(array_map('intval', array_column($rows, 'carId')));
        $owned = $this->owned($userId);

        return [
            'page' => $q->page,
            'pages' => max(1, (int) ceil($total / self::PAGE_SIZE)),
            'total' => $total,
            'balance' => $this->balance($userId),
            'feePercent' => $this->settings->auctionFeePercent,
            'durations' => $this->settings->auctionDurations,
            'openLimit' => $this->settings->maxOpenAuctions,
            'market' => $this->access->describe($userId, new \DateTimeImmutable()),
            'auctions' => array_map(function (array $a) use ($cars, $owned, $userId) {
                $currentBid = null === $a['currentBid'] ? null : (int) $a['currentBid'];

                return [
                    'id' => $a['id'],
                    'card' => $this->view->card($cars[(int) $a['carId']]) + ['quantity' => $owned[(int) $a['carId']] ?? 0],
                    'startPrice' => (int) $a['startPrice'],
                    'currentBid' => $currentBid,
                    'minBid' => Auction::minimumAfter((int) $a['startPrice'], $currentBid),
                    'bidCount' => (int) $a['bidCount'],
                    'endsAt' => self::iso($a['endsAt']),
                    'seller' => ['name' => $a['sellerName'], 'isBot' => (bool) $a['sellerIsBot']],
                    'bidder' => null === $a['bidderId'] ? null : ['name' => $a['bidderName'], 'isBot' => (bool) $a['bidderIsBot']],
                    'mine' => $a['sellerId'] === $userId,
                    'leading' => $a['bidderId'] === $userId,
                ];
            }, $rows),
        ];
    }

    /**
     * Filtres communs sur la carte (alias « c ») : recherche insensible à la casse, rareté effective.
     *
     * @param list<string>         $where
     * @param array<string, mixed> $params
     */
    private function carFilters(array &$where, array &$params, ?string $search, ?string $rarity): void
    {
        if ($search) {
            $where[] = '(c."name" ILIKE :search OR c."manufacturer" ILIKE :search)';
            $params['search'] = '%'.addcslashes($search, '%_\\').'%';
        }
        if ($rarity) {
            $where[] = 'COALESCE(c."rarityOverride", c."rarity")::text = :rarity';
            $params['rarity'] = $rarity;
        }
    }

    /** @return array<int, int> exemplaires possédés, par carte */
    private function owned(string $userId): array
    {
        return array_map('intval', $this->db->fetchAllKeyValue('SELECT "carId", "quantity" FROM "user_card" WHERE "userId" = ?', [$userId]));
    }

    private function balance(string $userId): int
    {
        return (int) $this->db->fetchOne('SELECT "credits" FROM "player" WHERE "userId" = ?', [$userId]);
    }

    private static function iso(string $timestamp): string
    {
        return Iso::format(new \DateTimeImmutable($timestamp, new \DateTimeZone('UTC')));
    }
}
