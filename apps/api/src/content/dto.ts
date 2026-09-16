import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../knowledge/dto';
import { CONTENT_TYPES, type ContentType } from './content-payload';

export class ContentListQueryDto extends PageQueryDto {
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
  @IsIn(CONTENT_TYPES)
  type?: ContentType;

  @IsOptional()
  @IsUUID()
  knowledgeId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateContentDto {
  @IsIn(CONTENT_TYPES)
  type!: ContentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  body?: string | null;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize?: number | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeIds?: string[];
}

export class UpdateContentDto {
  @IsOptional()
  @IsIn(CONTENT_TYPES)
  type?: ContentType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string | null;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize?: number | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  knowledgeIds?: string[];
}
