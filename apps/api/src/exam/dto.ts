import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../knowledge/dto';

export class ExamListQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') {
      return true;
    }
    if (value === false || value === 'false') {
      return false;
    }
    return value;
  })
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  q?: string;
}

export class ExamQuestionItemDto {
  @IsUUID('4')
  questionId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score?: number;
}

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds?: number | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamQuestionItemDto)
  questions?: ExamQuestionItemDto[];
}

export class UpdateExamDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds?: number | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamQuestionItemDto)
  questions?: ExamQuestionItemDto[];
}

export class ExamRecordListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  examId?: string;
}

export class SaveExamAnswerItemDto {
  @IsUUID('4')
  questionId!: string;

  @IsOptional()
  @IsObject()
  submittedAnswer?: Record<string, unknown> | null;
}

export class SaveExamAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveExamAnswerItemDto)
  answers!: SaveExamAnswerItemDto[];
}
