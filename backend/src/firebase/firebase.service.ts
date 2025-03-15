import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private db: Firestore;

  constructor(private configService: ConfigService) {}

  getFirestore(): Firestore {
    return this.db;
  }

  onModuleInit() {
    const serviceAccount = {
      projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      privateKey: this.configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
    };

    // Initialize Firebase Admin
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET'),
    });
    
    this.db = getFirestore(app);
  }

  async saveEvent(collectionName: string, data: any): Promise<string> {
    try {
      const docRef = await this.db.collection(collectionName).add({
        ...data,
        timestamp: new Date(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving event to Firebase:', error);
      throw error;
    }
  }

  async getDocument(collectionName: string, documentId: string): Promise<any> {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting document from Firebase:', error);
      throw error;
    }
  }

  async updateDocument(collectionName: string, documentId: string, data: any): Promise<void> {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      await docRef.update({
        ...data,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error updating document in Firebase:', error);
      throw error;
    }
  }

  async getDonationLeaderboard(limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      const leaderboardRef = this.db.collection('donationLeaderboard');
      
      const querySnapshot = await leaderboardRef
        .orderBy('totalDonated', 'desc')
        .limit(limit + offset)
        .get();
      
      const donors = [];
      let count = 0;
      
      querySnapshot.forEach((doc) => {
        count++;
        if (count > offset) {
          donors.push({
            id: doc.id,
            ...doc.data(),
            rank: count
          });
        }
      });
      
      return donors;
    } catch (error) {
      console.error('Error fetching donation leaderboard:', error);
      throw error;
    }
  }

  async updateDonorLeaderboard(donor: string, donationAmount: number, isUpdate: boolean = false): Promise<void> {
    try {
      const donorRecord = await this.getDocument('donationLeaderboard', donor);
      
      if (donorRecord) {
        await this.updateDocument('donationLeaderboard', donor, {
          address: donor,
          totalDonated: (donorRecord.totalDonated || 0) + donationAmount,
          donationCount: (donorRecord.donationCount || 0) + (isUpdate ? 0 : 1),
          lastDonation: new Date().toISOString(),
        });
      } else {
        await this.saveEvent('donationLeaderboard', {
          address: donor,
          totalDonated: donationAmount,
          donationCount: 1,
          lastDonation: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error updating donor leaderboard:', error);
      throw error;
    }
  }

  async updateLeaderboardStats(newAmount: number, isUpdate: boolean = false): Promise<void> {
    try {
      const statsDoc = await this.getDocument('stats', 'donationStats');
      
      const statsData = {
        totalDonated: (statsDoc?.totalDonated || 0) + newAmount,
        donationCount: (statsDoc?.donationCount || 0) + (isUpdate ? 0 : 1),
        lastUpdated: new Date().toISOString(),
      };
      
      if (statsDoc) {
        await this.updateDocument('stats', 'donationStats', statsData);
      } else {
        await this.saveEvent('stats', {
          ...statsData,
          id: 'donationStats',
        });
      }
    } catch (error) {
      console.error('Error updating leaderboard stats:', error);
      throw error;
    }
  }

  async getDonorInfo(address: string): Promise<any> {
    try {
      const donorRecord = await this.getDocument('donationLeaderboard', address);
      
      if (!donorRecord) {
        return null;
      }
      
      const donationsRef = this.db.collection('donations');
      const querySnapshot = await donationsRef
        .where('donor', '==', address)
        .orderBy('timestamp', 'desc')
        .get();
      
      const donations = [];
      
      querySnapshot.forEach((doc) => {
        donations.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        ...donorRecord,
        donations
      };
    } catch (error) {
      console.error('Error fetching donor info:', error);
      throw error;
    }
  }

  toNumber(value: any): number {
    if (typeof value === 'string') {
      return parseFloat(value);
    }
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }
} 