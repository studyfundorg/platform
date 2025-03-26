import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Contract, id, Wallet } from 'ethers';
import { studyFundAbi } from '../config/contracts';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class RaffleService implements OnModuleInit {
  private readonly logger = new Logger(RaffleService.name);
  private studyFundContract: Contract;

  constructor(
    private readonly adminWallet: Wallet,
    @InjectQueue('raffle') private readonly raffleQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing RaffleService...');

    this.studyFundContract = new Contract(
      process.env.STUDY_FUND_ADDRESS,
      studyFundAbi,
      this.adminWallet,
    );

    this.initializeRaffleState().catch((error) => {
      this.logger.error('Error initializing raffle state:', error);
      process.exit(1);
    });
  }

  private async initializeRaffleState() {
    try {
      const currentRaffleId = await this.studyFundContract.currentRaffleId();
      this.logger.log(`Current raffle ID from chain: ${currentRaffleId}`);

      const raffle = await this.studyFundContract.raffles(currentRaffleId);
      const endTimeMs = BigInt(raffle.endTime) * BigInt(1000);
      const currentTime = BigInt(Date.now());

      this.logger.debug(`Raffle state:`, {
        raffleId: currentRaffleId.toString(),
        completed: raffle.completed,
        endTime: new Date(Number(endTimeMs)).toISOString(),
        currentTime: new Date(Number(currentTime)).toISOString(),
      });

      // Check if raffle has ended but not completed
      if (!raffle.completed && endTimeMs <= currentTime) {
        this.logger.log(
          `Raffle ${currentRaffleId} has ended but not completed. Processing winners immediately.`,
        );
        await this.processWinnerSelection(currentRaffleId.toString());
        return;
      }

      // Check if raffle is still active
      if (!raffle.completed && endTimeMs > currentTime) {
        const isQueued = await this.isRaffleQueued(currentRaffleId.toString());
        if (!isQueued) {
          this.logger.log(
            `Queueing winner selection for active raffle ${currentRaffleId}`,
            {
              endTime: new Date(Number(endTimeMs)).toISOString(),
              currentTime: new Date(Number(currentTime)).toISOString(),
              delayMs: (endTimeMs - currentTime).toString(),
            },
          );
          await this.queueWinnerSelection(
            currentRaffleId.toString(),
            endTimeMs.toString(),
          );
        } else {
          this.logger.log(
            `Raffle ${currentRaffleId} is already queued for processing`,
          );
        }
      }

      // Check previous raffles that might need processing
      await this.checkPreviousRaffles(currentRaffleId);
    } catch (error) {
      this.logger.error(`Error initializing raffle state:`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async checkPreviousRaffles(currentRaffleId: bigint) {
    try {
      // Check the previous raffle
      const previousRaffleId = currentRaffleId - BigInt(1);
      const previousRaffle =
        await this.studyFundContract.raffles(previousRaffleId);

      this.logger.debug(`Checking previous raffle:`, {
        raffleId: previousRaffleId.toString(),
        completed: previousRaffle.completed,
        endTime: new Date(Number(previousRaffle.endTime) * 1000).toISOString(),
      });

      if (!previousRaffle.completed) {
        const isQueued = await this.isRaffleQueued(previousRaffleId.toString());
        if (!isQueued) {
          this.logger.log(
            `Previous raffle ${previousRaffleId} is not completed and not queued. Processing immediately.`,
          );
          await this.processWinnerSelection(previousRaffleId.toString());
        }
      }
    } catch (error) {
      this.logger.error(`Error checking previous raffles:`, {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  private async isRaffleQueued(raffleId: string): Promise<boolean> {
    const jobs = await this.raffleQueue.getJobs(['delayed', 'waiting']);
    return jobs.some((job) => job.data.raffleId === raffleId);
  }

  async processWinnerSelection(raffleId: string) {
    try {
      this.logger.log(
        `Starting winner selection process for raffle ${raffleId}`,
      );

      const raffle = await this.studyFundContract.raffles(raffleId);
      this.logger.debug(`Raffle data:`, {
        raffleId,
        completed: raffle.completed,
        endTime: new Date(Number(raffle.endTime) * 1000).toISOString(),
      });

      if (raffle.completed) {
        this.logger.log(
          `Raffle ${raffleId} is already completed, skipping winner selection`,
        );
        return;
      }

      const totalEntries =
        await this.studyFundContract.raffleTotalEntries(raffleId);
      this.logger.debug(
        `Total entries for raffle ${raffleId}: ${totalEntries.toString()}`,
      );

      if (totalEntries.eq(0)) {
        this.logger.warn(
          `Raffle ${raffleId} has no entries, skipping winner selection`,
        );
        return;
      }

      this.logger.log(`Selecting winners for raffle ${raffleId}`);
      const tx = await this.studyFundContract.selectWinners();
      this.logger.debug(`Transaction sent: ${tx.hash}`);

      await tx.wait();
      this.logger.log(`Transaction confirmed: ${tx.hash}`);

      // Get and log the winners
      const winners = await this.studyFundContract.getRaffleWinners(raffleId);
      this.logger.log(`Winners selected for raffle ${raffleId}:`, {
        winners: winners.map((w) => w.toString()),
        count: winners.length,
      });
    } catch (error) {
      this.logger.error(`Error selecting winners for raffle ${raffleId}:`, {
        error: error.message,
        stack: error.stack,
      });
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

  async handleRaffleHook(raffleData: any): Promise<void> {
    try {
      const { id, completed, endTime } = raffleData;

      this.logger.debug(`Processing raffle hook for raffle ${id}`, {
        completed,
        endTime: new Date(Number(endTime) * 1000).toISOString(),
        currentTime: new Date().toISOString(),
      });

      // Convert endTime from seconds to milliseconds
      const endTimeMs = BigInt(endTime) * BigInt(1000);
      const currentTime = BigInt(Date.now());

      this.logger.debug(`Timestamp comparison:`, {
        endTimeMs: endTimeMs.toString(),
        currentTime: currentTime.toString(),
        isEnded: endTimeMs <= currentTime,
      });

      if (!completed && endTimeMs <= currentTime) {
        this.logger.log(
          `Raffle ${id} has ended but not completed. Processing winners immediately.`,
          {
            endTime: new Date(Number(endTimeMs)).toISOString(),
            currentTime: new Date(Number(currentTime)).toISOString(),
          },
        );
        await this.processWinnerSelection(id.toString());
        return;
      }

      if (completed) {
        // Get current raffle ID from chain
        const currentRaffleId = await this.studyFundContract.currentRaffleId();

        this.logger.debug(`Completed raffle check:`, {
          raffleId: id,
          currentRaffleId: currentRaffleId.toString(),
          isNextRaffle: currentRaffleId > BigInt(id),
        });

        if (currentRaffleId > BigInt(id)) {
          this.logger.log(
            `Raffle ${id} is completed and current raffle ID (${currentRaffleId}) is greater. Queueing next raffle.`,
          );
          await this.queueWinnerSelection(id.toString(), endTimeMs.toString());
        }
      } else if (endTimeMs > currentTime) {
        this.logger.log(
          `New raffle ${id} detected. Queueing winner selection for end time.`,
          {
            endTime: new Date(Number(endTimeMs)).toISOString(),
            currentTime: new Date(Number(currentTime)).toISOString(),
            delayMs: (endTimeMs - currentTime).toString(),
          },
        );
        await this.queueWinnerSelection(id.toString(), endTimeMs.toString());
      }
    } catch (error) {
      this.logger.error(
        `Error handling raffle hook for raffle ${raffleData.id}:`,
        {
          error: error.message,
          stack: error.stack,
          raffleData,
        },
      );
      throw error;
    }
  }

  private async queueWinnerSelection(
    raffleId: string,
    endTimeMs: string,
  ): Promise<void> {
    const delay = BigInt(endTimeMs) - BigInt(Date.now());

    this.logger.debug(`Queueing winner selection:`, {
      raffleId,
      endTime: new Date(Number(endTimeMs)).toISOString(),
      currentTime: new Date().toISOString(),
      delayMs: delay.toString(),
    });

    if (delay > BigInt(0)) {
      const job = await this.raffleQueue.add(
        'processWinnerSelection',
        { raffleId },
        {
          delay: Number(delay),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      this.logger.log(`Queued winner selection for raffle ${raffleId}`, {
        jobId: job.id,
        scheduledTime: new Date(Number(endTimeMs)).toISOString(),
        delayMs: delay.toString(),
      });
    } else {
      this.logger.warn(
        `Delay is ${delay}ms (<= 0), processing winner selection immediately for raffle ${raffleId}`,
      );
      await this.processWinnerSelection(raffleId);
    }
  }
}
