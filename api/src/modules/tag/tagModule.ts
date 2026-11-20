import { Module } from '@nestjs/common';
import { TagController } from './tagController';
import { TagRepository } from './tagRepository';
import { TagService } from './tagService';
@Module({ controllers: [TagController], providers: [TagRepository,TagService] })
export class TagModule {}
