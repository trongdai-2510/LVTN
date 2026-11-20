import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { ContactAssigneeDto, ContactInternalNoteDto, ContactListQueryDto, ContactStatusDto } from './contact.dto';
import { ContactService } from './contact.service';

@Controller('song-thanh/contacts')
@UseGuards(AuthGuard, PermissionGuard)
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @RequirePermissions('contact.read')
  listContacts(@Query() query: ContactListQueryDto) {
    return this.contactService.listContacts(query);
  }

  @Get(':id')
  @RequirePermissions('contact.read')
  getContactDetail(@Param('id') id: string) {
    return this.contactService.getContactDetail(id);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('contact.update_status')
  updateStatus(@Param('id') id: string, @Body() body: ContactStatusDto) {
    return this.contactService.updateStatus(id, body);
  }

  @Put(':id/assignee')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('contact.assign')
  updateAssignee(@Param('id') id: string, @Body() body: ContactAssigneeDto) {
    return this.contactService.updateAssignee(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('contact.archive')
  archiveContact(@Param('id') id: string) {
    return this.contactService.archiveContact(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('contact.restore')
  restoreContact(@Param('id') id: string) {
    return this.contactService.restoreContact(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('contact.archive')
  permanentlyDeleteContact(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.contactService.permanentlyDeleteContact(id, currentUser);
  }

  @Post(':id/internal-notes')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('contact_note.create')
  createInternalNote(
    @Param('id') id: string,
    @Body() body: ContactInternalNoteDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.contactService.createInternalNote(id, body, currentUser);
  }
}
