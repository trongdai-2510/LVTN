import { Module } from '@nestjs/common';

import { CustomerController } from './customer.controller';
import { CustomerRepository } from './customer.repository';
import { CustomerService } from './customer.service';

@Module({
  controllers: [CustomerController],
  providers: [CustomerRepository, CustomerService],
  exports: [CustomerRepository]
})
export class CustomerModule {}
