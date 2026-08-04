import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { WorkflowApprovalGuard } from '../../common/workflow/workflow-approval.guard';
import {
  BulkUpdateProductGroupsDto,
  CreateProductGroupDto,
  CreateProductHighlightSpecDto,
  ProductGroupListQueryDto,
  ProductHighlightSpecQueryDto,
  ProductHighlightSpecSuggestionsQueryDto,
  ReorderProductHighlightSpecsDto,
  ReplaceProductGalleryDto,
  UpdateProductGroupDto,
  UpdateProductHighlightSpecDto
} from './product-group.dto';
import { ProductGroupService } from './product-group.service';

@Controller('song-thanh/product-groups')
@UseGuards(AuthGuard, PermissionGuard, WorkflowApprovalGuard)
export class ProductGroupController {
  constructor(private readonly productGroupService: ProductGroupService) {}

  @Get()
  @RequirePermissions('product_group.read')
  listProductGroups(@Query() query: ProductGroupListQueryDto) {
    return this.productGroupService.listProductGroups(query);
  }

  @Post()
  @RequirePermissions('product_group.create')
  createProductGroup(@Body() body: CreateProductGroupDto) {
    return this.productGroupService.createProductGroup(body);
  }

  @Get(':id')
  @RequirePermissions('product_group.read')
  getProductGroupDetail(@Param('id') id: string) {
    return this.productGroupService.getProductGroupDetail(id);
  }

  @Put(':id')
  @RequirePermissions('product_group.update')
  updateProductGroup(@Param('id') id: string, @Body() body: UpdateProductGroupDto) {
    return this.productGroupService.updateProductGroup(id, body);
  }

  @Post('bulk-status')
  @RequirePermissions('product_group.update')
  bulkUpdateProductGroups(@Body() body: BulkUpdateProductGroupsDto) {
    return this.productGroupService.bulkUpdateProductGroups(body);
  }

  @Get(':id/highlight-specs')
  @RequirePermissions('product_group.read')
  listProductHighlightSpecs(
    @Param('id') id: string,
    @Query() query: ProductHighlightSpecQueryDto
  ) {
    return this.productGroupService.listProductHighlightSpecs(id, query);
  }

  @Get(':id/highlight-spec-suggestions')
  @RequirePermissions('product_group.read')
  listProductHighlightSpecSuggestions(
    @Param('id') id: string,
    @Query() query: ProductHighlightSpecSuggestionsQueryDto
  ) {
    return this.productGroupService.listProductHighlightSpecSuggestions(id, query);
  }

  @Post(':id/highlight-specs')
  @RequirePermissions('product_group.update')
  createProductHighlightSpec(
    @Param('id') id: string,
    @Body() body: CreateProductHighlightSpecDto
  ) {
    return this.productGroupService.createProductHighlightSpec(id, body);
  }

  @Put(':id/highlight-specs/:highlightId')
  @RequirePermissions('product_group.update')
  updateProductHighlightSpec(
    @Param('id') id: string,
    @Param('highlightId') highlightId: string,
    @Body() body: UpdateProductHighlightSpecDto
  ) {
    return this.productGroupService.updateProductHighlightSpec(id, highlightId, body);
  }

  @Post(':id/highlight-specs/reorder')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.update')
  reorderProductHighlightSpecs(
    @Param('id') id: string,
    @Body() body: ReorderProductHighlightSpecsDto
  ) {
    return this.productGroupService.reorderProductHighlightSpecs(id, body);
  }

  @Post(':id/highlight-specs/:highlightId/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.update')
  archiveProductHighlightSpec(
    @Param('id') id: string,
    @Param('highlightId') highlightId: string
  ) {
    return this.productGroupService.archiveProductHighlightSpec(id, highlightId);
  }

  @Get(':id/images')
  @RequirePermissions('product_group.read')
  listProductImages(@Param('id') id: string) {
    return this.productGroupService.listProductImages(id);
  }

  @Put(':id/images')
  @RequirePermissions('product_group.update')
  replaceProductImages(@Param('id') id: string, @Body() body: ReplaceProductGalleryDto) {
    return this.productGroupService.replaceProductImages(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.archive')
  archiveProductGroup(@Param('id') id: string) {
    return this.productGroupService.archiveProductGroup(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('product_group.restore')
  restoreProductGroup(@Param('id') id: string) {
    return this.productGroupService.restoreProductGroup(id);
  }
}
