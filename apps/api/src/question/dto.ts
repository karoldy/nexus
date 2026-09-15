import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../knowledge/dto';
import { QUESTION_TYPES, type QuestionType } from './question-payload';

export class QuestionOptionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class CreateQuestionDto {
  @IsIn(QUESTION_TYPES)
  type!: QuestionType;

  @IsString()
  @IsNotEmpty()
  stem!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[] | null;

  @IsDefined()
  answer!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeIds?: string[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsIn(QUESTION_TYPES)
  type?: QuestionType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  stem?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[] | null;

  @IsOptional()
  answer?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  explanation?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeIds?: string[];
}

export class QuestionListQueryDto extends PageQueryDto {
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
  @IsIn(QUESTION_TYPES)
  type?: QuestionType;

  @IsOptional()
  @IsUUID()
  knowledgeId?: string;

  @IsOptional()
  @IsUUID()
  collectionId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
