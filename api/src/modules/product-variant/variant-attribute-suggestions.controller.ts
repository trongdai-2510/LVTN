import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { VariantAttributeSuggestionsService } from './variant-attribute-suggestions.service';

@Controller('admin/variant-attributes')
@UseGuards(AuthGuard, PermissionGuard)
export class VariantAttributeSuggestionsController {
  constructor(
    private readonly variantAttributeSuggestionsService: VariantAttributeSuggestionsService
  ) {}

  @Get('name-suggestions')
  @RequirePermissions('product_variant.read')
  listNameSuggestions() {
    return this.variantAttributeSuggestionsService.listNameSuggestions();
  }
}
