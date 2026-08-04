import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import {
  CreateFileMetadataDto,
  FileListQueryDto,
  FileUsageListQueryDto,
  FileUsageRecordListQueryDto,
  UploadFileDto
} from './file.dto';
import type { UploadedFileLibraryAsset } from './file-upload';
import { FileService } from './file.service';

@Controller('song-thanh')
@UseGuards(AuthGuard, PermissionGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get('files')
  @RequirePermissions('file.read')
  listFiles(@Query() query: FileListQueryDto) {
    return this.fileService.listFiles(query);
  }

  @Get('files/usage-records')
  @RequirePermissions('file.read')
  listUsageRecords(@Query() query: FileUsageRecordListQueryDto) {
    return this.fileService.listUsageRecords(query);
  }

  @Post('files')
  @RequirePermissions('file.create')
  createFileMetadata(@Body() body: CreateFileMetadataDto) {
    return this.fileService.createFileMetadata(body);
  }

  @Post('files/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @RequirePermissions('file.create')
  uploadFile(
    @UploadedFile() file: UploadedFileLibraryAsset | undefined,
    @Body() body: UploadFileDto
  ) {
    return this.fileService.uploadFile(file, body);
  }

  @Get('files/:id')
  @RequirePermissions('file.read')
  getFileDetail(@Param('id') id: string) {
    return this.fileService.getFileDetail(id);
  }

  @Get('files/:id/preview')
  @RequirePermissions('file.read')
  getFilePreview(@Param('id') id: string, @Res() response: Response) {
    return this.fileService.sendFilePreview(id, response);
  }

  @Get('files/:id/download')
  @RequirePermissions('file.read')
  downloadFile(@Param('id') id: string, @Res() response: Response) {
    return this.fileService.sendFileDownload(id, response);
  }

  @Get('files/:id/usages')
  @RequirePermissions('file.read')
  getFileUsages(@Param('id') id: string, @Query() query: FileUsageListQueryDto) {
    return this.fileService.getFileUsages(id, query);
  }

  @Get('file-usages/:usageId')
  @RequirePermissions('file.read')
  getUsageDetail(@Param('usageId') usageId: string) {
    return this.fileService.getUsageDetail(usageId);
  }

  @Post('files/:id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('file.archive')
  archiveFile(@Param('id') id: string) {
    return this.fileService.archiveFile(id);
  }

  @Post('files/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('file.restore')
  restoreFile(@Param('id') id: string) {
    return this.fileService.restoreFile(id);
  }
}
