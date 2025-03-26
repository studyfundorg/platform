import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
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
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: parseInt(process.env.REDIS_DB || '0'),
      },
      prefix: process.env.QUEUE_PREFIX || 'studyfund:bull',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
    WebhookModule,
    FirebaseModule,
    RaffleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
