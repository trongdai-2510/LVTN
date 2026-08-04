import { Injectable } from '@nestjs/common';
import type { Knex } from 'knex';

import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { KnexService } from '../../db/knex.service';
import {
  CONTACT_INTERNAL_NOTE_TABLE,
  CONTACT_REQUEST_TABLE,
  type ContactAssigneeOption,
  type ContactDetailRecord,
  type ContactInternalNote,
  type ContactInternalNoteRecord,
  type ContactListFilters,
  type ContactListItem,
  type ContactRecord,
  type ContactStatus
} from './contact.types';

@Injectable()
export class ContactRepository {
  constructor(
    private readonly knexService: KnexService,
    private readonly logicUsers: LogicUserReferenceRepository
  ) {}

  async list(params: { filters: ContactListFilters; limit: number; offset: number }): Promise<{ items: ContactListItem[]; total: number }> {
    const alias = 'contact_request_record';
    const baseQuery = this.applyListFilters(this.knexService.db({ [alias]: CONTACT_REQUEST_TABLE }), alias, params.filters);
    const total = await this.countDistinct(baseQuery, `${alias}.id`);
    const rows = (await baseQuery
      .clone()
      .select(
        `${alias}.id`,
        `${alias}.customer_id`,
        `${alias}.full_name`,
        `${alias}.phone`,
        `${alias}.email`,
        `${alias}.company_name`,
        `${alias}.source_page`,
        `${alias}.status`,
        `${alias}.assigned_to`,
        `${alias}.created_at`,
        `${alias}.updated_at`,
        `${alias}.deleted_at`
      )
      .orderByRaw(`CASE WHEN ${alias}.deleted_at IS NULL THEN 0 ELSE 1 END ASC`)
      .orderBy(`${alias}.created_at`, 'desc')
      .offset(params.offset)
      .limit(params.limit)) as Array<Omit<ContactRecord, 'message' | 'ip_address' | 'user_agent'>>;

    const labels = await this.logicUsers.labelsByIds(
      rows.map((row) => row.assigned_to)
    );
    return {
      items: rows.map((row) => ({
        ...row,
        assigned_to_label:
          row.assigned_to === null ? null : labels.get(row.assigned_to) ?? null
      })),
      total
    };
  }

  async findById(id: string): Promise<ContactDetailRecord | null> {
    const row = await this.knexService.db<ContactRecord>(CONTACT_REQUEST_TABLE)
      .select(
        'id',
        'customer_id',
        'full_name',
        'phone',
        'email',
        'company_name',
        'message',
        'source_page',
        'status',
        'assigned_to',
        'created_at',
        'updated_at',
        'deleted_at',
        'ip_address',
        'user_agent'
      )
      .where({ id })
      .first();

    if (!row) return null;
    const labels = await this.logicUsers.labelsByIds([row.assigned_to]);
    return {
      ...row,
      assigned_to_label:
        row.assigned_to === null ? null : labels.get(row.assigned_to) ?? null
    };
  }

  async updateStatus(id: string, status: ContactStatus): Promise<boolean> {
    const updated = await this.knexService.db(CONTACT_REQUEST_TABLE).where({ id }).whereNull('deleted_at').update({ status });
    return updated > 0;
  }

  async archive(id: string): Promise<boolean> {
    const updated = await this.knexService.db(CONTACT_REQUEST_TABLE)
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: this.knexService.db.fn.now() });
    return updated > 0;
  }

  async restore(id: string): Promise<boolean> {
    const updated = await this.knexService.db(CONTACT_REQUEST_TABLE)
      .where({ id })
      .whereNotNull('deleted_at')
      .update({ deleted_at: null });
    return updated > 0;
  }

  async permanentlyDelete(id: string): Promise<boolean> {
    const deleted = await this.knexService.db(CONTACT_REQUEST_TABLE)
      .where({ id })
      .whereNotNull('deleted_at')
      .delete();
    return deleted > 0;
  }

  async updateAssignee(id: string, assignedTo: number | null): Promise<boolean> {
    const updated = await this.knexService.db(CONTACT_REQUEST_TABLE)
      .where({ id })
      .whereNull('deleted_at')
      .update({ assigned_to: assignedTo });
    return updated > 0;
  }

  async createInternalNote(contactId: string, noteText: string, addedBy: number | null): Promise<ContactInternalNoteRecord> {
    const [row] = await this.knexService.db<ContactInternalNoteRecord>(CONTACT_INTERNAL_NOTE_TABLE)
      .insert({
        contact_id: contactId,
        note_text: noteText,
        added_by: addedBy
      })
      .returning('*');
    return row;
  }

  async listInternalNotes(contactId: string): Promise<ContactInternalNote[]> {
    const rows = (await this.knexService.db<ContactInternalNoteRecord>(CONTACT_INTERNAL_NOTE_TABLE)
      .where({ contact_id: contactId })
      .whereNull('deleted_at')
      .select('id', 'contact_id', 'note_text', 'added_by', 'created_at', 'updated_at', 'deleted_at')
      .orderBy('created_at', 'asc')) as ContactInternalNoteRecord[];

    const labels = await this.logicUsers.labelsByIds(
      rows.map((row) => row.added_by)
    );
    return rows.map((row) => ({
      ...row,
      added_by_label:
        row.added_by === null ? null : labels.get(row.added_by) ?? null
    }));
  }

  async listAssigneeOptions(): Promise<ContactAssigneeOption[]> {
    return this.logicUsers.listAssignableUsers();
  }

  private applyListFilters(query: Knex.QueryBuilder, alias: string, filters: ContactListFilters): Knex.QueryBuilder {
    if (filters.deleted_scope === 'active') query.whereNull(`${alias}.deleted_at`);
    else if (filters.deleted_scope === 'deleted') query.whereNotNull(`${alias}.deleted_at`);
    if (filters.status !== 'all') query.where(`${alias}.status`, filters.status);
    if (filters.assigned_to !== null) query.where(`${alias}.assigned_to`, filters.assigned_to);
    if (filters.created_from) query.where(`${alias}.created_at`, '>=', filters.created_from);
    if (filters.created_to) query.where(`${alias}.created_at`, '<=', filters.created_to);
    if (filters.q) {
      const searchPattern = `%${filters.q}%`;
      query.andWhere((builder) => {
        builder
          .whereRaw('?? ILIKE ?', [`${alias}.full_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.phone`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.email`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.company_name`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.message`, searchPattern])
          .orWhereRaw('?? ILIKE ?', [`${alias}.source_page`, searchPattern]);
      });
    }
    return query;
  }

  private async countDistinct(query: Knex.QueryBuilder, column: string): Promise<number> {
    const row = (await query.clone().countDistinct({ total: column }).first()) as { total?: string | number } | undefined;
    return Number(row?.total ?? 0);
  }
}
