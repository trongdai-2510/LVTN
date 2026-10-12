import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { WorkflowApprovalGuard } from '../../common/workflow/workflow-approval.guard';
import {
  BulkUpdateProductVariantsDto,
  CreateProductVariantDto,
  CreateVariantAttributeDto,
  ProductVariantListQueryDto,
  ProductVariantVersionDto,
  UpdateProductVariantDto,
  UpdateVariantAttributeDto
} from './product-variant.dto';
import { ProductVariantService } from './product-variant.service';

@Controller('song-thanh/product-variants')
@UseGuards(AuthGuard, PermissionGuard, WorkflowApprovalGuard)
export class ProductVariantController {
  constructor(private readonly productVariantService: ProductVariantService) {}

  @Get()
  @RequirePermissions('product_variant.read')
  listProductVariants(@Query() query: ProductVariantListQueryDto) {
    return this.productVariantService.listProductVariants(query);
  }

  @Post()
  @RequirePermissions('product_variant.create')
  createProductVariant(@Body() body: CreateProductVariantDto) {
    return this.productVariantService.createProductVariant(body);
  }

  @Get(':id')
  @RequirePermissions('product_variant.read')
  getProductVariantDetail(@Param('id') id: string) {
    return this.productVariantService.getProductVariantDetail(id);
  }

  @Get(':id/attributes')
  @RequirePermissions('product_variant.read')
  listVariantAttributes(@Param('id') id: string) {
    return this.productVariantService.listVariantAttributes(id);
  }

  @Put(':id')
  @RequirePermissions('product_variant.update')
  updateProductVariant(@Param('id') id: string, @Body() body: UpdateProductVariantDto, @CurrentUser() currentUser: CurrentUserContext | null) {
    return this.productVariantService.updateProductVariant(id, body, currentUser);
  }

  @Post('bulk-status')
  @RequirePermissions('product_variant.update')
  bulkUpdateProductVariants(@Body() body: BulkUpdateProductVariantsDto) {
    return this.productVariantService.bulkUpdateProductVariants(body);
  }

  @Post(':id/attributes')
  @RequirePermissions('product_variant.update')
  createVariantAttribute(
    @Param('id') id: string,
    @Body() body: CreateVariantAttributeDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.productVariantService.createVariantAttribute(id, body, currentUser);
  }

  @Put(':id/attributes/:attributeId')
  @RequirePermissions('product_variant.update')
  updateVariantAttribute(
    @Param('id') id: string,
    @Param('attributeId') attributeId: string,
    @Body() body: UpdateVariantAttributeDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.productVariantService.updateVariantAttribute(id, attributeId, body, currentUser);
  }

  @Post(':id/attributes/:attributeId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_variant.update')
  archiveVariantAttribute(
    @Param('id') id: string,
    @Param('attributeId') attributeId: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.productVariantService.archiveVariantAttribute(id, attributeId, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_variant.archive')
  archiveProductVariant(@Param('id') id: string, @Body() body: ProductVariantVersionDto) {
    return this.productVariantService.archiveProductVariant(id, body);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_variant.restore')
  restoreProductVariant(@Param('id') id: string, @Body() body: ProductVariantVersionDto) {
    return this.productVariantService.restoreProductVariant(id, body);
  }
}
