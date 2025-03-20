import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  async processEvent(eventData: any): Promise<void> {
    try {
      this.logger.log(`Processing event: ${JSON.stringify(eventData)}`);
      
      const { op, data, entity } = eventData;
      const collectionName = this.getCollectionName(entity);
      
      switch (op) {
        case 'INSERT':
          await this.handleInsert(collectionName, data.new);
          
          if (collectionName === 'raffles') {
            // Schedule winner selection for new raffle
            await this.handleNewRaffle(data.new);
          }
          break;
        case 'UPDATE':
          await this.handleUpdate(collectionName, data.old, data.new);
          break;
        case 'DELETE':
          await this.handleDelete(collectionName, data.old);
          break;
        default:
          this.logger.warn(`Unknown operation type: ${op}`);
      }
    } catch (error) {
      this.logger.error(`Error processing event: ${error.message}`, error.stack);
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

    return entityToCollectionMap[entity.toLowerCase()] || entity.toLowerCase();
  }

  private async handleInsert(collectionName: string, data: any): Promise<void> {
    try {
      const docId = await this.firebaseService.saveEvent(collectionName, data);
      this.logger.log(`Inserted new document in ${collectionName} with ID: ${docId}`);
      
      // Track in history if it's a donation or reward
      if (collectionName === 'donations' || collectionName === 'raffle_prizes' || collectionName === 'scholarship_awards') {
        await this.addToHistory(collectionName, data);
      }
    } catch (error) {
      this.logger.error(`Error handling insert: ${error.message}`, error.stack);
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
        transactionHash: data.transaction_hash || data.transactionHash || "",
        status: data.status || 'completed',
        metadata: { ...data }
      };

      if (!historyEntry.transactionHash) {
        this.logger.warn(`Missing transaction hash for ${type} history entry: ${JSON.stringify(data)}`);
      }

      await this.firebaseService.saveEvent('donor_history', historyEntry);
      this.logger.log(`Added ${type} to history for donor ${historyEntry.donor}`);
    } catch (error) {
      this.logger.error(`Error adding to history: ${error.message}`, error.stack);
    }
  }

  private async handleUpdate(collectionName: string, oldData: any, newData: any): Promise<void> {
    try {
      if (collectionName === 'donors' && newData.address) {
        await this.firebaseService.updateDocument(collectionName, newData.address, newData);
        this.logger.log(`Updated donor document for address: ${newData.address}`);
      } else if (newData.id) {
        await this.firebaseService.updateDocument(collectionName, newData.id, newData);
        this.logger.log(`Updated document in ${collectionName} with ID: ${newData.id}`);
      } else {
        const docId = await this.firebaseService.saveEvent(collectionName, newData);
        this.logger.log(`Created new document in ${collectionName} with ID: ${docId} during update`);
      }
    } catch (error) {
      this.logger.error(`Error handling update: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleDelete(collectionName: string, data: any): Promise<void> {
    this.logger.log(`Delete event received for ${collectionName} with data: ${JSON.stringify(data)}`);
  }

  private async updateDonationLeaderboard(newDonation: any, oldDonation?: any): Promise<void> {
    try {
      const { donor, amount } = newDonation;
      
      if (!donor || !amount) {
        this.logger.warn('Donation missing donor or amount, skipping leaderboard update');
        return;
      }

      const donationAmount = this.firebaseService.toNumber(amount);
      const isUpdate = !!oldDonation;
      
      await this.firebaseService.updateDonorLeaderboard(donor, donationAmount, isUpdate);
      await this.firebaseService.updateLeaderboardStats(donationAmount, isUpdate);
      
      this.logger.log(`Updated leaderboard for donor ${donor}`);
    } catch (error) {
      this.logger.error(`Error updating donation leaderboard: ${error.message}`, error.stack);
    }
  }

  async getDonationLeaderboard(limit: number = 10, offset: number = 0): Promise<any[]> {
    return this.firebaseService.getDonationLeaderboard(limit, offset);
  }

  async getDonationStats(): Promise<any> {
    return this.firebaseService.getDocument('stats', 'donationStats') || {
      totalDonated: 0,
      donationCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getDonorInfo(address: string): Promise<any> {
    return this.firebaseService.getDonorInfo(address);
  }

  async getDonorHistory(address: string, limit: number = 50, offset: number = 0): Promise<any> {
    return this.firebaseService.getDonorHistory(address, limit, offset);
  }

  // private async handleNewRaffle(raffleData: any): Promise<void> {
  //   try {
  //     const { id, endTime } = raffleData;
  //     if (!id || !endTime) {
  //       this.logger.warn('New raffle missing id or endTime, skipping winner selection scheduling');
  //       return;
  //     }

  //     await this.raffleService.scheduleWinnerSelection(BigInt(id), Number(endTime));
  //     this.logger.log(`Scheduled winner selection for new raffle ${id}`);
  //   } catch (error) {
  //     this.logger.error(`Error scheduling winner selection for new raffle: ${error.message}`, error.stack);
  //   }
  // }
} 