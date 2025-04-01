import { Controller, Post, Body, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { Student } from './entities/student.entity';

@Controller('students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post('register')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'transcript', maxCount: 1 },
      { name: 'schoolId', maxCount: 1 },
    ])
  )
  async register(
    @Body() createStudentDto: CreateStudentDto,
    @UploadedFiles()
    files: {
      transcript?: Express.Multer.File[];
      schoolId?: Express.Multer.File[];
    },
  ): Promise<Student> {
    if (files.transcript) {
      createStudentDto.transcript = files.transcript[0];
    }
    if (files.schoolId) {
      createStudentDto.schoolId = files.schoolId[0];
    }
    
    return this.studentService.create(createStudentDto);
  }
}
