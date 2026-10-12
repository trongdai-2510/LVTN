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
    const mutation = this.normalizeUpdateInput(input);
    const outcome = await this.customerRepository.update(id, mutation);
    this.assertActiveMutationOutcome(outcome);
    return this.getCustomerDetail(id);
  }

  async archiveCustomer(customerId: string) {
    const id = assertUuid('customer_id', customerId);
    const outcome = await this.customerRepository.archive(id);
    if (outcome === 'not_found') {
      throw this.notFound('Customer profile was not found.');
    }
    if (outcome === 'archived') {
      throw this.conflict('Customer profile is already archived.');
    }
    return this.getCustomerDetail(id);
  }

  async restoreCustomer(customerId: string) {
    const id = assertUuid('customer_id', customerId);
    const outcome = await this.customerRepository.restore(id);
    if (outcome === 'not_found') {
      throw this.notFound('Customer profile was not found.');
    }
    if (outcome === 'active') {
      throw this.conflict('Customer profile is not archived.');
    }
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

    const outcome = await this.customerRepository.permanentlyDeleteWithGuard(id);
    if (outcome.status === 'not_found') {
      throw this.notFound('Customer profile was not found.');
    }
    if (outcome.status === 'active') {
      throw this.conflict('Phải lưu trữ hồ sơ trước khi xóa vĩnh viễn.');
    }

    if (outcome.status === 'blocked') {
      throw new AppError({
        code: 'CUSTOMER_PERMANENT_DELETE_BLOCKED',
        message: 'Không thể xóa vĩnh viễn vì hồ sơ vẫn còn liên hệ hoặc báo giá đang hoạt động.',
        statusCode: HttpStatus.CONFLICT,
        details: outcome.sources
      });
    }

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

  private assertActiveMutationOutcome(outcome: string): void {
    if (outcome === 'not_found') {
      throw this.notFound('Customer profile was not found.');
    }
    if (outcome === 'archived') {
      throw this.conflict('Customer profile is archived.');
    }
  }

  private normalizeCreateInput(input: CreateCustomerDto) {
    return {
      full_name: normalizeRequiredText('full_name', input.full_name, 128),
      phone: normalizeNullableText('phone', input.phone, 32) ?? null,
      email: normalizeNullableEmail(input.email) ?? null,
      company_name: normalizeNullableText('company_name', input.company_name, 255) ?? null
    };
  }

  private normalizeUpdateInput(input: UpdateCustomerDto): CustomerMutationInput {
    const mutation: CustomerMutationInput = {};

    if (typeof input.full_name !== 'undefined') {
      mutation.full_name = normalizeRequiredText('full_name', input.full_name, 128);
    }

    if (typeof input.phone !== 'undefined') {
      mutation.phone = normalizeNullableText('phone', input.phone, 32) ?? null;
    }

    if (typeof input.email !== 'undefined') {
      mutation.email = normalizeNullableEmail(input.email) ?? null;
    }

    if (typeof input.company_name !== 'undefined') {
      mutation.company_name =
        normalizeNullableText('company_name', input.company_name, 255) ?? null;
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
