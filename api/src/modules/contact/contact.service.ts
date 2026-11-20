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
import { ContactAssigneeDto, ContactInternalNoteDto, ContactListQueryDto, ContactStatusDto } from './contact.dto';
import {
  assertDateRange,
  assertUuid,
  normalizeDeletedScope,
  normalizeMutationStatus,
  normalizeNoteText,
  normalizeNullableAssignee,
  normalizeOptionalAssignee,
  normalizeOptionalSearch,
  normalizeStatusFilter
} from './contact.guardrails';
import { ContactRepository } from './contact.repository';
import type { ContactDetailRecord } from './contact.types';

@Injectable()
export class ContactService {
  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly logicUsers: LogicUserReferenceRepository
  ) {}

  async listContacts(query: ContactListQueryDto) {
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
      created_from: createdFrom,
      created_to: createdTo,
      deleted_scope: normalizeDeletedScope(query.deleted_scope)
    };
    const result = await this.contactRepository.list({
      filters,
      limit: pagination.limit,
      offset: pagination.offset
    });

    return {
      items: result.items,
      assignee_options: await this.contactRepository.listAssigneeFilterOptions(),
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: {
        q: filters.q,
        status: filters.status,
        assigned_to: filters.assigned_to,
        created_from: createdFromInput,
        created_to: createdToInput,
        deleted_scope: filters.deleted_scope
      }
    };
  }

  async getContactDetail(contactId: string) {
    const id = assertUuid('contact_id', contactId);
    const contact = await this.contactRepository.findById(id);
    if (!contact) throw this.notFound('Contact request was not found.');
    return this.buildDetail(contact);
  }

  async updateStatus(contactId: string, input: ContactStatusDto) {
    const id = assertUuid('contact_id', contactId);
    const status = normalizeMutationStatus(input.status);
    const outcome = await this.contactRepository.updateStatus(id, status);
    this.assertActiveMutationOutcome(outcome);
    return this.getContactDetail(id);
  }

  async updateAssignee(contactId: string, input: ContactAssigneeDto) {
    const id = assertUuid('contact_id', contactId);
    const assignedTo = normalizeNullableAssignee(input.assigned_to);
    const outcome = await this.contactRepository.updateAssignee(id, assignedTo);
    if (outcome === 'assignee_not_found') {
      throw this.notFound('Assignee was not found.');
    }
    if (outcome === 'assignee_not_eligible') {
      throw this.conflict('Người này cần quyền xem và cập nhật trạng thái liên hệ để được phân công.');
    }
    this.assertActiveMutationOutcome(outcome);
    return this.getContactDetail(id);
  }

  async createInternalNote(
    contactId: string,
    input: ContactInternalNoteDto,
    currentUser: CurrentUser | null
  ) {
    const id = assertUuid('contact_id', contactId);
    const noteText = normalizeNoteText(input.note_text ?? input.note);
    const logicUserId = await this.requireLogicUserId(currentUser);
    const outcome = await this.contactRepository.createInternalNote(
      id,
      noteText,
      logicUserId
    );
    this.assertActiveMutationOutcome(outcome.status);
    return this.getContactDetail(id);
  }

  async archiveContact(contactId: string) {
    const id = assertUuid('contact_id', contactId);
    const outcome = await this.contactRepository.archive(id);
    if (outcome === 'not_found') throw this.notFound('Contact request was not found.');
    if (outcome === 'archived') throw this.conflict('Contact request is already archived.');
    return this.getContactDetail(id);
  }

  async restoreContact(contactId: string) {
    const id = assertUuid('contact_id', contactId);
    const outcome = await this.contactRepository.restore(id);
    if (outcome === 'not_found') throw this.notFound('Contact request was not found.');
    if (outcome === 'active') throw this.conflict('Contact request is not archived.');
    return this.getContactDetail(id);
  }

  async permanentlyDeleteContact(contactId: string, currentUser: CurrentUser | null) {
    const id = assertUuid('contact_id', contactId);
    this.assertSuperAdmin(currentUser);
    const outcome = await this.contactRepository.permanentlyDelete(id);
    if (outcome === 'not_found') throw this.notFound('Contact request was not found.');
    if (outcome === 'active') {
      throw this.conflict('Phải lưu trữ liên hệ trước khi xóa vĩnh viễn.');
    }
    return { id, deleted: true };
  }

  private async buildDetail(contact: ContactDetailRecord) {
    return {
      contact,
      internal_notes: await this.contactRepository.listInternalNotes(contact.id),
      assignee_options: await this.contactRepository.listAssigneeOptions()
    };
  }

  private assertActiveMutationOutcome(outcome: string): void {
    if (outcome === 'not_found') throw this.notFound('Contact request was not found.');
    if (outcome === 'archived') {
      throw this.conflict('Contact request is archived and cannot be processed.');
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'CONTACT_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
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
        message: 'Chỉ Super Admin được xóa vĩnh viễn liên hệ.',
        statusCode: HttpStatus.FORBIDDEN
      });
    }
  }
}
