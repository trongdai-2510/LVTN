import { HttpStatus, Injectable } from '@nestjs/common';

import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import type { CurrentUser } from '../../common/auth/auth.types';
import { CreateCustomerDto, CustomerListQueryDto, UpdateCustomerDto } from './customer.dto';
import {
  assertUuid,
  normalizeDeletedScope,
  normalizeNullableEmail,
  normalizeNullableText,
  normalizeOptionalSearch,
  normalizeRequiredText,
  normalizeSourceKind
} from './customer.guardrails';
import { CustomerRepository } from './customer.repository';
import type { CustomerMutationInput, CustomerProfileRecord } from './customer.types';

@Injectable()
export class CustomerService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async listCustomers(query: CustomerListQueryDto) {
    const pagination = getPaginationParams(query);
    const filters = {
      q: normalizeOptionalSearch(query.q),
      source_kind: normalizeSourceKind(query.source_kind),
      deleted_scope: normalizeDeletedScope(query.deleted_scope)
    };

    const result = await this.customerRepository.list({
      filters,
      limit: pagination.limit,
      offset: pagination.offset
    });

    return {
      items: result.items,
      pagination: createPaginationMeta({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: result.total
      }),
      filters
    };
  }

  async getCustomerDetail(customerId: string) {
    const id = assertUuid('customer_id', customerId);
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw this.notFound('Customer profile was not found.');
    }

    return this.buildDetail(customer);
  }

  async createCustomer(input: CreateCustomerDto) {
    const mutation = this.normalizeCreateInput(input);
    const created = await this.customerRepository.create(mutation);
    return this.getCustomerDetail(created.id);
  }

  async updateCustomer(customerId: string, input: UpdateCustomerDto) {
    const id = assertUuid('customer_id', customerId);
    const customer = await this.assertActiveCustomer(id);
    const mutation = this.normalizeUpdateInput(input);
    await this.customerRepository.update(customer.id, mutation);
    return this.getCustomerDetail(customer.id);
  }

  async archiveCustomer(customerId: string) {
    const id = assertUuid('customer_id', customerId);
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw this.notFound('Customer profile was not found.');
    }
    if (customer.deleted_at) {
      throw this.conflict('Customer profile is already archived.');
    }

    await this.customerRepository.archive(id);
    return this.getCustomerDetail(id);
  }

  async restoreCustomer(customerId: string) {
    const id = assertUuid('customer_id', customerId);
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw this.notFound('Customer profile was not found.');
    }
    if (!customer.deleted_at) {
      throw this.conflict('Customer profile is not archived.');
    }

    await this.customerRepository.restore(id);
    return this.getCustomerDetail(id);
  }

  async permanentlyDeleteCustomer(customerId: string, currentUser: CurrentUser | null) {
    const id = assertUuid('customer_id', customerId);
    if (!currentUser?.roles.includes('super_admin')) {
      throw new AppError({
        code: ErrorCodes.PERMISSION_DENIED,
        message: 'Chỉ Super Admin được xóa vĩnh viễn hồ sơ khách hàng.',
        statusCode: HttpStatus.FORBIDDEN
      });
    }

    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw this.notFound('Customer profile was not found.');
    }
    if (!customer.deleted_at) {
      throw this.conflict('Phải lưu trữ hồ sơ trước khi xóa vĩnh viễn.');
    }

    const activeSources = await this.customerRepository.countActiveSources(id);
    if (activeSources.contacts > 0 || activeSources.quotes > 0) {
      throw new AppError({
        code: 'CUSTOMER_PERMANENT_DELETE_BLOCKED',
        message: 'Không thể xóa vĩnh viễn vì hồ sơ vẫn còn liên hệ hoặc báo giá đang hoạt động.',
        statusCode: HttpStatus.CONFLICT,
        details: activeSources
      });
    }

    await this.customerRepository.permanentlyDelete(id);
    return { id, deleted: true };
  }

  private async buildDetail(customer: CustomerProfileRecord) {
    const [summary, interactions, contacts, quotes] = await Promise.all([
      this.customerRepository.findSummaryById(customer.id),
      this.customerRepository.listInteractions(customer.id),
      this.customerRepository.listRelatedContacts(customer.id),
      this.customerRepository.listRelatedQuotes(customer.id)
    ]);

    return {
      customer,
      summary: summary ?? {
        contact_count: 0,
        quote_count: 0,
        last_interaction_at: null,
        last_interaction_kind: null
      },
      interactions,
      contacts,
      quotes
    };
  }

  private async assertActiveCustomer(id: string): Promise<CustomerProfileRecord> {
    const customer = await this.customerRepository.findById(id);
    if (!customer) {
      throw this.notFound('Customer profile was not found.');
    }
    if (customer.deleted_at) {
      throw this.conflict('Customer profile is archived.');
    }
    return customer;
  }

  private normalizeCreateInput(input: CreateCustomerDto) {
    return {
      full_name: normalizeRequiredText('full_name', input.full_name),
      phone: normalizeNullableText('phone', input.phone) ?? null,
      email: normalizeNullableEmail(input.email) ?? null,
      company_name: normalizeNullableText('company_name', input.company_name) ?? null
    };
  }

  private normalizeUpdateInput(input: UpdateCustomerDto): CustomerMutationInput {
    const mutation: CustomerMutationInput = {};

    if (typeof input.full_name !== 'undefined') {
      mutation.full_name = normalizeRequiredText('full_name', input.full_name);
    }

    if (typeof input.phone !== 'undefined') {
      mutation.phone = normalizeNullableText('phone', input.phone) ?? null;
    }

    if (typeof input.email !== 'undefined') {
      mutation.email = normalizeNullableEmail(input.email) ?? null;
    }

    if (typeof input.company_name !== 'undefined') {
      mutation.company_name =
        normalizeNullableText('company_name', input.company_name) ?? null;
    }

    return mutation;
  }

  private notFound(message: string): AppError {
    return new AppError({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: HttpStatus.NOT_FOUND
    });
  }

  private conflict(message: string): AppError {
    return new AppError({
      code: 'CUSTOMER_CONFLICT',
      message,
      statusCode: HttpStatus.CONFLICT
    });
  }
}
