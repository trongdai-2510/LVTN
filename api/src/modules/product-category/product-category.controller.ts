import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import {
  CreateProductCategoryDto,
  ProductCategoryListQueryDto,
  UpdateProductCategoryDto
} from './product-category.dto';
import { ProductCategoryService } from './product-category.service';

@Controller('song-thanh/product-categories')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductCategoryController {
  constructor(private readonly categoryService: ProductCategoryService) {}

  @Get()
  @RequirePermissions('product_category.read')
  listCategories(@Query() query: ProductCategoryListQueryDto) {
    return this.categoryService.listCategories(query);
  }

  @Post()
  @RequirePermissions('product_category.create')
  createCategory(@Body() body: CreateProductCategoryDto) {
    return this.categoryService.createCategory(body);
  }

  @Get(':id')
  @RequirePermissions('product_category.read')
  getCategoryDetail(@Param('id') id: string) {
    return this.categoryService.getCategoryDetail(id);
  }

  @Put(':id')
  @RequirePermissions('product_category.update')
  updateCategory(@Param('id') id: string, @Body() body: UpdateProductCategoryDto) {
    return this.categoryService.updateCategory(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_category.archive')
  archiveCategory(@Param('id') id: string) {
    return this.categoryService.archiveCategory(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_category.restore')
  restoreCategory(@Param('id') id: string) {
    return this.categoryService.restoreCategory(id);
  }
}
