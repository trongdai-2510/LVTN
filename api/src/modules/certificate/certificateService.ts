import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { CertificateDto, UpdateCertificateDto } from './certificateDto';
import { CertificateRepository, type CertificateInput } from './certificateRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CertificateService {
  constructor(private readonly repository: CertificateRepository) {}

  async list() { return { items: await this.repository.list() }; }
  async publicList() { return { items: await this.repository.publicList() }; }

  async create(body: CertificateDto) {
    const input = await this.normalize(body);
    return { certificate: await this.repository.create(input) };
  }

  async update(id: string, body: UpdateCertificateDto) {
    const old = await this.existing(id, false);
    const input = await this.normalize(body);
    if (!Object.keys(input).length) throw this.invalid('No certificate fields were provided.');
    const issuedDate = input.issued_date === undefined ? old.issued_date : input.issued_date;
    const expiresDate = input.expires_date === undefined ? old.expires_date : input.expires_date;
    if (issuedDate && expiresDate && expiresDate < issuedDate) {
      throw this.invalid('Expiry date must not precede issue date.');
    }
    await this.repository.update(old.id, input);
    return { certificate: await this.repository.find(old.id) };
  }

  async archive(id: string) {
    const row = await this.existing(id, false);
    await this.repository.archive(row.id);
    return { certificate: await this.repository.find(row.id) };
  }

  async restore(id: string) {
    const row = await this.existing(id, true);
    for (const [field, image] of [['file_id', false], ['image_file_id', true]] as const) {
      const fileId = row[field];
      if (fileId && !await this.repository.fileExists(fileId, image)) throw this.invalid('Certificate file is no longer available.', HttpStatus.CONFLICT);
    }
    await this.repository.restore(row.id);
    return { certificate: await this.repository.find(row.id) };
  }

  private async existing(id: string, archived: boolean) {
    if (!UUID.test(id)) throw this.invalid('certificate_id must be a UUID.');
    const row = await this.repository.find(id);
    if (!row) throw new AppError({ code: ErrorCodes.NOT_FOUND, message: 'Certificate was not found.', statusCode: HttpStatus.NOT_FOUND });
    if (Boolean(row.deleted_at) !== archived) throw this.invalid(archived ? 'Certificate is not archived.' : 'Certificate is archived.', HttpStatus.CONFLICT);
    return row;
  }

  private async normalize(body: CertificateDto | UpdateCertificateDto): Promise<CertificateInput> {
    const input: CertificateInput = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title || title.length > 255) throw this.invalid('Title must contain 1 to 255 characters.');
      input.title = title;
    }
    for (const [field, image] of [['file_id', false], ['image_file_id', true]] as const) {
      const value = body[field];
      if (value !== undefined) {
        if (value && (!UUID.test(value) || !await this.repository.fileExists(value, image))) throw this.invalid('Certificate file is invalid or unavailable.');
        input[field] = value ?? null;
      }
    }
    for (const field of ['issued_date', 'expires_date', 'sort_order', 'status'] as const) {
      if (body[field] !== undefined) (input as Record<string, unknown>)[field] = body[field];
    }
    if (input.issued_date && input.expires_date && input.expires_date < input.issued_date) throw this.invalid('Expiry date must not precede issue date.');
    return input;
  }

  private invalid(message: string, statusCode = HttpStatus.BAD_REQUEST) {
    return new AppError({ code: ErrorCodes.VALIDATION_ERROR, message, statusCode });
  }
}
