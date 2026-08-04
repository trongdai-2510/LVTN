import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { QuoteAssigneeDto, QuoteInternalNoteDto, QuoteListQueryDto, QuoteStatusDto } from './quote.dto';
import { QuoteService } from './quote.service';

@Controller('song-thanh/quotes')
@UseGuards(AuthGuard, PermissionGuard)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Get()
  @RequirePermissions('quote.read')
  listQuotes(@Query() query: QuoteListQueryDto) {
    return this.quoteService.listQuotes(query);
  }

  @Get(':id')
  @RequirePermissions('quote.read')
  getQuoteDetail(@Param('id') id: string) {
    return this.quoteService.getQuoteDetail(id);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('quote.update_status')
  updateStatus(@Param('id') id: string, @Body() body: QuoteStatusDto) {
    return this.quoteService.updateStatus(id, body);
  }

  @Put(':id/assignee')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('quote.assign')
  updateAssignee(@Param('id') id: string, @Body() body: QuoteAssigneeDto) {
    return this.quoteService.updateAssignee(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('quote.archive')
  archiveQuote(@Param('id') id: string) {
    return this.quoteService.archiveQuote(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('quote.restore')
  restoreQuote(@Param('id') id: string) {
    return this.quoteService.restoreQuote(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('quote.archive')
  permanentlyDeleteQuote(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.quoteService.permanentlyDeleteQuote(id, currentUser);
  }

  @Post(':id/internal-notes')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('quote_note.create')
  createInternalNote(
    @Param('id') id: string,
    @Body() body: QuoteInternalNoteDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.quoteService.createInternalNote(id, body, currentUser);
  }
}
