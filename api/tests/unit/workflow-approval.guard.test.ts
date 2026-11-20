import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';

import { AppError } from '../../src/common/errors/app-error';
import {
  requiresPrivilegedWorkflowTransition,
  WorkflowApprovalGuard
} from '../../src/common/workflow/workflow-approval.guard';

function contextWith(body: Record<string, unknown>, roles: string[]): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body,
        user: {
          id: 'qa-user',
          email: 'qa@example.test',
          display_name: 'QA',
          status: 'active',
          roles,
          permissions: []
        }
      })
    })
  } as ExecutionContext;
}

test('workflow approval policy identifies only privileged review/public transitions', () => {
  for (const body of [
    { review_status: 'approved' },
    { review_status: 'rejected' },
    { publish_status: 'published' },
    { review_status: 'approved', publish_status: 'published' }
  ]) {
    assert.equal(requiresPrivilegedWorkflowTransition(body), true);
  }

  for (const body of [
    {},
    { review_status: 'draft' },
    { review_status: 'pending_review' },
    { publish_status: 'unpublished' },
    { publish_status: 'archived' }
  ]) {
    assert.equal(requiresPrivilegedWorkflowTransition(body), false);
  }
});

test('workflow approval guard allows super admin and rejects support roles', () => {
  const guard = new WorkflowApprovalGuard();

  assert.equal(
    guard.canActivate(
      contextWith(
        { review_status: 'approved', publish_status: 'published' },
        ['super_admin']
      )
    ),
    true
  );

  assert.throws(
    () =>
      guard.canActivate(
        contextWith({ publish_status: 'published' }, ['product_admin'])
      ),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === 'PERMISSION_DENIED' &&
      error.message.includes('Chỉ Super Admin') &&
      !error.message.includes('ủy quyền')
  );

  assert.equal(
    guard.canActivate(
      contextWith({ review_status: 'pending_review' }, ['product_admin'])
    ),
    true
  );
});
