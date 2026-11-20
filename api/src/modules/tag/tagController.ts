import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CreateTagDto, SetProductTagsDto, UpdateTagDto } from './tagDto';
import { TagService } from './tagService';

@Controller('song-thanh') @UseGuards(AuthGuard,PermissionGuard)
export class TagController {
  constructor(private readonly service: TagService) {}
  @Get('tags') @RequirePermissions('tag.read') list() { return this.service.list(); }
  @Post('tags') @RequirePermissions('tag.create') create(@Body() body: CreateTagDto) { return this.service.create(body); }
  @Put('tags/:id') @RequirePermissions('tag.update') update(@Param('id') id: string,@Body() body: UpdateTagDto) { return this.service.update(id,body); }
  @Post('tags/:id/archive') @RequirePermissions('tag.archive') archive(@Param('id') id: string) { return this.service.archive(id); }
  @Post('tags/:id/restore') @RequirePermissions('tag.restore') restore(@Param('id') id: string) { return this.service.restore(id); }
  @Get('product-groups/:id/tags') @RequirePermissions('product_group.read') productTags(@Param('id') id: string) { return this.service.listForProduct(id); }
  @Put('product-groups/:id/tags') @RequirePermissions('product_group.update') setProductTags(@Param('id') id: string,@Body() body: SetProductTagsDto,@CurrentUser() user: CurrentUserContext | null) { return this.service.setForProduct(id,body,user?.roles.includes('super_admin') ?? false); }
}
