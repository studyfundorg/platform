import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { collection, query, orderBy, limit, startAfter, getDocs, where, Firestore, getFirestore } from 'firebase/firestore';
import { limit as firestoreLimit } from 'firebase/firestore';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private db: Firestore;

  constructor(private readonly firebaseService: FirebaseService) {
    // Get the Firestore instance from the FirebaseService
    // This assumes the FirebaseService has a method to get the db instance
    // If not, you'll need to modify this approach
    this.db = getFirestore();
  }

  async processEvent(eventData: any): Promise<void> {
    try {
      this.logger.log(`Processing event: ${JSON.stringify(eventData)}`);
      
      // Extract relevant information from the event
      const { op, data_source, data, entity, webhook_name } = eventData;
      
      // Determine collection name based on entity type
      const collectionName = this.getCollectionName(entity);
      
      // Process based on operation type
      switch (op) {
        case 'INSERT':
          await this.handleInsert(collectionName, data.new);
          
          // If this is a donation, update the leaderboard
          if (collectionName === 'donations') {
            await this.updateDonationLeaderboard(data.new);
          }
          break;
        case 'UPDATE':
          await this.handleUpdate(collectionName, data.old, data.new);
          
          // If this is a donation update, update the leaderboard
          if (collectionName === 'donations') {
            await this.updateDonationLeaderboard(data.new, data.old);
          }
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
    // Map entity names to collection names
    // For StudyFund contract, we'll have collections for donations, raffles, scholarships
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
      // Save the new entity to Firebase
      const docId = await this.firebaseService.saveEvent(collectionName, data);
      this.logger.log(`Inserted new document in ${collectionName} with ID: ${docId}`);
    } catch (error) {
      this.logger.error(`Error handling insert: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleUpdate(collectionName: string, oldData: any, newData: any): Promise<void> {
    try {
      // For updates, we need to find the existing document and update it
      // This assumes the document ID is stored in the 'id' field
      if (newData.id) {
        await this.firebaseService.updateDocument(collectionName, newData.id, newData);
        this.logger.log(`Updated document in ${collectionName} with ID: ${newData.id}`);
      } else {
        // If we don't have an ID, we'll create a new document
        const docId = await this.firebaseService.saveEvent(collectionName, newData);
        this.logger.log(`Created new document in ${collectionName} with ID: ${docId} during update`);
      }
    } catch (error) {
      this.logger.error(`Error handling update: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleDelete(collectionName: string, data: any): Promise<void> {
    // For this MVP, we're not actually deleting data from Firebase
    // Instead, we'll log the deletion event
    this.logger.log(`Delete event received for ${collectionName} with data: ${JSON.stringify(data)}`);
    
    // If you want to implement actual deletion, you would add that logic here
  }

  /**
   * Helper method to convert any value to a number
   */
  private toNumber(value: any): number {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }

  /**
   * Updates the donation leaderboard when a new donation is received or updated
   * @param newDonation The new donation data
   * @param oldDonation The old donation data (for updates)
   */
  private async updateDonationLeaderboard(newDonation: any, oldDonation?: any): Promise<void> {
    try {
      // Extract donor address and amount from the donation
      const { donor, amount } = newDonation;
      
      if (!donor || !amount) {
        this.logger.warn('Donation missing donor or amount, skipping leaderboard update');
        return;
      }

      // Convert amount to a number
      const donationAmount = this.toNumber(amount);
      
      // Get the current donor record from the leaderboard, if it exists
      const donorRecord = await this.firebaseService.getDocument('donationLeaderboard', donor);
      
      if (donorRecord) {
        // Donor exists in leaderboard, update their total
        let newTotal = donorRecord.totalDonated || 0;
        
        // If this is an update, subtract the old amount first
        if (oldDonation && oldDonation.amount) {
          const oldAmount = this.toNumber(oldDonation.amount);
          newTotal -= oldAmount;
        }
        
        // Add the new donation amount
        newTotal += donationAmount;
        
        // Update the donor's record
        await this.firebaseService.updateDocument('donationLeaderboard', donor, {
          address: donor,
          totalDonated: newTotal,
          donationCount: (donorRecord.donationCount || 0) + (oldDonation ? 0 : 1),
          lastDonation: new Date().toISOString(),
        });
        
        this.logger.log(`Updated leaderboard for donor ${donor}, new total: ${newTotal}`);
      } else {
        // New donor, create a record
        // Use donor address as the document ID for easy lookups
        const leaderboardEntry = {
          address: donor,
          totalDonated: donationAmount,
          donationCount: 1,
          lastDonation: new Date().toISOString(),
        };
        
        // Use saveEvent and specify the donor address as the document ID
        await this.firebaseService.saveEvent('donationLeaderboard', leaderboardEntry);
        
        this.logger.log(`Added new donor ${donor} to leaderboard with amount: ${donationAmount}`);
      }
      
      // Update the overall leaderboard stats
      await this.updateLeaderboardStats(donationAmount, oldDonation);
      
    } catch (error) {
      this.logger.error(`Error updating donation leaderboard: ${error.message}`, error.stack);
      // We don't want to throw here as it would prevent the main event processing
    }
  }

  /**
   * Updates the overall leaderboard statistics
   * @param newAmount The new donation amount
   * @param oldDonation The old donation data (for updates)
   */
  private async updateLeaderboardStats(newAmount: number, oldDonation?: any): Promise<void> {
    try {
      // Get the current stats
      const statsDoc = await this.firebaseService.getDocument('stats', 'donationStats');
      
      let totalDonated = statsDoc?.totalDonated || 0;
      let donationCount = statsDoc?.donationCount || 0;
      
      // If this is an update, subtract the old amount first
      if (oldDonation && oldDonation.amount) {
        const oldAmount = this.toNumber(oldDonation.amount);
        totalDonated -= oldAmount;
      } else {
        // Only increment count for new donations, not updates
        donationCount += 1;
      }
      
      // Add the new amount
      totalDonated += newAmount;
      
      // Create stats object
      const statsData = {
        totalDonated,
        donationCount,
        lastUpdated: new Date().toISOString(),
      };
      
      if (statsDoc) {
        // Update existing stats document
        await this.firebaseService.updateDocument('stats', 'donationStats', statsData);
      } else {
        // Create new stats document
        await this.firebaseService.saveEvent('stats', {
          ...statsData,
          id: 'donationStats', // Set the ID explicitly
        });
      }
      
      this.logger.log(`Updated donation stats: total=${totalDonated}, count=${donationCount}`);
    } catch (error) {
      this.logger.error(`Error updating leaderboard stats: ${error.message}`, error.stack);
    }
  }

  /**
   * Retrieves the donation leaderboard with pagination
   * @param limit Maximum number of donors to return
   * @param offset Number of donors to skip
   * @returns Array of donors sorted by total donation amount
   */
  async getDonationLeaderboard(limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      // Create a query against the leaderboard collection
      const leaderboardRef = collection(this.db, 'donationLeaderboard');
      
      // Order by total donated amount in descending order
      const q = query(
        leaderboardRef,
        orderBy('totalDonated', 'desc'),
        firestoreLimit(limit + offset)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Convert the query snapshot to an array of donors
      const donors = [];
      let count = 0;
      
      querySnapshot.forEach((doc) => {
        count++;
        // Skip donors before the offset
        if (count > offset) {
          donors.push({
            id: doc.id,
            ...doc.data(),
            rank: count // Add rank based on position
          });
        }
      });
      
      return donors;
    } catch (error) {
      this.logger.error(`Error fetching donation leaderboard: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Retrieves overall donation statistics
   * @returns Donation statistics including total amount and count
   */
  async getDonationStats(): Promise<any> {
    try {
      const statsDoc = await this.firebaseService.getDocument('stats', 'donationStats');
      
      if (statsDoc) {
        return statsDoc;
      } else {
        // Return default stats if none exist yet
        return {
          totalDonated: 0,
          donationCount: 0,
          lastUpdated: new Date().toISOString(),
        };
      }
    } catch (error) {
      this.logger.error(`Error fetching donation stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Retrieves information about a specific donor
   * @param address The donor's blockchain address
   * @returns Donor information including donation history
   */
  async getDonorInfo(address: string): Promise<any> {
    try {
      // Get the donor's leaderboard entry
      const donorRecord = await this.firebaseService.getDocument('donationLeaderboard', address);
      
      if (!donorRecord) {
        return null; // Donor not found
      }
      
      // Get the donor's donation history
      const donationsRef = collection(this.db, 'donations');
      const q = query(
        donationsRef,
        where('donor', '==', address),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      // Convert the query snapshot to an array of donations
      const donations = [];
      querySnapshot.forEach((doc) => {
        donations.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Return combined donor info
      return {
        ...donorRecord,
        donations
      };
    } catch (error) {
      this.logger.error(`Error fetching donor info: ${error.message}`, error.stack);
      throw error;
    }
  }
} 