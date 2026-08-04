import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CreateNewsCategoryDto, NewsCategoryListQueryDto, UpdateNewsCategoryDto } from './news-category.dto';
import { NewsCategoryService } from './news-category.service';

@Controller('song-thanh/news-categories')
@UseGuards(AuthGuard, PermissionGuard)
export class NewsCategoryController {
  constructor(private readonly newsCategoryService: NewsCategoryService) {}

  @Get()
  @RequirePermissions('news_category.read')
  listNewsCategories(@Query() query: NewsCategoryListQueryDto) {
    return this.newsCategoryService.listNewsCategories(query);
  }

  @Post()
  @RequirePermissions('news_category.create')
  createNewsCategory(@Body() body: CreateNewsCategoryDto) {
    return this.newsCategoryService.createNewsCategory(body);
  }

  @Get(':id')
  @RequirePermissions('news_category.read')
  getNewsCategoryDetail(@Param('id') id: string) {
    return this.newsCategoryService.getNewsCategoryDetail(id);
  }

  @Put(':id')
  @RequirePermissions('news_category.update')
  updateNewsCategory(@Param('id') id: string, @Body() body: UpdateNewsCategoryDto) {
    return this.newsCategoryService.updateNewsCategory(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('news_category.archive')
  archiveNewsCategory(@Param('id') id: string) {
    return this.newsCategoryService.archiveNewsCategory(id);
  }

  @Post(':id/restore')
  @RequirePermissions('news_category.restore')
  restoreNewsCategory(@Param('id') id: string) {
    return this.newsCategoryService.restoreNewsCategory(id);
  }
}
