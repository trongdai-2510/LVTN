import { Injectable } from '@nestjs/common';
import { KnexService } from '../../db/knex.service';
import type { TagIconKey, TagToneKey } from './tagDto';

export interface TagRecord { id: string; name: string; slug: string; status: 'active' | 'inactive'; icon_key: TagIconKey | null; tone_key: TagToneKey | null; deleted_at: string | null; product_count?: string | number; }

@Injectable()
export class TagRepository {
  constructor(private readonly knexService: KnexService) {}
  list() {
    return this.knexService.db('tag as tag_record')
      .leftJoin('product_group_tag as link', function () {
        this.on('link.tag_id', '=', 'tag_record.id').onNull('link.deleted_at');
      })
      .leftJoin('product_group as product', function () {
        this.on('product.id', '=', 'link.product_group_id').onNull('product.deleted_at');
      })
      .select('tag_record.id', 'tag_record.name', 'tag_record.slug', 'tag_record.status', 'tag_record.icon_key', 'tag_record.tone_key', 'tag_record.deleted_at')
      .countDistinct({ product_count: 'product.id' })
      .groupBy('tag_record.id')
      .orderByRaw('CASE WHEN tag_record.deleted_at IS NULL THEN 0 ELSE 1 END')
      .orderBy('tag_record.name');
  }
  async find(id: string): Promise<TagRecord | null> { return await this.knexService.db<TagRecord>('tag').where({ id }).first() ?? null; }
  async slugExists(slug: string): Promise<boolean> { return Boolean(await this.knexService.db('tag').where({ slug }).whereNull('deleted_at').first('id')); }
  async create(name: string, slug: string, status: 'active' | 'inactive', iconKey: TagIconKey, toneKey: TagToneKey) {
    const [row] = await this.knexService.db<TagRecord>('tag').insert({ name, slug, status, icon_key: iconKey, tone_key: toneKey }).returning('*'); return row;
  }
  async update(id: string, input: Partial<Pick<TagRecord,'name'|'status'|'icon_key'|'tone_key'>>) { await this.knexService.db('tag').where({ id }).whereNull('deleted_at').update(input); }
  async archive(id: string) { await this.knexService.db('tag').where({ id }).whereNull('deleted_at').update({ deleted_at: this.knexService.db.fn.now() }); }
  async restore(id: string) { await this.knexService.db('tag').where({ id }).whereNotNull('deleted_at').update({ deleted_at: null }); }
  async listForProduct(id: string) {
    return this.knexService.db('product_group_tag as link').join('tag as t','t.id','link.tag_id')
      .where('link.product_group_id',id).whereNull('link.deleted_at').whereNull('t.deleted_at')
      .select('t.id','t.name','t.slug','t.status','t.icon_key','t.tone_key').orderBy('t.name');
  }
  async setForProduct(id: string, tagIds: string[], actorIsSuperAdmin: boolean): Promise<void> {
    await this.knexService.db.transaction(async (trx) => {
      const group = await trx('product_group').where({ id }).whereNull('deleted_at').forUpdate().first('id','review_status','publish_status');
      if (!group) throw new Error('PRODUCT_NOT_FOUND');
      const oldLinks = await trx('product_group_tag').where({ product_group_id: id }).whereNull('deleted_at').select('tag_id');
      const oldIds = oldLinks.map((row) => String(row.tag_id)).sort();
      const tags = tagIds.length ? await trx('tag').whereIn('id',tagIds).whereNull('deleted_at').select('id','status') : [];
      if (tags.length !== tagIds.length || tags.some((tag) => tag.status !== 'active' && !oldIds.includes(String(tag.id)))) {
        throw new Error('TAG_UNAVAILABLE');
      }
      const nextIds = [...tagIds].sort();
      if (!actorIsSuperAdmin && group.review_status === 'approved' && group.publish_status === 'published' && oldIds.join(',') !== nextIds.join(',')) {
        await trx('product_group').where({ id }).update({ review_status: 'pending_review', publish_status: 'unpublished' });
      }
      await trx('product_group_tag').where({ product_group_id: id }).whereNull('deleted_at').whereNotIn('tag_id',tagIds).update({ deleted_at: trx.fn.now() });
      for (const tagId of tagIds) {
        await trx('product_group_tag').insert({ product_group_id: id, tag_id: tagId, deleted_at: null })
          .onConflict(['product_group_id','tag_id']).merge({ deleted_at: null });
      }
    });
  }
}
