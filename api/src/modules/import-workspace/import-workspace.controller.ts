import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import {
  BulkApprovePendingRowsDto,
  ConfirmImportMappingDto,
  ImportBatchListQueryDto,
  ImportConflictListQueryDto,
  ImportIntakeDto,
  ImportStagingListQueryDto,
  ImportUploadDto,
  PendingVariantListQueryDto,
  ResolveConflictDto,
  ReviewTransitionDto
} from './import-workspace.dto';
import type { UploadedImportWorkbookFile } from './import-workbook-upload';
import { MAX_IMPORT_WORKBOOK_BYTES } from './import-workbook-limits';
import { ImportWorkspaceService } from './import-workspace.service';

@Controller('song-thanh/import-batches')
@UseGuards(AuthGuard, PermissionGuard)
export class ImportWorkspaceController {
  constructor(private readonly importWorkspaceService: ImportWorkspaceService) {}

  @Get()
  @RequirePermissions('import.read')
  listImportBatches(@Query() query: ImportBatchListQueryDto) {
    return this.importWorkspaceService.listImportBatches(query);
  }

  @Post('intake')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.intake')
  intakeImportBatch(
    @Body() body: ImportIntakeDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.importWorkspaceService.intakeImportBatch(body, currentUser);
  }

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMPORT_WORKBOOK_BYTES, files: 1 }
    })
  )
  @RequirePermissions('import.intake')
  uploadImportBatch(
    @UploadedFile() file: UploadedImportWorkbookFile | undefined,
    @Body() body: ImportUploadDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.importWorkspaceService.uploadImportBatch(file, body, currentUser);
  }

  @Post(':id/confirm-mapping')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.intake')
  confirmImportBatchMapping(
    @Param('id') id: string,
    @Body() body: ConfirmImportMappingDto
  ) {
    return this.importWorkspaceService.confirmImportBatchMapping(id, body);
  }

  @Get(':id/pending-product-groups')
  @RequirePermissions('import.read')
  listPendingProductGroups(@Param('id') id: string, @Query() query: ImportStagingListQueryDto) {
    return this.importWorkspaceService.listPendingProductGroups(id, query);
  }

  @Get(':id/pending-product-groups/:pendingGroupId')
  @RequirePermissions('import.read')
  getPendingProductGroupDetail(
    @Param('id') id: string,
    @Param('pendingGroupId') pendingGroupId: string
  ) {
    return this.importWorkspaceService.getPendingProductGroupDetail(id, pendingGroupId);
  }

  @Post(':id/pending-product-groups/bulk-approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.review')
  bulkApprovePendingProductGroups(
    @Param('id') id: string,
    @Body() body: BulkApprovePendingRowsDto
  ) {
    return this.importWorkspaceService.bulkApprovePendingProductGroups(id, body);
  }

  @Get(':id/pending-variants')
  @RequirePermissions('import.read')
  listPendingVariants(@Param('id') id: string, @Query() query: PendingVariantListQueryDto) {
    return this.importWorkspaceService.listPendingVariants(id, query);
  }

  @Get(':id/pending-variants/:pendingVariantId')
  @RequirePermissions('import.read')
  getPendingVariantDetail(
    @Param('id') id: string,
    @Param('pendingVariantId') pendingVariantId: string
  ) {
    return this.importWorkspaceService.getPendingVariantDetail(id, pendingVariantId);
  }

  @Post(':id/pending-variants/bulk-approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.review')
  bulkApprovePendingVariants(
    @Param('id') id: string,
    @Body() body: BulkApprovePendingRowsDto
  ) {
    return this.importWorkspaceService.bulkApprovePendingVariants(id, body);
  }

  @Get(':id/conflicts')
  @RequirePermissions('import.read')
  listConflicts(@Param('id') id: string, @Query() query: ImportConflictListQueryDto) {
    return this.importWorkspaceService.listConflicts(id, query);
  }

  @Get(':id/readiness')
  @RequirePermissions('import.read')
  getImportBatchReadiness(@Param('id') id: string) {
    return this.importWorkspaceService.getImportBatchReadiness(id);
  }

  @Get(':id/apply-preview')
  @RequirePermissions('import.read')
  getImportBatchApplyPreview(@Param('id') id: string) {
    return this.importWorkspaceService.getImportBatchApplyPreview(id);
  }

  @Get(':id/category-options')
  @RequirePermissions('import.read')
  listImportCategoryOptions(@Param('id') id: string) {
    return this.importWorkspaceService.listImportCategoryOptions(id);
  }

  @Post(':id/taxonomy-baseline-bootstrap')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.taxonomy_bootstrap')
  bootstrapTaxonomyBaseline(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.importWorkspaceService.bootstrapTaxonomyBaseline(id, currentUser);
  }

  @Post(':id/review-transition')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.review')
  reviewTransition(@Param('id') id: string, @Body() body: ReviewTransitionDto) {
    return this.importWorkspaceService.reviewTransition(id, body);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.apply')
  applyImportBatch(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.importWorkspaceService.applyImportBatch(id, currentUser);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.review')
  archiveImportBatch(@Param('id') id: string) {
    return this.importWorkspaceService.archiveImportBatch(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.review')
  restoreImportBatch(@Param('id') id: string) {
    return this.importWorkspaceService.restoreImportBatch(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.review')
  deleteImportBatch(@Param('id') id: string) {
    return this.importWorkspaceService.deleteImportBatch(id);
  }

  @Get(':id')
  @RequirePermissions('import.read')
  getImportBatchDetail(@Param('id') id: string) {
    return this.importWorkspaceService.getImportBatchDetail(id);
  }
}

@Controller('song-thanh/import-conflicts')
@UseGuards(AuthGuard, PermissionGuard)
export class ImportConflictController {
  constructor(private readonly importWorkspaceService: ImportWorkspaceService) {}

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('import.conflict_resolve')
  resolveConflict(
    @Param('id') id: string,
    @Body() body: ResolveConflictDto,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.importWorkspaceService.resolveConflict(id, body, currentUser);
  }
}
