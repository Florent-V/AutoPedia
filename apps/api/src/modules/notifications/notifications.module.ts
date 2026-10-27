import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationHandlers } from './application/notification.handlers';
import { PushService } from './application/push.service';
import { PushController } from './http/push.controller';

/** Contexte « Notifications » : abonnements Web Push, réserve pleine, événements du marché. */
@Module({
  imports: [CatalogModule],
  controllers: [PushController],
  providers: [PushService, NotificationHandlers],
  exports: [PushService],
})
export class NotificationsModule {}
