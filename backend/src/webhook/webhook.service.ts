import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { RaffleService } from '../raffle/raffle.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly raffleService: RaffleService,
  ) {}

  async processEvent(eventData: any): Promise<void> {
    try {
      this.logger.debug(`Received webhook event:`, {
        operation: eventData.op,
        entity: eventData.entity,
        timestamp: new Date().toISOString(),
      });

      const { op, data, entity } = eventData;
      const collectionName = this.getCollectionName(entity);

      this.logger.debug(`Processing event for collection:`, {
        collectionName,
        operation: op,
        entity,
      });

      switch (op) {
        case 'INSERT':
          await this.handleInsert(collectionName, data.new);
          break;
        case 'UPDATE':
          await this.handleUpdate(collectionName, data.old, data.new);
          break;
        case 'DELETE':
          await this.handleDelete(collectionName, data.old);
          break;
        default:
          this.logger.warn(`Unknown operation type received:`, {
            operation: op,
            entity,
            data,
          });
      }
    } catch (error) {
      this.logger.error(`Error processing webhook event:`, {
        error: error.message,
        stack: error.stack,
        eventData,
      });
      throw error;
    }
  }

  private getCollectionName(entity: string): string {
    const entityToCollectionMap = {
      donation: 'donations',
      raffle: 'raffles',
      scholarship: 'scholarships',
      raffle_prize: 'raffle_prizes',
      raffle_entry: 'raffle_entries',
      scholarship_award: 'scholarship_awards',
      donor: 'donors',
    };

    const collectionName =
      entityToCollectionMap[entity.toLowerCase()] || entity.toLowerCase();

    this.logger.debug(`Mapped entity to collection:`, {
      entity,
      collectionName,
    });

    return collectionName;
  }

  private async handleInsert(collectionName: string, data: any): Promise<void> {
    try {
      this.logger.debug(`Processing insert for ${collectionName}:`, {
        data,
        timestamp: new Date().toISOString(),
      });

      let docId: string;

      // For donors collection, check if address already exists
      if (collectionName === 'donors' && data.address) {
        const existingDonor = await this.firebaseService.getDocument(
          collectionName,
          data.address,
        );
        this.logger.debug(`Checking existing donor:`, {
          address: data.address,
          exists: !!existingDonor,
        });

        if (existingDonor) {
          // Update existing donor instead of creating new one
          await this.firebaseService.updateDocument(
            collectionName,
            data.address,
            data,
          );
          docId = data.address;
          this.logger.log(`Updated existing donor document:`, {
            address: data.address,
            timestamp: new Date().toISOString(),
          });
        } else {
          // Create new donor if doesn't exist
          docId = await this.firebaseService.saveEvent(collectionName, data);
          this.logger.log(`Created new donor document:`, {
            address: data.address,
            docId,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // For other collections, proceed with normal insert
        docId = await this.firebaseService.saveEvent(collectionName, data);
        this.logger.log(`Created new document:`, {
          collection: collectionName,
          docId,
          timestamp: new Date().toISOString(),
        });
      }

      // Track in history if it's a donation or reward
      if (
        collectionName === 'donations' ||
        collectionName === 'raffle_prizes' ||
        collectionName === 'scholarship_awards'
      ) {
        await this.addToHistory(collectionName, data);
      }
    } catch (error) {
      this.logger.error(`Error handling insert:`, {
        error: error.message,
        stack: error.stack,
        collection: collectionName,
        data,
      });
      throw error;
    }
  }

  private async addToHistory(type: string, data: any): Promise<void> {
    try {
      const historyEntry = {
        type,
        donor: data.donor || data.recipient || data.winner,
        amount: data.amount,
        timestamp: data.timestamp || new Date().toISOString(),
        transactionHash: data.transaction_hash || data.transactionHash || '',
        status: data.status || 'completed',
        metadata: { ...data },
      };

      this.logger.debug(`Adding to history:`, {
        type,
        donor: historyEntry.donor,
        amount: historyEntry.amount,
        transactionHash: historyEntry.transactionHash,
      });

      if (!historyEntry.transactionHash) {
        this.logger.warn(`Missing transaction hash for history entry:`, {
          type,
          donor: historyEntry.donor,
          amount: historyEntry.amount,
        });
      }

      await this.firebaseService.saveEvent('donor_history', historyEntry);
      this.logger.log(`Added to history:`, {
        type,
        donor: historyEntry.donor,
        amount: historyEntry.amount,
        timestamp: historyEntry.timestamp,
      });
    } catch (error) {
      this.logger.error(`Error adding to history:`, {
        error: error.message,
        stack: error.stack,
        type,
        data,
      });
    }
  }

  private async handleUpdate(
    collectionName: string,
    oldData: any,
    newData: any,
  ): Promise<void> {
    try {
      this.logger.debug(`Processing update for ${collectionName}:`, {
        oldData,
        newData,
        timestamp: new Date().toISOString(),
      });

      if (collectionName === 'donors' && newData.address) {
        await this.firebaseService.updateDocument(
          collectionName,
          newData.address,
          newData,
        );
        this.logger.log(`Updated donor document:`, {
          address: newData.address,
          timestamp: new Date().toISOString(),
        });
      } else if (newData.id) {
        await this.firebaseService.updateDocument(
          collectionName,
          newData.id,
          newData,
        );
        this.logger.log(`Updated document:`, {
          collection: collectionName,
          id: newData.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        const docId = await this.firebaseService.saveEvent(
          collectionName,
          newData,
        );
        this.logger.log(`Created new document during update:`, {
          collection: collectionName,
          docId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Error handling update:`, {
        error: error.message,
        stack: error.stack,
        collection: collectionName,
        oldData,
        newData,
      });
      throw error;
    }
  }

  private async handleDelete(collectionName: string, data: any): Promise<void> {
    this.logger.log(`Processing delete event:`, {
      collection: collectionName,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async getDonationLeaderboard(
    limit: number = 10,
    offset: number = 0,
  ): Promise<any[]> {
    this.logger.debug(`Fetching donation leaderboard:`, {
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });
    return this.firebaseService.getDonationLeaderboard(limit, offset);
  }

  async getDonationStats(): Promise<any> {
    this.logger.debug(`Fetching donation stats:`, {
      timestamp: new Date().toISOString(),
    });
    return (
      this.firebaseService.getDocument('stats', 'donationStats') || {
        totalDonated: 0,
        donationCount: 0,
        lastUpdated: new Date().toISOString(),
      }
    );
  }

  async getDonorInfo(address: string): Promise<any> {
    this.logger.debug(`Fetching donor info:`, {
      address,
      timestamp: new Date().toISOString(),
    });
    return this.firebaseService.getDonorInfo(address);
  }

  async getDonorHistory(
    address: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<any> {
    this.logger.debug(`Fetching donor history:`, {
      address,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });
    return this.firebaseService.getDonorHistory(address, limit, offset);
  }
}
