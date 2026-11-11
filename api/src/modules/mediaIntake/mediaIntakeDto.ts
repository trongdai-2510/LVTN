import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

export class MediaConversationTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(1000)
  text!: string;
}

export class CreateMediaBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  batch_name?: string;

  @IsOptional()
  @IsUUID()
  import_batch_id?: string;
}

export class AddMediaItemDto {
  @IsUUID()
  file_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  source_path?: string;
}

export class ConfirmMediaItemDto {
  @IsObject()
  decision!: Record<string, unknown>;
}

export class AskMediaBatchDto {
  @IsString()
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUUID('all', { each: true })
  focus_item_ids?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => MediaConversationTurnDto)
  history?: MediaConversationTurnDto[];
}
