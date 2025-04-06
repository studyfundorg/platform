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
      id: uuidv4(),
      address: createStudentDto.address,
      email: createStudentDto.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Only add optional fields if they are defined
    if (createStudentDto.ocid) studentData.ocid = createStudentDto.ocid;
    if (createStudentDto.firstName) studentData.firstName = createStudentDto.firstName;
    if (createStudentDto.lastName) studentData.lastName = createStudentDto.lastName;
    if (createStudentDto.universityName) studentData.universityName = createStudentDto.universityName;
    if (createStudentDto.universityCity) studentData.universityCity = createStudentDto.universityCity;
    if (createStudentDto.universityCountry) studentData.universityCountry = createStudentDto.universityCountry;

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
