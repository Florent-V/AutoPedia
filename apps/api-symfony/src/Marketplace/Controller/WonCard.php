<?php

declare(strict_types=1);

namespace App\Marketplace\Controller;

use App\Catalog\Repository\CarRepository;
use App\Catalog\View\CardView;

/** Carte gagnée, telle qu'affichée : vue du catalogue + exemplaires possédés. */
final readonly class WonCard
{
    public function __construct(private CarRepository $cars, private CardView $view)
    {
    }

    /** @param array{carId: int, quantity: int, isNew: bool} $won */
    public function __invoke(array $won): ?array
    {
        $car = $this->cars->find($won['carId']);

        return $car ? $this->view->card($car) + ['quantity' => $won['quantity'], 'isNew' => $won['isNew']] : null;
    }
}
