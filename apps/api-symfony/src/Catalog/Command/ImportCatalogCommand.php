<?php

declare(strict_types=1);

namespace App\Catalog\Command;

use App\Catalog\Repository\CarRepository;
use App\Catalog\Service\CatalogImporter;
use App\Catalog\Service\MediaSync;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Équivalent de « node dist/cli/import-catalog » du backend NestJS. */
#[AsCommand(name: 'app:catalog:import', description: 'Importe le catalogue (wikidata | seed | media | stats)')]
final class ImportCatalogCommand extends Command
{
    public function __construct(
        private readonly CatalogImporter $importer,
        private readonly MediaSync $media,
        private readonly CarRepository $cars,
        #[Autowire(env: 'int:CATALOG_IMPORT_LIMIT')] private readonly int $defaultLimit,
        #[Autowire(env: 'MEDIA_SYNC')] private readonly string $mediaSync,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('mode', InputArgument::OPTIONAL, 'wikidata, seed, media ou stats', 'wikidata')
            ->addArgument('limit', InputArgument::OPTIONAL, 'Nombre maximal de voitures')
            ->addOption('no-media', null, InputOption::VALUE_NONE, 'Ne pas rapatrier photos et résumés')
            ->addOption('if-empty', null, InputOption::VALUE_NONE, 'N’importer que si le catalogue est vide (démarrage du conteneur)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $mode = $input->getArgument('mode');
        if (!\in_array($mode, ['wikidata', 'seed', 'media', 'stats'], true)) {
            $io->error("Mode inconnu : $mode");

            return Command::INVALID;
        }
        // Au démarrage (comme NestJS) : import seulement si le catalogue est vide, sinon reprise des médias.
        $skip = $input->getOption('if-empty') && $this->cars->activeCount() > 0;
        if (!$skip && ('wikidata' === $mode || 'seed' === $mode)) {
            $limit = max(1, min(20_000, (int) ($input->getArgument('limit') ?? $this->defaultLimit)));
            $io->success('Résultat : '.json_encode($this->importer->import($mode, $limit)));
        }
        $withMedia = 'stats' !== $mode && !$input->getOption('no-media') && 'off' !== $this->mediaSync;
        if ($withMedia) {
            $this->media->syncAll();
        }
        $io->writeln('État : '.json_encode($this->media->stats()));

        return Command::SUCCESS;
    }
}
