import { Module } from '@nestjs/common';
import { RaffleService } from './raffle.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JsonRpcProvider, Wallet } from 'ethers';

@Module({
  imports: [ConfigModule],
  providers: [
    RaffleService,
    {
      provide: JsonRpcProvider,
      useFactory: (configService: ConfigService) => {
        return new JsonRpcProvider(configService.get<string>('RPC_URL'));
      },
      inject: [ConfigService],
    },
    {
      provide: Wallet,
      useFactory: (provider: JsonRpcProvider, configService: ConfigService) => {
        return new Wallet(
          configService.get<string>('ADMIN_PRIVATE_KEY'),
          provider,
        );
      },
      inject: [JsonRpcProvider, ConfigService],
    },
  ],
  exports: [RaffleService],
})
export class RaffleModule {}
