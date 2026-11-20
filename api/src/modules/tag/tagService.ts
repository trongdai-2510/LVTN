import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { resolveAvailableSlug } from '../../common/text/slugify-text';
import { CreateTagDto, SetProductTagsDto, UpdateTagDto } from './tagDto';
import { TagRepository } from './tagRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
@Injectable()
export class TagService {
  constructor(private readonly repository: TagRepository) {}
  async list() { return { items: await this.repository.list() }; }
  async create(body: CreateTagDto) {
    const name = this.name(body.name);
    const slug = await resolveAvailableSlug(name, (value) => this.repository.slugExists(value), 64);
    return { tag: await this.repository.create(name, slug, body.status ?? 'active', body.icon_key ?? 'none', body.tone_key ?? 'blue') };
  }
  async update(id: string, body: UpdateTagDto) {
    const tag = await this.existing(id, false);
    const input: { name?: string; status?: 'active' | 'inactive'; icon_key?: NonNullable<UpdateTagDto['icon_key']>; tone_key?: NonNullable<UpdateTagDto['tone_key']> } = {};
    if (body.name !== undefined) input.name = this.name(body.name);
    if (body.status !== undefined) input.status = body.status;
    if (body.icon_key !== undefined) input.icon_key = body.icon_key ?? 'none';
    if (body.tone_key !== undefined) input.tone_key = body.tone_key ?? 'blue';
    if (!Object.keys(input).length) throw this.invalid('No tag fields were provided.');
    await this.repository.update(tag.id, input);
    return { tag: await this.repository.find(tag.id) };
  }
  async archive(id: string) { const row = await this.existing(id,false); await this.repository.archive(row.id); return { tag: await this.repository.find(row.id) }; }
  async restore(id: string) { const row = await this.existing(id,true); if (await this.repository.slugExists(row.slug)) throw this.invalid('Tag slug is already in use.',HttpStatus.CONFLICT); await this.repository.restore(row.id); return { tag: await this.repository.find(row.id) }; }
  async listForProduct(id: string) { this.id(id); return { items: await this.repository.listForProduct(id) }; }
  async setForProduct(id: string, body: SetProductTagsDto, actorIsSuperAdmin: boolean) {
    this.id(id);
    try { await this.repository.setForProduct(id, body.tag_ids, actorIsSuperAdmin); }
    catch (error) {
      if (error instanceof Error && error.message === 'PRODUCT_NOT_FOUND') throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Product was not found.', statusCode: HttpStatus.NOT_FOUND });
      if (error instanceof Error && error.message === 'TAG_UNAVAILABLE') throw this.invalid('Only active tags can be assigned.');
      throw error;
    }
    return this.listForProduct(id);
  }
  private name(value: string) { const name=value.trim(); if (!name || name.length>64) throw this.invalid('Tag name must contain 1 to 64 characters.'); return name; }
  private id(value: string) { if (!UUID.test(value)) throw this.invalid('id must be a UUID.'); }
  private async existing(id: string, archived: boolean) { this.id(id); const row=await this.repository.find(id); if (!row) throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Tag was not found.', statusCode: HttpStatus.NOT_FOUND }); if (Boolean(row.deleted_at)!==archived) throw this.invalid(archived?'Tag is not archived.':'Tag is archived.',HttpStatus.CONFLICT); return row; }
  private invalid(message: string,statusCode=HttpStatus.BAD_REQUEST) { return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode }); }
}
