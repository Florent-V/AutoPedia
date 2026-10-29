<?php

declare(strict_types=1);

namespace App\Bots\Command;

use App\Bots\Service\BotsService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/** Un tour de boucle des bots à la demande (pratique pour tester sans le worker). */
#[AsCommand(name: 'app:bots:tick', description: 'Crée les bots manquants et fait agir ceux dont le passage est dû')]
final class BotsTickCommand extends Command
{
    public function __construct(private readonly BotsService $bots)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $this->bots->tick();

        return Command::SUCCESS;
    }
}
