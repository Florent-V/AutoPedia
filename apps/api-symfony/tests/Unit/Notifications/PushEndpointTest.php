<?php

declare(strict_types=1);

namespace App\Tests\Unit\Notifications;

use App\Notifications\Domain\PushEndpoint;
use App\Shared\Domain\Exception\InvalidRequest;
use PHPUnit\Framework\TestCase;

final class PushEndpointTest extends TestCase
{
    private PushEndpoint $policy;

    protected function setUp(): void
    {
        $this->policy = new PushEndpoint('fcm.googleapis.com,android.googleapis.com,updates.push.services.mozilla.com,.push.apple.com,.notify.windows.com');
    }

    public function testAccepteLesServicesDeNotificationDesNavigateurs(): void
    {
        foreach ([
            'https://fcm.googleapis.com/fcm/send/abc',
            'https://updates.push.services.mozilla.com/wpush/v2/abc',
            'https://web.push.apple.com/abc',
            'https://wns2-par02p.notify.windows.com/w/?token=abc',
        ] as $url) {
            $this->policy->assertAllowed($url);
            $this->addToAssertionCount(1);
        }
    }

    public function testRefuseToutAutreAdresse(): void
    {
        foreach ([
            'http://fcm.googleapis.com/fcm/send/abc',
            'https://localhost/x',
            'https://127.0.0.1/x',
            'https://db:5432/x',
            'https://fcm.googleapis.com.evil.com/x',
            'https://evilpush.apple.com.attacker.net/x',
            'https://fcm.googleapis.com:8443/x',
            'https://user@fcm.googleapis.com/x',
            'pas une url',
        ] as $url) {
            try {
                $this->policy->assertAllowed($url);
                self::fail("Adresse acceptée à tort : $url");
            } catch (InvalidRequest) {
                $this->addToAssertionCount(1);
            }
        }
    }
}
