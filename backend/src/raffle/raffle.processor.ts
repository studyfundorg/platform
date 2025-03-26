import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RaffleService } from './raffle.service';

@Processor('raffle')
export class RaffleProcessor {
  private readonly logger = new Logger(RaffleProcessor.name);

  constructor(private readonly raffleService: RaffleService) {}

  @Process('processWinnerSelection')
  async handleWinnerSelection(job: Job<{ raffleId: string }>) {
    try {
      this.logger.log(`Processing winner selection for raffle ${job.data.raffleId}`);
      await this.raffleService.processWinnerSelection(job.data.raffleId);
      this.logger.log(`Successfully processed winner selection for raffle ${job.data.raffleId}`);
    } catch (error) {
      this.logger.error(
        `Error processing winner selection for raffle ${job.data.raffleId}:`,
        error.stack,
      );
      throw error;
    }
  }
} 