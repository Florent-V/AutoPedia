<?php

declare(strict_types=1);

namespace App\Collection\Entity;

use App\Catalog\Domain\Rarity;
use App\Collection\Domain\BoosterRules;
use App\Collection\Domain\BoosterStatus;
use App\Collection\Domain\Pity;
use App\Shared\Domain\Exception\RuleViolation;
use App\Shared\Domain\Guard;
use Doctrine\ORM\Mapping as ORM;

/**
 * Réserve de boosters d'un joueur : régénération dans le temps, ouverture, garanties Épique / Légendaire.
 * Le nombre de boosters n'est jamais fourni par le client : il est recalculé à partir de l'ancre et de l'heure.
 */
#[ORM\Embeddable]
class BoosterReserve
{
    #[ORM\Column]
    private int $boosters;

    #[ORM\Column]
    private \DateTimeImmutable $boosterAnchor;

    #[ORM\Column]
    private int $boostersOpened = 0;

    #[ORM\Column]
    private int $cardsObtained = 0;

    #[ORM\Column]
    private int $sinceEpic = 0;

    #[ORM\Column]
    private int $sinceLegendary = 0;

    public function __construct(int $boosters, \DateTimeImmutable $now)
    {
        $this->boosters = $boosters;
        $this->boosterAnchor = $now;
    }

    /**
     * Applique la régénération écoulée depuis l'ancre : un booster toutes les regenMs tant que la réserve
     * n'est pas pleine ; une fois pleine, le minuteur est figé (l'ancre suit l'heure courante).
     */
    public function status(\DateTimeImmutable $now, BoosterRules $rules): BoosterStatus
    {
        $boosters = $this->boosters;
        if ($boosters >= $rules->max) {
            return new BoosterStatus($boosters, $now, $rules->max, $rules->regenMs, null);
        }
        $elapsedMs = max(0, self::ms($now) - self::ms($this->boosterAnchor));
        $gained = intdiv($elapsedMs, $rules->regenMs);
        if ($boosters + $gained >= $rules->max) {
            return new BoosterStatus($rules->max, $now, $rules->max, $rules->regenMs, null);
        }
        $anchor = self::plusMs($this->boosterAnchor, $gained * $rules->regenMs);

        return new BoosterStatus($boosters + $gained, $anchor, $rules->max, $rules->regenMs, self::plusMs($anchor, $rules->regenMs));
    }

    public function pity(BoosterRules $rules): Pity
    {
        return Pity::for($this->sinceEpic, $this->sinceLegendary, $rules->pityEpic, $rules->pityLegendary);
    }

    /** Retire un booster de la réserve (après régénération) ; 409 si elle est vide. */
    public function consume(\DateTimeImmutable $now, BoosterRules $rules): BoosterStatus
    {
        $status = $this->status($now, $rules);
        if ($status->boosters <= 0) {
            throw new RuleViolation('Aucun booster disponible pour le moment');
        }
        // Ouvrir depuis une réserve pleine relance le minuteur maintenant.
        $anchor = $status->boosters >= $rules->max ? $now : $status->anchor;
        $this->boosters = $status->boosters - 1;
        $this->boosterAnchor = $anchor;

        return new BoosterStatus($this->boosters, $anchor, $rules->max, $rules->regenMs, self::plusMs($anchor, $rules->regenMs));
    }

    /**
     * Enregistre le contenu d'un booster ouvert : compteurs et remise à zéro des garanties obtenues.
     *
     * @param list<Rarity> $rarities
     */
    public function recordOpening(array $rarities): void
    {
        $legendary = \in_array(Rarity::LEGENDARY, $rarities, true);
        $epic = $legendary || \in_array(Rarity::EPIC, $rarities, true);
        ++$this->boostersOpened;
        $this->cardsObtained += \count($rarities);
        $this->sinceEpic = $epic ? 0 : $this->sinceEpic + 1;
        $this->sinceLegendary = $legendary ? 0 : $this->sinceLegendary + 1;
    }

    /** Offre des boosters (récompenses) : la réserve peut alors dépasser le maximum. */
    public function grant(int $count, \DateTimeImmutable $now, BoosterRules $rules): BoosterStatus
    {
        Guard::positiveInt($count, 'Nombre de boosters', 100);
        $status = $this->status($now, $rules);
        $this->boosters = $status->boosters + $count;
        $this->boosterAnchor = $status->anchor;

        return $this->status($now, $rules);
    }

    /** @return array{epicIn: int, legendaryIn: int} */
    public function pityCountdown(BoosterRules $rules): array
    {
        return [
            'epicIn' => max(1, $rules->pityEpic - $this->sinceEpic),
            'legendaryIn' => max(1, $rules->pityLegendary - $this->sinceLegendary),
        ];
    }

    public function boostersOpened(): int
    {
        return $this->boostersOpened;
    }

    public function cardsObtained(): int
    {
        return $this->cardsObtained;
    }

    private static function ms(\DateTimeImmutable $at): int
    {
        return (int) $at->format('Uv');
    }

    private static function plusMs(\DateTimeImmutable $at, int $ms): \DateTimeImmutable
    {
        $total = self::ms($at) + $ms;

        return \DateTimeImmutable::createFromFormat('U.u', \sprintf('%d.%06d', intdiv($total, 1000), ($total % 1000) * 1000))
            ->setTimezone($at->getTimezone());
    }
}
