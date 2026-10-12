import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import {
  CreateTechnicalDocumentDto,
  TechnicalDocumentListQueryDto,
  TechnicalDocumentVersionDto,
  UpdateTechnicalDocumentDto
} from './technical-document.dto';
import { TechnicalDocumentService } from './technical-document.service';

@Controller('song-thanh/technical-documents')
@UseGuards(AuthGuard, PermissionGuard)
export class TechnicalDocumentController {
  constructor(private readonly technicalDocumentService: TechnicalDocumentService) {}

  @Get()
  @RequirePermissions('technical_document.read')
  listTechnicalDocuments(@Query() query: TechnicalDocumentListQueryDto) {
    return this.technicalDocumentService.listTechnicalDocuments(query);
  }

  @Post()
  @RequirePermissions('technical_document.create')
  createTechnicalDocument(@Body() body: CreateTechnicalDocumentDto) {
    return this.technicalDocumentService.createTechnicalDocument(body);
  }

  @Get(':id')
  @RequirePermissions('technical_document.read')
  getTechnicalDocumentDetail(@Param('id') id: string) {
    return this.technicalDocumentService.getTechnicalDocumentDetail(id);
  }

  @Put(':id')
  @RequirePermissions('technical_document.update')
  updateTechnicalDocument(@Param('id') id: string, @Body() body: UpdateTechnicalDocumentDto) {
    return this.technicalDocumentService.updateTechnicalDocument(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('technical_document.archive')
  archiveTechnicalDocument(@Param('id') id: string, @Body() body: TechnicalDocumentVersionDto) {
    return this.technicalDocumentService.archiveTechnicalDocument(id, body);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('technical_document.restore')
  restoreTechnicalDocument(@Param('id') id: string, @Body() body: TechnicalDocumentVersionDto) {
    return this.technicalDocumentService.restoreTechnicalDocument(id, body);
  }
}
