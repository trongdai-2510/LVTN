import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { BrandListQueryDto, CreateBrandDto, UpdateBrandDto } from './brand.dto';
import { BrandService } from './brand.service';

@Controller('song-thanh/brands')
@UseGuards(AuthGuard, PermissionGuard)
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @RequirePermissions('brand.read')
  listBrands(@Query() query: BrandListQueryDto) {
    return this.brandService.listBrands(query);
  }

  @Post()
  @RequirePermissions('brand.create')
  createBrand(@Body() body: CreateBrandDto) {
    return this.brandService.createBrand(body);
  }

  @Get(':id')
  @RequirePermissions('brand.read')
  getBrandDetail(@Param('id') id: string) {
    return this.brandService.getBrandDetail(id);
  }

  @Put(':id')
  @RequirePermissions('brand.update')
  updateBrand(@Param('id') id: string, @Body() body: UpdateBrandDto) {
    return this.brandService.updateBrand(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('brand.archive')
  archiveBrand(@Param('id') id: string) {
    return this.brandService.archiveBrand(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('brand.restore')
  restoreBrand(@Param('id') id: string) {
    return this.brandService.restoreBrand(id);
  }
}
