import { HttpStatus, Injectable } from '@nestjs/common';

import type { CurrentUser as CurrentUserContext } from '../../common/auth/auth.types';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { createPaginationMeta, getPaginationParams } from '../../common/pagination/pagination';
import { LogicUserReferenceRepository } from '../../common/users/logic-user-reference.repository';
import { CreateRedirectDto, RedirectListQueryDto, UpdateRedirectDto } from './redirect.dto';
import { assertUuid, normalizeDeletedScope, normalizeRedirectType, normalizeRedirectTypeFilter, normalizeRequiredPath, normalizeSearch, normalizeStatus, normalizeStatusFilter } from './redirect.guardrails';
import { RedirectRepository } from './redirect.repository';
import type { RedirectMutationInput, RedirectReadModel } from './redirect.types';

@Injectable()
export class RedirectService {
  constructor(
    private readonly redirectRepository: RedirectRepository,
    private readonly logicUserReferenceRepository: LogicUserReferenceRepository
  ) {}

  async listRedirects(query: RedirectListQueryDto) {
    const pagination = getPaginationParams(query);
    const q = normalizeSearch(query.q);
    const redirectType = normalizeRedirectTypeFilter(query.redirect_type);
    const status = normalizeStatusFilter(query.status);
    const deletedScope = normalizeDeletedScope(query.deleted_scope);
    const result = await this.redirectRepository.list({
      filters: { q, redirect_type: redirectType, status, deleted_scope: deletedScope },
      limit: pagination.limit,
      offset: pagination.offset
    });
    return {
      items: result.items,
      pagination: createPaginationMeta({ page: pagination.page, pageSize: pagination.pageSize, total: result.total }),
      filters: { q, redirect_type: redirectType, status, deleted_scope: deletedScope }
    };
  }

  async getRedirectDetail(redirectId: string) {
    const id = assertUuid('redirect_id', redirectId);
    const redirect = await this.redirectRepository.findById(id);
    if (!redirect) throw this.notFound('Redirect rule was not found.');
    return { redirect };
  }

  async createRedirect(input: CreateRedirectDto, currentUser: CurrentUserContext | null) {
    const mutation = await this.normalizeCreateInput(input);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    const created = await this.redirectRepository.create(mutation, actorId);
    return this.getRedirectDetail(created.id);
  }

  async updateRedirect(redirectId: string, input: UpdateRedirectDto, currentUser: CurrentUserContext | null) {
    const id = assertUuid('redirect_id', redirectId);
    const existing = await this.redirectRepository.findById(id);
    if (!existing || existing.deleted_at) throw this.notFound('Active redirect rule was not found.');
    const mutation = await this.normalizeUpdateInput(id, input, existing);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.redirectRepository.update(id, mutation, actorId);
    return this.getRedirectDetail(id);
  }

  async archiveRedirect(redirectId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('redirect_id', redirectId);
    const existing = await this.redirectRepository.findById(id);
    if (!existing || existing.deleted_at) throw this.notFound('Active redirect rule was not found.');
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.redirectRepository.archive(id, actorId);
    return this.getRedirectDetail(id);
  }

  async restoreRedirect(redirectId: string, currentUser: CurrentUserContext | null) {
    const id = assertUuid('redirect_id', redirectId);
    const existing = await this.redirectRepository.findById(id);
    if (!existing || !existing.deleted_at) throw this.notFound('Deleted redirect rule was not found.');
    this.assertNotSelfRedirect(existing.from_path, existing.to_path);
    await this.assertNoRedirectLoop(existing.from_path, existing.to_path, id);
    const actorId =
      await this.logicUserReferenceRepository.requireLogicUserId(currentUser);
    await this.redirectRepository.restore(id, actorId);
    return this.getRedirectDetail(id);
  }

  private async normalizeCreateInput(input: CreateRedirectDto): Promise<Required<Pick<RedirectMutationInput, 'from_path' | 'to_path'>> & RedirectMutationInput> {
    const fromPath = normalizeRequiredPath('from_path', input.from_path);
    const toPath = normalizeRequiredPath('to_path', input.to_path);
    this.assertNotSelfRedirect(fromPath, toPath);
    await this.assertFromPathAvailable(fromPath);
    await this.assertNoRedirectLoop(fromPath, toPath);
    return {
      from_path: fromPath,
      to_path: toPath,
      redirect_type: normalizeRedirectType(input.redirect_type) ?? 301,
      status: normalizeStatus(input.status) ?? 'active'
    };
  }

  private async normalizeUpdateInput(id: string, input: UpdateRedirectDto, existing: RedirectReadModel): Promise<RedirectMutationInput> {
    const mutation: RedirectMutationInput = {};
    if (typeof input.from_path !== 'undefined') mutation.from_path = normalizeRequiredPath('from_path', input.from_path);
    if (typeof input.to_path !== 'undefined') mutation.to_path = normalizeRequiredPath('to_path', input.to_path);
    if (typeof input.redirect_type !== 'undefined') mutation.redirect_type = normalizeRedirectType(input.redirect_type);
    if (typeof input.status !== 'undefined') mutation.status = normalizeStatus(input.status);
    const nextFromPath = mutation.from_path ?? existing.from_path;
    const nextToPath = mutation.to_path ?? existing.to_path;
    this.assertNotSelfRedirect(nextFromPath, nextToPath);
    if (nextFromPath !== existing.from_path) await this.assertFromPathAvailable(nextFromPath, id);
    await this.assertNoRedirectLoop(nextFromPath, nextToPath, id);
    return mutation;
  }

  private async assertFromPathAvailable(fromPath: string, excludedId?: string): Promise<void> {
    if (await this.redirectRepository.fromPathExists(fromPath, excludedId)) {
      throw new AppError({ code: 'REDIRECT_FROM_PATH_CONFLICT', message: 'from_path is already in use.', statusCode: HttpStatus.CONFLICT, details: { from_path: fromPath } });
    }
  }

  private assertNotSelfRedirect(fromPath: string, toPath: string): void {
    if (fromPath === toPath) throw this.conflict('Self redirect is not allowed.');
  }

  private async assertNoRedirectLoop(fromPath: string, toPath: string, excludedId?: string): Promise<void> {
    const rows = await this.redirectRepository.activeRedirectPairs(excludedId);
    const redirectMap = new Map(rows.map((row) => [row.from_path, row.to_path]));
    let nextPath: string | undefined = toPath;
    const visitedPaths = new Set<string>();
    while (nextPath) {
      if (nextPath === fromPath) throw this.conflict('Redirect loop is not allowed.');
      if (!redirectMap.has(nextPath)) return;
      if (visitedPaths.has(nextPath)) return;
      visitedPaths.add(nextPath);
      nextPath = redirectMap.get(nextPath);
    }
  }

  private notFound(message: string): AppError {
    return new AppError({ code: ErrorCodes.NOT_FOUND, message, statusCode: HttpStatus.NOT_FOUND });
  }

  private conflict(message: string): AppError {
    return new AppError({ code: 'REDIRECT_CONFLICT', message, statusCode: HttpStatus.CONFLICT });
  }
}
