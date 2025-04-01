import { Injectable } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
import { Student } from './entities/student.entity';
import { FirebaseService } from '../firebase/firebase.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StudentService {
  constructor(private readonly firebaseService: FirebaseService) {}

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    const studentData: Partial<Student> = {
      address: createStudentDto.address,
      email: createStudentDto.email,
      ocid: createStudentDto.ocid,
      firstName: createStudentDto.firstName,
      lastName: createStudentDto.lastName,
      universityName: createStudentDto.universityName,
      universityCity: createStudentDto.universityCity,
      universityCountry: createStudentDto.universityCountry,
    };

    if (createStudentDto.transcript) {
      const transcriptPath = `students/${studentData.id}/transcript`;
      studentData.transcriptUrl = await this.firebaseService.uploadFile(
        createStudentDto.transcript,
        transcriptPath
      );
    }

    if (createStudentDto.schoolId) {
      const schoolIdPath = `students/${studentData.id}/school-id`;
      studentData.schoolIdUrl = await this.firebaseService.uploadFile(
        createStudentDto.schoolId,
        schoolIdPath
      );
    }

    return this.firebaseService.upsertStudent(studentData);
  }
}
