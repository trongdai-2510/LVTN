import { HttpStatus, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error';
import type { CurrentUser } from '../../common/auth/auth.types';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import {
  localDateToUtcBoundary,
  normalizeOptionalLocalDate
} from '../../common/validation/date-filter';
import { QuoteAssigneeDto, QuoteInternalNoteDto, QuoteListQueryDto, QuoteStatusDto } from './quote.dto';
import {
  assertDateRange,
  assertUuid,
  normalizeDeletedScope,
  normalizeMutationStatus,
  normalizeNoteText,
  normalizeNullableAssignee,
  normalizeOptionalAssignee,
  normalizeOptionalSearch,
  normalizeOptionalUuid,
  normalizeStatusFilter
} from './quote.guardrails';
import { QuoteRepository } from './quote.repository';
import type { QuoteDetailRecord } from './quote.types';

@Injectable()
export class QuoteService {
  constructor(
    private readonly quoteRepository: QuoteRepository,
    private readonly logicUsers: LogicUserReferenceRepository
  ) {}

  async listQuotes(query: QuoteListQueryDto) {
    const pagination = getPaginationParams(query);
    const createdFromInput = normalizeOptionalLocalDate(
      'created_from',
      query.created_from
    );
    const createdToInput = normalizeOptionalLocalDate(
      'created_to',
      query.created_to
    );
    const createdFrom = localDateToUtcBoundary(createdFromInput, 'start');
    const createdTo = localDateToUtcBoundary(createdToInput, 'end');
    assertDateRange(createdFrom, createdTo);
    const filters = {
      q: normalizeOptionalSearch(query.q),
      status: normalizeStatusFilter(query.status),
      assigned_to: normalizeOptionalAssignee(query.assigned_to),
      product_group_id: normalizeOptionalUuid('product_group_id', query.product_group_id),
      product_variant_id: normalizeOptionalUuid('product_variant_id', query.product_variant_id),
      created_from: createdFrom,
      created_to: createdTo,
      deleted_scope: normalizeDeletedScope(query.deleted_scope)
    };
    const result = await this.quoteRepository.list({
      filters,
      limit: pagination.limit,
      offset: pagination.offset
    });

    return {
      items: result.items,
      assignee_options: await this.quoteRepository.listAssigneeOptions(),
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: {
        q: filters.q,
        status: filters.status,
        assigned_to: filters.assigned_to,
        product_group_id: filters.product_group_id,
        product_variant_id: filters.product_variant_id,
        created_from: createdFromInput,
        created_to: createdToInput,
        deleted_scope: filters.deleted_scope
      }
    };
  }

  async getQuoteDetail(quoteId: string) {
    const id = assertUuid('quote_id', quoteId);
    const quote = await this.quoteRepository.findById(id);
    if (!quote) throw this.notFound('Quote request was not found.');
    return this.buildDetail(quote);
  }

  async updateStatus(quoteId: string, input: QuoteStatusDto) {
    const id = assertUuid('quote_id', quoteId);
    const status = normalizeMutationStatus(input.status);
    const outcome = await this.quoteRepository.updateStatus(id, status);
    this.assertActiveMutationOutcome(outcome);
    return this.getQuoteDetail(id);
  }

  async updateAssignee(quoteId: string, input: QuoteAssigneeDto) {
    const id = assertUuid('quote_id', quoteId);
    const assignedTo = normalizeNullableAssignee(input.assigned_to);
    const outcome = await this.quoteRepository.updateAssignee(id, assignedTo);
    if (outcome === 'assignee_not_found') {
      throw this.notFound('Assignee was not found.');
    }
    this.assertActiveMutationOutcome(outcome);
    return this.getQuoteDetail(id);
  }

  async archiveQuote(quoteId: string) {
    const id = assertUuid('quote_id', quoteId);
    const outcome = await this.quoteRepository.archive(id);
    if (outcome === 'not_found') throw this.notFound('Quote request was not found.');
    if (outcome === 'archived') throw this.conflict('Quote request is already archived.');
    return this.getQuoteDetail(id);
  }

  async restoreQuote(quoteId: string) {
    const id = assertUuid('quote_id', quoteId);
    const outcome = await this.quoteRepository.restore(id);
    if (outcome === 'not_found') throw this.notFound('Quote request was not found.');
    if (outcome === 'active') throw this.conflict('Quote request is not archived.');
    return this.getQuoteDetail(id);
  }

  async permanentlyDeleteQuote(quoteId: string, currentUser: CurrentUser | null) {
    const id = assertUuid('quote_id', quoteId);
    this.assertSuperAdmin(currentUser);
    const outcome = await this.quoteRepository.permanentlyDelete(id);
    if (outcome === 'not_found') throw this.notFound('Quote request was not found.');
    if (outcome === 'active') {
      throw this.conflict('Phải lưu trữ yêu cầu báo giá trước khi xóa vĩnh viễn.');
    }
    return { id, deleted: true };
  }

  async createInternalNote(
    quoteId: string,
    input: QuoteInternalNoteDto,
    currentUser: CurrentUser | null
  ) {
    const id = assertUuid('quote_id', quoteId);
    const noteText = normalizeNoteText(input.note_text ?? input.note);
    const logicUserId = await this.requireLogicUserId(currentUser);
    const outcome = await this.quoteRepository.createInternalNote(
      id,
      noteText,
      logicUserId
    );
    this.assertActiveMutationOutcome(outcome.status);
    return this.getQuoteDetail(id);
  }

  private async buildDetail(quote: QuoteDetailRecord) {
    return {
      quote,
      items: await this.quoteRepository.listItems(quote.id),
      internal_notes: await this.quoteRepository.listInternalNotes(quote.id),
      assignee_options: await this.quoteRepository.listAssigneeOptions()
    };
  }

  private assertActiveMutationOutcome(outcome: string): void {
    if (outcome === 'not_found') throw this.notFound('Quote request was not found.');
    if (outcome === 'archived') {
      throw this.conflict('Quote request is archived and cannot be processed.');
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'QUOTE_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }

  private async requireLogicUserId(
    currentUser: CurrentUser | null
  ): Promise<number> {
    if (!currentUser) {
      throw new AppError({
        code: ErrorCodes.AUTH_UNAUTHORIZED,
        message: 'Authentication is required.',
        statusCode: HttpStatus.UNAUTHORIZED
      });
    }
    const logicUserId = await this.logicUsers.findLogicUserId(currentUser.id);
    if (logicUserId === null) {
      throw new AppError({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'The authenticated user has no business reference id.',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR
      });
    }
    return logicUserId;
  }

  private assertSuperAdmin(currentUser: CurrentUser | null): void {
    if (!currentUser?.roles.includes('super_admin')) {
      throw new AppError({
        code: ErrorCodes.PERMISSION_DENIED,
        message: 'Chỉ Super Admin được xóa vĩnh viễn yêu cầu báo giá.',
        statusCode: HttpStatus.FORBIDDEN
      });
    }
  }
}
