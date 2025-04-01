import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStudentDto {
  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  ocid?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  universityName?: string;

  @IsOptional()
  @IsString()
  universityCity?: string;

  @IsOptional()
  @IsString()
  universityCountry?: string;

  @IsOptional()
  transcript?: Express.Multer.File;

  @IsOptional()
  schoolId?: Express.Multer.File;
} 