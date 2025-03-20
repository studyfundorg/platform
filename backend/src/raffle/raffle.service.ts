import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Contract, Wallet } from 'ethers';
import { studyFundAbi } from '../config/contracts';

@Injectable()
export class RaffleService implements OnModuleInit {
  private readonly logger = new Logger(RaffleService.name);
  private studyFundContract: Contract;

  constructor(private readonly adminWallet: Wallet) {}

  async onModuleInit() {
    this.studyFundContract = new Contract(
      process.env.STUDY_FUND_ADDRESS,
      studyFundAbi,
      this.adminWallet,
    );
  }

  async processWinnerSelection(raffleId: string) {
    try {
      const raffle = await this.studyFundContract.raffles(raffleId);

      if (raffle.completed) {
        this.logger.log(`Raffle ${raffleId} is already completed`);
        return;
      }

      const totalEntries =
        await this.studyFundContract.raffleTotalEntries(raffleId);
      if (totalEntries.eq(0)) {
        this.logger.warn(
          `Raffle ${raffleId} has no entries, skipping winner selection`,
        );
        return;
      }

      const tx = await this.studyFundContract.selectWinners();
      await tx.wait();

      this.logger.log(`Successfully selected winners for raffle ${raffleId}`);

      // Get and log the winners
      const winners = await this.studyFundContract.getRaffleWinners(raffleId);
      this.logger.log(`Winners selected: ${winners.join(', ')}`);
    } catch (error) {
      this.logger.error(
        `Error selecting winners for raffle ${raffleId}:`,
        error,
      );
      throw error;
    }
  }

  async getCurrentRaffle() {
    const currentRaffleId = await this.studyFundContract.currentRaffleId();
    return {
      id: currentRaffleId,
      ...(await this.studyFundContract.raffles(currentRaffleId)),
    };
  }

  async getRaffleWinners(raffleId: bigint) {
    return this.studyFundContract.getRaffleWinners(raffleId);
  }

  async getRaffleRunnerUps(raffleId: bigint) {
    return this.studyFundContract.getRaffleRunnerUps(raffleId);
  }
}
