import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CertificateDto, UpdateCertificateDto } from './certificateDto';
import { CertificateService } from './certificateService';

@Controller('song-thanh/certificates')
@UseGuards(AuthGuard, PermissionGuard)
export class CertificateController {
  constructor(private readonly service: CertificateService) {}
  @Get() @RequirePermissions('certificate.read') list() { return this.service.list(); }
  @Post() @RequirePermissions('certificate.create') create(@Body() body: CertificateDto) { return this.service.create(body); }
  @Put(':id') @RequirePermissions('certificate.update') update(@Param('id') id: string, @Body() body: UpdateCertificateDto) { return this.service.update(id, body); }
  @Post(':id/archive') @RequirePermissions('certificate.archive') archive(@Param('id') id: string) { return this.service.archive(id); }
  @Post(':id/restore') @RequirePermissions('certificate.restore') restore(@Param('id') id: string) { return this.service.restore(id); }
}
