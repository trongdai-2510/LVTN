import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { CreatePartnerDto, UpdatePartnerDto } from './partnerDto';
import { PartnerRepository, type PartnerInput } from './partnerRepository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PartnerService {
  constructor(private readonly repository: PartnerRepository) {}

  listPartners() {
    return this.repository.list().then((items) => ({ items }));
  }

  async getPartner(id: string) {
    const partner = await this.repository.find(this.assertId(id));
    if (!partner) throw this.notFound();
    return { partner };
  }

  async createPartner(body: CreatePartnerDto) {
    const name = this.name(body.name);
    const logo_file_id = await this.logo(body.logo_file_id);
    const website_url = this.website(body.website_url);
    const created = await this.repository.create({
      name, logo_file_id, website_url,
      sort_order: body.sort_order ?? 0,
      status: body.status ?? 'active'
    });
    return { partner: created };
  }

  async updatePartner(id: string, body: UpdatePartnerDto) {
    const partner = await this.activePartner(id);
    const input: PartnerInput = {};
    if (body.name !== undefined) input.name = this.name(body.name);
    if (body.logo_file_id !== undefined) input.logo_file_id = await this.logo(body.logo_file_id);
    if (body.website_url !== undefined) input.website_url = this.website(body.website_url);
    if (body.sort_order !== undefined) input.sort_order = body.sort_order;
    if (body.status !== undefined) input.status = body.status;
    if (Object.keys(input).length === 0) throw this.invalid('No partner fields were provided.');
    await this.repository.update(partner.id, input);
    return this.getPartner(partner.id);
  }

  async archivePartner(id: string) {
    const partner = await this.activePartner(id);
    await this.repository.archive(partner.id);
    return this.getPartner(partner.id);
  }

  async restorePartner(id: string) {
    const partner = await this.repository.find(this.assertId(id));
    if (!partner) throw this.notFound();
    if (!partner.deleted_at) throw this.invalid('Partner is not archived.', HttpStatus.CONFLICT);
    if (partner.logo_file_id && !await this.repository.logoExists(partner.logo_file_id)) {
      throw this.invalid('The archived partner logo is no longer available.', HttpStatus.CONFLICT);
    }
    await this.repository.restore(partner.id);
    return this.getPartner(partner.id);
  }

  private async activePartner(id: string) {
    const partner = await this.repository.find(this.assertId(id));
    if (!partner) throw this.notFound();
    if (partner.deleted_at) throw this.invalid('Partner is archived.', HttpStatus.CONFLICT);
    return partner;
  }

  private assertId(value: string): string {
    if (!UUID_PATTERN.test(value)) throw this.invalid('partner_id must be a UUID.');
    return value;
  }

  private name(value: string): string {
    const name = value.trim();
    if (!name || name.length > 255) throw this.invalid('Partner name must contain 1 to 255 characters.');
    return name;
  }

  private async logo(value: string | null | undefined): Promise<string | null> {
    if (!value) return null;
    if (!UUID_PATTERN.test(value)) throw this.invalid('logo_file_id must be a UUID.');
    if (!await this.repository.logoExists(value)) throw this.invalid('Partner logo file was not found.');
    return value;
  }

  private website(value: string | null | undefined): string | null {
    const website = value?.trim() || null;
    if (!website) return null;
    try {
      const url = new URL(website);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
        throw new Error('Invalid website URL');
      }
    } catch {
      throw this.invalid('Website must be a full http or https URL without credentials.');
    }
    return website;
  }

  private invalid(message: string, statusCode = HttpStatus.BAD_REQUEST) {
    return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode });
  }

  private notFound() {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Partner was not found.', statusCode: HttpStatus.NOT_FOUND });
  }
}
