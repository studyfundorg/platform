import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WebhookModule } from './webhook/webhook.module';
import { FirebaseModule } from './firebase/firebase.module';
import { RaffleModule } from './raffle/raffle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    WebhookModule,
    FirebaseModule,
    RaffleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
