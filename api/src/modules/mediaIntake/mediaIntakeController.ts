import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { AddMediaItemDto, AskMediaBatchDto, ConfirmMediaItemDto, CreateMediaBatchDto } from './mediaIntakeDto';
import { MediaIntakeService } from './mediaIntakeService';

@Controller('song-thanh/media-batches')
@UseGuards(AuthGuard, PermissionGuard)
export class MediaIntakeController {
  constructor(private readonly service: MediaIntakeService) {}

  @Get()
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  listBatches(@CurrentUser() user: CurrentUserContext | null) {
    return this.service.listBatches(user);
  }

  @Post()
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read', 'file.create')
  createBatch(@Body() body: CreateMediaBatchDto, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.createBatch(body, user);
  }

  @Get(':id')
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  getBatch(@Param('id') id: string, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.getBatch(id, user);
  }

  @Post(':id/items')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read', 'file.create')
  addItem(@Param('id') id: string, @Body() body: AddMediaItemDto, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.addItem(id, body, user);
  }

  @Post(':id/analyze')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  analyzeBatch(@Param('id') id: string, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.analyzeBatch(id, user);
  }

  @Get('local-ai/status')
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  localAiStatus() {
    return this.service.localAiStatus();
  }

  @Post('assistant/ask')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  askProject(@Body() body: AskMediaBatchDto) {
    return this.service.askProject(body.question, body.history);
  }

  @Post(':id/items/:itemId/analyze-local')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  analyzeItemLocally(@Param('id') id: string, @Param('itemId') itemId: string, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.analyzeItemLocally(id, itemId, user);
  }

  @Post(':id/ask')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  ask(@Param('id') id: string, @Body() body: AskMediaBatchDto, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.ask(id, body.question, user, body.focus_item_ids, body.history);
  }

  @Post(':id/items/:itemId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  confirmItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: ConfirmMediaItemDto, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.confirmItem(id, itemId, body.decision, user);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.read', 'product_variant.read', 'file.read')
  applyBatch(@Param('id') id: string, @CurrentUser() user: CurrentUserContext | null) {
    return this.service.applyBatch(id, user);
  }
}
