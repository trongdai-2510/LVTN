import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../../common/auth/auth.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { RequirePermissions } from '../../common/permissions/permission.decorator';
import { PermissionGuard } from '../../common/permissions/permission.guard';
import { CreateCustomerDto, CustomerListQueryDto, UpdateCustomerDto } from './customer.dto';
import { CustomerService } from './customer.service';

@Controller('song-thanh/customers')
@UseGuards(AuthGuard, PermissionGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @RequirePermissions('customer.read')
  listCustomers(@Query() query: CustomerListQueryDto) {
    return this.customerService.listCustomers(query);
  }

  @Post()
  @RequirePermissions('customer.create')
  createCustomer(@Body() body: CreateCustomerDto) {
    return this.customerService.createCustomer(body);
  }

  @Get(':id')
  @RequirePermissions('customer.read')
  getCustomerDetail(@Param('id') id: string) {
    return this.customerService.getCustomerDetail(id);
  }

  @Put(':id')
  @RequirePermissions('customer.update')
  updateCustomer(@Param('id') id: string, @Body() body: UpdateCustomerDto) {
    return this.customerService.updateCustomer(id, body);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('customer.archive')
  archiveCustomer(@Param('id') id: string) {
    return this.customerService.archiveCustomer(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('customer.restore')
  restoreCustomer(@Param('id') id: string) {
    return this.customerService.restoreCustomer(id);
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('customer.archive')
  permanentlyDeleteCustomer(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserContext | null
  ) {
    return this.customerService.permanentlyDeleteCustomer(id, currentUser);
  }
}
