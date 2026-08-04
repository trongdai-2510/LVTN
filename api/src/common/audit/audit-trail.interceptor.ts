import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from '@nestjs/common';
import type { Request } from 'express';
import { from, of, type Observable } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

import type { CurrentUser } from '../auth/auth.types';
import { KnexService } from '../../db/knex.service';
import type { AuditLogAction } from '../../modules/audit-log/audit-log.types';

type RequestWithUser = Request & { user?: CurrentUser };

interface AuditTarget {
  fragment: string;
  entityType: string;
  table: string | null;
  parameterNames?: string[];
  singleton?: boolean;
}

const ENTITY_TARGETS: AuditTarget[] = [
  {
    fragment: '/website-settings/social-links',
    entityType: 'company_social_link',
    table: 'company_social_link'
  },
  {
    fragment: '/website-settings',
    entityType: 'company_info',
    table: 'company_info',
    singleton: true
  },
  { fragment: '/home-page', entityType: 'home_page', table: null, singleton: true },
  { fragment: '/page-contents', entityType: 'page_content', table: 'page_content' },
  {
    fragment: '/product-categories',
    entityType: 'product_category',
    table: 'product_category'
  },
  { fragment: '/product-groups', entityType: 'product_group', table: 'product_group' },
  {
    fragment: '/product-variants',
    entityType: 'product_variant',
    table: 'product_variant'
  },
  {
    fragment: '/technical-documents',
    entityType: 'technical_document',
    table: 'technical_document'
  },
  { fragment: '/admin-users', entityType: 'admin_user', table: 'admin_user' },
  { fragment: '/admin-roles', entityType: 'admin_role', table: 'admin_role' },
  { fragment: '/contacts', entityType: 'contact_request', table: 'contact_request' },
  { fragment: '/customers', entityType: 'customer_profile', table: 'customer_profile' },
  { fragment: '/quotes', entityType: 'quote_request', table: 'quote_request' },
  { fragment: '/import-batches', entityType: 'import_batch', table: 'import_batch' },
  { fragment: '/import-conflicts', entityType: 'data_conflict', table: 'data_conflict' },
  { fragment: '/files', entityType: 'file_metadata', table: 'file_metadata' },
  { fragment: '/news-categories', entityType: 'news_category', table: 'news_category' },
  { fragment: '/brand-pages', entityType: 'brand_page', table: 'brand_page' },
  { fragment: '/brands', entityType: 'brand', table: 'brand' },
  { fragment: '/banners', entityType: 'banner', table: 'banner' },
  { fragment: '/redirects', entityType: 'redirect_rule', table: 'redirect_rule' },
  { fragment: '/services', entityType: 'service', table: 'service' },
  { fragment: '/projects', entityType: 'project', table: 'project' },
  {
    fragment: '/menu-items',
    entityType: 'menu_item',
    table: 'menu_item',
    parameterNames: ['itemId']
  },
  { fragment: '/menus', entityType: 'menu', table: 'menu' }
];

const DEFAULT_PARAMETER_NAMES = [
  'id',
  'itemId',
  'usageId',
  'pendingGroupId',
  'pendingVariantId',
  'attributeId',
  'highlightId',
  'galleryId'
];

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditTrailInterceptor.name);

  constructor(private readonly knexService: KnexService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const method = request.method.toUpperCase();
    const user = request.user;
    const path = request.originalUrl.split('?')[0] ?? '';

    if (!user || ['GET', 'HEAD', 'OPTIONS'].includes(method) || path.includes('/auth/')) {
      return next.handle();
    }

    const target = this.resolveTarget(path);
    if (!target || target.entityType === 'audit_log') {
      return next.handle();
    }

    return from(this.readOldValue(request, target)).pipe(
      catchError((error: unknown) => {
        this.logAuditFailure('snapshot', request, error);
        return of(null);
      }),
      mergeMap((oldValue) =>
        next.handle().pipe(
          mergeMap(async (response) => {
            try {
              await this.writeAuditLog(request, user, response, target, oldValue);
            } catch (error) {
              // Contract: a failed audit write does not turn a committed business
              // mutation into an HTTP failure. It must still be observable in logs.
              this.logAuditFailure('write', request, error);
            }
            return response;
          })
        )
      )
    );
  }

  private async writeAuditLog(
    request: RequestWithUser,
    user: CurrentUser,
    response: unknown,
    target: AuditTarget,
    oldValue: unknown
  ): Promise<void> {
    const path = request.originalUrl.split('?')[0] ?? '';
    const entityId =
      this.extractRequestEntityId(request, target) ||
      this.extractResponseId(response) ||
      'singleton';
    const body = this.redactSecrets(request.body);
    const responseRecord = this.extractResponseRecord(response);
    const newValue = this.redactSecrets(responseRecord ?? body);
    const normalizedOldValue = this.redactSecrets(oldValue);

    await this.knexService.db('audit_log').insert({
      entity_type: target.entityType,
      entity_id: entityId,
      actor_id: user.id,
      action: this.resolveAction(request.method, path, request.body),
      old_value: normalizedOldValue,
      new_value: newValue,
      changed_fields: this.resolveChangedFields(body, normalizedOldValue, newValue),
      ip_address: request.ip || null,
      user_agent: request.get('user-agent') || null
    });
  }

  private resolveTarget(path: string): AuditTarget | null {
    return ENTITY_TARGETS.find((target) => path.includes(target.fragment)) ?? null;
  }

  private async readOldValue(
    request: RequestWithUser,
    target: AuditTarget
  ): Promise<unknown> {
    if (!target.table) return null;
    const entityId = this.extractRequestEntityId(request, target);
    if (entityId) {
      return (await this.knexService.db(target.table).where({ id: entityId }).first()) ?? null;
    }
    if (target.singleton) {
      return (
        (await this.knexService
          .db(target.table)
          .whereNull('deleted_at')
          .orderBy('created_at', 'asc')
          .first()) ?? null
      );
    }
    return null;
  }

  private extractRequestEntityId(
    request: RequestWithUser,
    target: AuditTarget
  ): string | null {
    for (const name of target.parameterNames ?? DEFAULT_PARAMETER_NAMES) {
      const value = request.params?.[name];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  private resolveAction(method: string, path: string, body: unknown): AuditLogAction {
    if (path.endsWith('/restore')) return 'restore';
    if (path.endsWith('/archive')) return 'archive';
    if (path.includes('/apply')) return 'apply_import';
    if (path.includes('/resolve')) return 'resolve_conflict';
    if (path.endsWith('/permanent')) return 'other';
    if (method.toUpperCase() === 'DELETE') return 'soft_delete';
    if (method.toUpperCase() === 'POST') return 'create';
    if (this.bodyPublishes(body)) return 'publish';
    if (['PUT', 'PATCH'].includes(method.toUpperCase())) return 'update';
    return 'other';
  }

  private bodyPublishes(body: unknown): boolean {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    const record = body as Record<string, unknown>;
    return record.publish_status === 'published' || record.status === 'published';
  }

  private extractResponseId(response: unknown): string | null {
    const record = this.extractResponseRecord(response);
    if (!record || typeof record.id !== 'string') return null;
    return record.id.trim() || null;
  }

  private extractResponseRecord(response: unknown): Record<string, unknown> | null {
    if (!response || typeof response !== 'object' || Array.isArray(response)) return null;
    const record = response as Record<string, unknown>;
    if (typeof record.id === 'string' && record.id.trim()) return record;

    for (const key of [
      'data',
      'user',
      'role',
      'customer',
      'contact',
      'quote',
      'page_content',
      'category',
      'brand',
      'brand_page',
      'product_group',
      'product_variant',
      'technical_document',
      'file',
      'news_category',
      'banner',
      'redirect',
      'service',
      'project',
      'menu',
      'item',
      'batch',
      'conflict',
      'social_link',
      'company_info'
    ]) {
      const nested = record[key];
      const nestedRecord = this.extractResponseRecord(nested);
      if (nestedRecord) return nestedRecord;
    }
    return null;
  }

  private resolveChangedFields(
    body: unknown,
    oldValue: unknown,
    newValue: unknown
  ): string[] | null {
    const fields = new Set<string>();
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      for (const key of Object.keys(body as Record<string, unknown>)) fields.add(key);
    }
    if (
      oldValue &&
      newValue &&
      typeof oldValue === 'object' &&
      typeof newValue === 'object' &&
      !Array.isArray(oldValue) &&
      !Array.isArray(newValue)
    ) {
      const before = oldValue as Record<string, unknown>;
      const after = newValue as Record<string, unknown>;
      for (const key of ['deleted_at', 'status', 'review_status', 'publish_status']) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) fields.add(key);
      }
    }
    return fields.size > 0 ? [...fields] : null;
  }

  private redactSecrets(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redactSecrets(item));
    if (!value || typeof value !== 'object') return value ?? null;
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return '[REDACTED_BINARY]';

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        /(password|token|secret|authorization)/i.test(key)
          ? '[REDACTED]'
          : this.redactSecrets(nested)
      ])
    );
  }

  private logAuditFailure(
    phase: 'snapshot' | 'write',
    request: RequestWithUser,
    error: unknown
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Audit ${phase} failed for ${request.method} ${request.originalUrl.split('?')[0]}: ${message}`
    );
  }
}
