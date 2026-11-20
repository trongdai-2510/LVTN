import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CreatePartnerDto, UpdatePartnerDto } from './partnerDto';
import { PartnerService } from './partnerService';

@Controller('song-thanh/partners')
@UseGuards(AuthGuard, PermissionGuard)
export class PartnerController {
  constructor(private readonly service: PartnerService) {}

  @Get()
  @RequirePermissions('partner.read')
  list() { return this.service.listPartners(); }

  @Post()
  @RequirePermissions('partner.create')
  create(@Body() body: CreatePartnerDto) { return this.service.createPartner(body); }

  @Get(':id')
  @RequirePermissions('partner.read')
  detail(@Param('id') id: string) { return this.service.getPartner(id); }

  @Put(':id')
  @RequirePermissions('partner.update')
  update(@Param('id') id: string, @Body() body: UpdatePartnerDto) { return this.service.updatePartner(id, body); }

  @Post(':id/archive')
  @RequirePermissions('partner.archive')
  archive(@Param('id') id: string) { return this.service.archivePartner(id); }

  @Post(':id/restore')
  @RequirePermissions('partner.restore')
  restore(@Param('id') id: string) { return this.service.restorePartner(id); }
}
