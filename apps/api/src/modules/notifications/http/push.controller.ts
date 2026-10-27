import { Body, Controller, Get, Headers, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUrl, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../../../auth/auth.guard';
import { PushService } from '../application/push.service';

class PushKeys {
  @IsString() @MaxLength(200) p256dh: string;
  @IsString() @MaxLength(100) auth: string;
}

class SubscribeDto {
  @IsUrl({ protocols: ['https'], require_tld: false }) @MaxLength(1000) endpoint: string;
  @ValidateNested() @Type(() => PushKeys) keys: PushKeys;
  /** Envoyé par les anciennes versions de l'application (PushSubscription.toJSON) ; ignoré. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() expirationTime?: number | null;
}

class UnsubscribeDto {
  @IsString() @MaxLength(1000) endpoint: string;
}

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Public()
  @Get('public-key')
  publicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(204)
  async subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto, @Headers('user-agent') ua?: string) {
    if (!this.push.enabled) throw new ServiceUnavailableException('Notifications non configurées sur ce serveur');
    await this.push.subscribe(user.id, { endpoint: dto.endpoint, ...dto.keys }, ua);
  }

  @Post('unsubscribe')
  @HttpCode(204)
  async unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    await this.push.unsubscribe(user.id, dto.endpoint);
  }

  @Post('test')
  @HttpCode(204)
  async test(@CurrentUser() user: AuthUser) {
    if (!this.push.enabled) throw new ServiceUnavailableException('Notifications non configurées sur ce serveur');
    await this.push.sendToUser(user.id, { title: 'Garage', body: 'Les notifications fonctionnent 👌', url: '/boosters', tag: 'test' });
  }
}
