<?php

declare(strict_types=1);

namespace App\Catalog\Entity;

use App\Catalog\Domain\Rarity;
use Doctrine\ORM\Mapping as ORM;

/** Une carte : un modèle de voiture réel, importé de Wikidata (ou du jeu de secours). */
#[ORM\Entity(repositoryClass: \App\Catalog\Repository\CarRepository::class)]
#[ORM\Table(name: 'car')]
#[ORM\HasLifecycleCallbacks]
class Car
{
    #[ORM\Id]
    #[ORM\GeneratedValue(strategy: 'IDENTITY')]
    #[ORM\Column]
    private ?int $id = null;

    /** QID Wikidata (« Q1234 ») ou « seed:… » pour le jeu de secours. */
    #[ORM\Column(type: 'text', unique: true)]
    private string $externalId;

    #[ORM\Column(type: 'text')]
    public string $name;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $manufacturer = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $country = null;

    #[ORM\Column(nullable: true)]
    public ?int $yearStart = null;

    #[ORM\Column(nullable: true)]
    public ?int $yearEnd = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $imageUrl = null;

    /** Nom du fichier Wikimedia Commons de la photo de référence. */
    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $imageFile = null;

    /** Copie locale (WebP), relative au dossier des médias. */
    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $imagePath = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $imageAuthor = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $imageLicense = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $imageLicenseUrl = null;

    #[ORM\Column(nullable: true)]
    public ?\DateTimeImmutable $imageCheckedAt = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $wikiTitle = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $wikiLang = null;

    #[ORM\Column(type: 'text', nullable: true)]
    public ?string $summary = null;

    #[ORM\Column(nullable: true)]
    public ?\DateTimeImmutable $summaryFetchedAt = null;

    #[ORM\Column(nullable: true)]
    public ?float $powerKw = null;

    #[ORM\Column(nullable: true)]
    public ?float $topSpeedKmh = null;

    #[ORM\Column(nullable: true)]
    public ?float $massKg = null;

    #[ORM\Column(nullable: true)]
    public ?int $lengthMm = null;

    #[ORM\Column]
    public bool $racing = false;

    /** Notoriété : nombre de Wikipédias qui consacrent un article au modèle. */
    #[ORM\Column]
    public int $popularity = 0;

    #[ORM\Column(type: 'rarity')]
    public Rarity $rarity = Rarity::COMMON;

    /** Rareté forcée par l'administrateur (prioritaire sur le calcul). */
    #[ORM\Column(type: 'rarity', nullable: true)]
    public ?Rarity $rarityOverride = null;

    #[ORM\Column]
    public bool $active = true;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(string $externalId, string $name)
    {
        $this->externalId = $externalId;
        $this->name = $name;
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = $this->createdAt;
    }

    #[ORM\PreUpdate]
    public function touch(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): int
    {
        return $this->id ?? throw new \LogicException('Carte non enregistrée');
    }

    public function getExternalId(): string
    {
        return $this->externalId;
    }

    public function attachToWikidata(string $qid): void
    {
        $this->externalId = $qid;
    }

    /** Rareté effective : la rareté forcée l'emporte sur le calcul. */
    public function effectiveRarity(): Rarity
    {
        return $this->rarityOverride ?? $this->rarity;
    }

    /** La photo de référence a changé : la copie locale et ses crédits sont à refaire. */
    public function resetLocalImage(): void
    {
        $this->imagePath = null;
        $this->imageAuthor = null;
        $this->imageLicense = null;
        $this->imageLicenseUrl = null;
        $this->imageCheckedAt = null;
    }
}
