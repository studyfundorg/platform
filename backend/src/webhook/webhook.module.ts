import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { RaffleModule } from '../raffle/raffle.module';

@Module({
  imports: [FirebaseModule, RaffleModule],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
