import { Injectable, OnModuleInit, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { Bucket } from '@google-cloud/storage';
import { Student } from '../student/entities/student.entity';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private db: Firestore;
  private bucket: Bucket;

  constructor(private configService: ConfigService) {}

  getFirestore(): Firestore {
    return this.db;
  }

  getBucket(): Bucket {
    return this.bucket;
  }

  onModuleInit() {
    const serviceAccount = {
      projectId: this.configService.get<string>('FIREBASE_PROJECT_ID'),
      clientEmail: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
      privateKey: this.configService
        .get<string>('FIREBASE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n'),
    };

    // Initialize Firebase Admin
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: this.configService.get<string>('FIREBASE_STORAGE_BUCKET'),
    });

    this.db = getFirestore(app);
    this.bucket = getStorage(app).bucket();
  }

  async uploadFile(file: Express.Multer.File, path: string): Promise<string> {
    const fileBuffer = file.buffer;
    const fileUpload = this.bucket.file(path);
    
    await fileUpload.save(fileBuffer, {
      contentType: file.mimetype,
    });

    return fileUpload.publicUrl();
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

  async updateDocument(
    collectionName: string,
    documentId: string,
    data: any,
  ): Promise<void> {
    try {
      const docRef = this.db.collection(collectionName).doc(documentId);
      await docRef.set(
        {
          ...data,
          updatedAt: new Date(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error('Error updating document in Firebase:', error);
      throw error;
    }
  }

  async getDonationLeaderboard(
    limit: number = 10,
    offset: number = 0,
  ): Promise<any[]> {
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
            rank: count,
          });
        }
      });

      return donors;
    } catch (error) {
      console.error('Error fetching donation leaderboard:', error);
      throw error;
    }
  }

  async updateDonorLeaderboard(
    donor: string,
    donationAmount: number,
    isUpdate: boolean = false,
  ): Promise<void> {
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

  async updateLeaderboardStats(
    newAmount: number,
    isUpdate: boolean = false,
  ): Promise<void> {
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
      const donorRecord = await this.getDocument(
        'donationLeaderboard',
        address,
      );

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
          ...doc.data(),
        });
      });

      return {
        ...donorRecord,
        donations,
      };
    } catch (error) {
      console.error('Error fetching donor info:', error);
      throw error;
    }
  }

  async getDonorHistory(
    address: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<any[]> {
    try {
      const historyRef = this.db.collection('donor_history');
      const querySnapshot = await historyRef
        .where('donor', '==', address)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      const history = [];
      querySnapshot.forEach((doc) => {
        history.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return history;
    } catch (error) {
      console.error('Error fetching donor history:', error);
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

  async findStudentByEmailOrAddress(email: string, address: string): Promise<Student | null> {
    const snapshot = await this.db.collection('students')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0].data() as Student;
    }

    const addressSnapshot = await this.db.collection('students')
      .where('address', '==', address)
      .limit(1)
      .get();

    if (!addressSnapshot.empty) {
      return addressSnapshot.docs[0].data() as Student;
    }

    return null;
  }

  async saveStudent(student: Student): Promise<void> {
    const existingStudent = await this.findStudentByEmailOrAddress(student.email, student.address);
    
    if (existingStudent && existingStudent.id !== student.id) {
      throw new ConflictException('A student with this email or address already exists');
    }

    await this.db.collection('students').doc(student.id).set(student);
  }

  async upsertStudent(student: Partial<Student>): Promise<Student> {
    const existingStudent = await this.findStudentByEmailOrAddress(student.email, student.address);
    
    if (existingStudent) {
      // Update existing student
      const updatedStudent = {
        ...existingStudent,
        ...student,
        id: existingStudent.id,
        updatedAt: new Date()
      };
      await this.db.collection('students').doc(existingStudent.id).set(updatedStudent);
      return updatedStudent;
    }

    // Create new student
    const newStudent: Student = {
      id: student.id || admin.firestore().collection('students').doc().id,
      ...student,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Student;

    await this.db.collection('students').doc(newStudent.id).set(newStudent);
    return newStudent;
  }

  async getStudent(studentId: string): Promise<Student | null> {
    const doc = await this.db.collection('students').doc(studentId).get();
    return doc.exists ? (doc.data() as Student) : null;
  }
}
