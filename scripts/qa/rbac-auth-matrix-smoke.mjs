import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const INVENTORY_PATH = path.join(
  ROOT,
  'docs',
  'qa',
  'generated',
  'system-inventory.json'
);
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'working-notes',
  'rbac-auth-qa-last-run.md'
);
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const missingUuid = '00000000-0000-4000-8000-000000000000';
const initialPassword = 'QaRolePass-2026!';
const changedPassword = 'QaRolePass-Changed-2026!';

const results = [];
const context = {
  inventory: JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')),
  superSession: null,
  rolesByCode: new Map(),
  usersByRole: new Map(),
  sessionsByRole: new Map()
};

async function main() {
  await runCase('RBAC-ENV', 'API health is available', async () => {
    const response = await request('/health');
    assert(response.status === 200, `health returned ${response.status}`);
    return { status: response.status };
  });
  if (lastCaseFailed()) return finish();

  await runCase('RBAC-SUPER-LOGIN', 'Seeded super-admin can sign in', async () => {
    context.superSession = await login(
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      '198.51.100.10'
    );
    assert(context.superSession.access_token, 'access token missing');
    return {
      user_id: context.superSession.user?.id,
      permission_count: context.superSession.permissions?.length ?? 0
    };
  });
  if (lastCaseFailed()) return finish();

  await runCase('RBAC-ROLE-DISCOVERY', 'All five seeded roles are active', async () => {
    const response = await request('/song-thanh/admin-roles?status=active', {
      token: context.superSession.access_token
    });
    assert(response.ok, `role list returned ${response.status}`);
    const roles = extractItems(unwrap(response));
    for (const role of roles) {
      if (role?.code && role?.id) context.rolesByCode.set(role.code, role);
    }
    for (const expected of [
      'super_admin',
      'content_admin',
      'product_admin',
      'sales_admin',
      'viewer'
    ]) {
      assert(context.rolesByCode.has(expected), `seeded role ${expected} missing`);
    }
    return { roles: [...context.rolesByCode.keys()].sort() };
  });
  if (lastCaseFailed()) return finish();

  for (const [index, roleCode] of [
    'content_admin',
    'product_admin',
    'sales_admin',
    'viewer'
  ].entries()) {
    await runCase(
      `RBAC-USER-${roleCode.toUpperCase()}`,
      `Create and sign in an isolated ${roleCode} user`,
      async () => {
        const role = context.rolesByCode.get(roleCode);
        const email = `qa-rbac-${roleCode}-${runId}@example.com`;
        const create = await request('/song-thanh/admin-users', {
          method: 'POST',
          token: context.superSession.access_token,
          body: {
            display_name: `QA RBAC ${roleCode}`,
            email,
            temporary_password: initialPassword,
            role_ids: [role.id],
            status: 'active'
          }
        });
        assert(create.status === 201, `create user returned ${create.status}`);
        const created = unwrap(create);
        assert(created?.user?.id, 'created user id missing');

        const session = await login(
          email,
          initialPassword,
          `198.51.100.${20 + index}`
        );
        context.usersByRole.set(roleCode, {
          id: created.user.id,
          email,
          role_id: role.id
        });
        context.sessionsByRole.set(roleCode, session);
        return {
          user_id: created.user.id,
          role: roleCode,
          permission_count: session.permissions?.length ?? 0
        };
      }
    );
    if (lastCaseFailed()) return finish();
  }

  await runCase(
    'RBAC-ROLE-PERMISSION-EXACT',
    'Runtime permissions match the seeded role definitions exactly',
    async () => {
      const expectedRoles = new Map(
        context.inventory.permissions.roles.map((role) => [
          role.code,
          [...role.permission_codes].sort()
        ])
      );
      const evidence = {};

      for (const roleCode of [
        'content_admin',
        'product_admin',
        'sales_admin',
        'viewer'
      ]) {
        const session = context.sessionsByRole.get(roleCode);
        const me = await request('/auth/me', { token: session.access_token });
        assert(me.status === 200, `${roleCode} /auth/me returned ${me.status}`);
        const actual = [...(unwrap(me)?.permissions ?? [])].sort();
        const expected = expectedRoles.get(roleCode) ?? [];
        assert(
          JSON.stringify(actual) === JSON.stringify(expected),
          `${roleCode} permission drift: expected ${expected.length}, got ${actual.length}`
        );
        evidence[roleCode] = actual.length;
      }

      return evidence;
    }
  );
  if (lastCaseFailed()) return finish();

  await runCase(
    'RBAC-UNAUTHENTICATED-MATRIX',
    'Every protected admin endpoint rejects missing authentication',
    async () => {
      const endpoints = protectedEndpoints();
      const failures = [];
      for (const endpoint of endpoints) {
        const response = await probeEndpoint(endpoint);
        if (response.status !== 401) {
          failures.push(
            `${endpoint.method} ${endpoint.route} => ${response.status}`
          );
        }
      }
      assert(
        failures.length === 0,
        `non-401 protected endpoints: ${failures.slice(0, 12).join(', ')}`
      );
      return { endpoint_count: endpoints.length };
    }
  );

  await runCase(
    'RBAC-DENY-MATRIX',
    'Every permission-decorated endpoint returns 403 for a role missing its permission',
    async () => {
      const rolePermissions = runtimeRolePermissionSets();
      const failures = [];
      let tested = 0;
      for (const endpoint of protectedEndpoints()) {
        const deniedRole = [...rolePermissions.entries()].find(([, permissions]) =>
          endpoint.permissions.some((permission) => !permissions.has(permission))
        );
        if (!deniedRole) continue;
        const [roleCode] = deniedRole;
        const token = context.sessionsByRole.get(roleCode).access_token;
        const response = await probeEndpoint(endpoint, token);
        tested += 1;
        if (response.status !== 403) {
          failures.push(
            `${roleCode} ${endpoint.method} ${endpoint.route} => ${response.status}`
          );
        }
      }
      assert(
        failures.length === 0,
        `permission bypass candidates: ${failures.slice(0, 12).join(', ')}`
      );
      return { endpoint_count: tested };
    }
  );

  await runCase(
    'RBAC-ALLOW-READ-MATRIX',
    'Every protected GET endpoint passes authorization for a role that owns its permission',
    async () => {
      const rolePermissions = runtimeRolePermissionSets();
      const failures = [];
      let tested = 0;
      for (const endpoint of protectedEndpoints().filter(
        (item) => item.method === 'GET'
      )) {
        const allowedRole = [...rolePermissions.entries()].find(([, permissions]) =>
          endpoint.permissions.every((permission) => permissions.has(permission))
        );
        const token = allowedRole
          ? context.sessionsByRole.get(allowedRole[0]).access_token
          : context.superSession.access_token;
        const response = await probeEndpoint(endpoint, token);
        tested += 1;
        if ([401, 403].includes(response.status)) {
          failures.push(
            `${allowedRole?.[0] ?? 'super_admin'} ${endpoint.method} ${endpoint.route} => ${response.status}`
          );
        }
      }
      assert(
        failures.length === 0,
        `allowed read routes rejected: ${failures.slice(0, 12).join(', ')}`
      );
      return { endpoint_count: tested };
    }
  );

  await runCase(
    'RBAC-ALLOW-SAFE-MUTATION-MATRIX',
    'Permission owners reach service validation on mutation routes with a missing UUID',
    async () => {
      const rolePermissions = runtimeRolePermissionSets();
      const endpoints = protectedEndpoints().filter(
        (item) => item.method !== 'GET' && item.route.includes(':')
      );
      const failures = [];
      let tested = 0;

      for (const endpoint of endpoints) {
        const allowedRole = [...rolePermissions.entries()].find(([, permissions]) =>
          endpoint.permissions.every((permission) => permissions.has(permission))
        );
        const requiresSuperAdmin = endpoint.route.endsWith('/permanent');
        const token =
          !requiresSuperAdmin && allowedRole
            ? context.sessionsByRole.get(allowedRole[0]).access_token
            : context.superSession.access_token;
        const response = await probeEndpoint(endpoint, token);
        tested += 1;
        if ([401, 403].includes(response.status) || response.ok) {
          failures.push(
            `${requiresSuperAdmin ? 'super_admin' : allowedRole?.[0] ?? 'super_admin'} ${endpoint.method} ${endpoint.route} => ${response.status}`
          );
        }
      }

      assert(
        failures.length === 0,
        `safe mutation authorization anomalies: ${failures
          .slice(0, 12)
          .join(', ')}`
      );
      return {
        endpoint_count: tested,
        safety: `all route params replaced by non-existent UUID ${missingUuid}`
      };
    }
  );

  await runCase(
    'RBAC-HARD-DELETE-SUPER-GUARD',
    'Exceptional hard-delete routes require super-admin beyond the archive permission',
    async () => {
      const salesToken = context.sessionsByRole.get('sales_admin').access_token;
      const routes = [
        '/song-thanh/contacts/:id/permanent',
        '/song-thanh/customers/:id/permanent',
        '/song-thanh/quotes/:id/permanent'
      ];
      const evidence = [];
      for (const route of routes) {
        const endpoint = context.inventory.endpoints.find(
          (item) => item.method === 'DELETE' && item.route === route
        );
        assert(endpoint, `inventory endpoint ${route} missing`);

        const sales = await probeEndpoint(endpoint, salesToken);
        assert(
          sales.status === 403,
          `sales hard delete ${route} returned ${sales.status}`
        );
        const superAdmin = await probeEndpoint(
          endpoint,
          context.superSession.access_token
        );
        assert(
          ![401, 403].includes(superAdmin.status) && !superAdmin.ok,
          `super-admin safe hard delete ${route} returned ${superAdmin.status}`
        );
        evidence.push({
          route,
          sales: sales.status,
          super_admin_missing_record: superAdmin.status
        });
      }
      return evidence;
    }
  );

  await runCase(
    'RBAC-WORKFLOW-APPROVAL-GUARD',
    'Support roles can draft or submit, but cannot approve, reject, or publish',
    async () => {
      const scenarios = [
        {
          role: 'content_admin',
          route: `/song-thanh/page-contents/${missingUuid}`
        },
        {
          role: 'content_admin',
          route: `/song-thanh/brand-pages/${missingUuid}`
        },
        {
          role: 'content_admin',
          route: `/song-thanh/services/${missingUuid}`
        },
        {
          role: 'content_admin',
          route: `/song-thanh/projects/${missingUuid}`
        },
        {
          role: 'product_admin',
          route: `/song-thanh/product-groups/${missingUuid}`
        },
        {
          role: 'product_admin',
          route: `/song-thanh/product-variants/${missingUuid}`
        }
      ];
      const evidence = [];

      for (const scenario of scenarios) {
        const supportToken = context.sessionsByRole.get(scenario.role).access_token;
        const forbidden = await request(scenario.route, {
          method: 'PUT',
          token: supportToken,
          body: {
            review_status: 'approved',
            publish_status: 'published'
          }
        });
        assert(
          forbidden.status === 403,
          `${scenario.role} privileged workflow ${scenario.route} returned ${forbidden.status}`
        );

        const allowedSubmission = await request(scenario.route, {
          method: 'PUT',
          token: supportToken,
          body: {
            review_status: 'pending_review',
            publish_status: 'unpublished'
          }
        });
        assert(
          ![401, 403].includes(allowedSubmission.status) &&
            !allowedSubmission.ok,
          `${scenario.role} safe workflow ${scenario.route} returned ${allowedSubmission.status}`
        );

        const superAdmin = await request(scenario.route, {
          method: 'PUT',
          token: context.superSession.access_token,
          body: {
            review_status: 'approved',
            publish_status: 'published'
          }
        });
        assert(
          ![401, 403].includes(superAdmin.status) && !superAdmin.ok,
          `super-admin privileged workflow ${scenario.route} returned ${superAdmin.status}`
        );

        evidence.push({
          route: scenario.route,
          role: scenario.role,
          privileged_status: forbidden.status,
          submission_missing_record_status: allowedSubmission.status,
          super_admin_missing_record_status: superAdmin.status
        });
      }

      return evidence;
    }
  );

  await runCase(
    'RBAC-SELF-ESCALATION',
    'Viewer cannot assign the super-admin role to itself',
    async () => {
      const viewer = context.usersByRole.get('viewer');
      const viewerSession = context.sessionsByRole.get('viewer');
      const superRole = context.rolesByCode.get('super_admin');
      const response = await request(`/song-thanh/admin-users/${viewer.id}`, {
        method: 'PUT',
        token: viewerSession.access_token,
        body: { role_ids: [superRole.id] }
      });
      assert(response.status === 403, `self escalation returned ${response.status}`);
      return { status: response.status };
    }
  );

  await runCase(
    'AUTH-TOKEN-HARDENING',
    'Malformed, tampered, unsigned and wrong-token-class bearer tokens are rejected',
    async () => {
      const accessToken = context.superSession.access_token;
      const [header, payload] = accessToken.split('.');
      const tamperedToken = `${accessToken.slice(0, -1)}${accessToken.endsWith('a') ? 'b' : 'a'}`;
      const unsignedHeader = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' })
      ).toString('base64url');
      const candidates = {
        malformed: 'not-a-jwt',
        tampered: tamperedToken,
        unsigned: `${unsignedHeader}.${payload}.`,
        refresh_as_bearer: context.superSession.refresh_token,
        header_payload_only: `${header}.${payload}`
      };
      const statuses = {};
      for (const [label, token] of Object.entries(candidates)) {
        const response = await request('/auth/me', { token });
        statuses[label] = response.status;
        assert(
          response.status === 401,
          `${label} bearer token returned ${response.status}`
        );
      }
      return statuses;
    }
  );

  await runCase(
    'RBAC-PROTECTED-IDENTITY-INVARIANTS',
    'Seeded roles and the current administrator cannot be disabled or weakened',
    async () => {
      const superRole = context.rolesByCode.get('super_admin');
      const userId = context.superSession.user.id;
      const attempts = {
        change_super_permissions: await request(
          `/song-thanh/admin-roles/${superRole.id}/permissions`,
          {
            method: 'PUT',
            token: context.superSession.access_token,
            body: { permission_codes: [] }
          }
        ),
        deactivate_super_role: await request(
          `/song-thanh/admin-roles/${superRole.id}`,
          {
            method: 'PUT',
            token: context.superSession.access_token,
            body: { status: 'inactive' }
          }
        ),
        archive_super_role: await request(
          `/song-thanh/admin-roles/${superRole.id}/archive`,
          {
            method: 'POST',
            token: context.superSession.access_token,
            body: {}
          }
        ),
        disable_current_user: await request(
          `/song-thanh/admin-users/${userId}/status`,
          {
            method: 'POST',
            token: context.superSession.access_token,
            body: { status: 'inactive' }
          }
        )
      };
      for (const [label, response] of Object.entries(attempts)) {
        assert(response.status === 409, `${label} returned ${response.status}`);
      }
      return Object.fromEntries(
        Object.entries(attempts).map(([label, response]) => [
          label,
          response.status
        ])
      );
    }
  );

  await runCase(
    'RBAC-LIVE-PERMISSION-REVOCATION',
    'Permission changes take effect on an already-issued access token',
    async () => {
      const createdRoleResponse = await request('/song-thanh/admin-roles', {
        method: 'POST',
        token: context.superSession.access_token,
        body: {
          name: `QA Live Permission ${runId}`,
          description: 'Temporary role for live authorization QA.',
          status: 'active'
        }
      });
      assert(
        createdRoleResponse.status === 201,
        `create live role returned ${createdRoleResponse.status}`
      );
      const role = unwrap(createdRoleResponse)?.role;
      assert(role?.id, 'live role id missing');

      const grant = await request(
        `/song-thanh/admin-roles/${role.id}/permissions`,
        {
          method: 'PUT',
          token: context.superSession.access_token,
          body: { permission_codes: ['product_group.read'] }
        }
      );
      assert(grant.status === 200, `grant returned ${grant.status}`);

      const email = `qa-live-permission-${runId}@example.com`;
      const createUser = await request('/song-thanh/admin-users', {
        method: 'POST',
        token: context.superSession.access_token,
        body: {
          display_name: 'QA Live Permission',
          email,
          temporary_password: initialPassword,
          role_ids: [role.id],
          status: 'active'
        }
      });
      assert(createUser.status === 201, `create live user returned ${createUser.status}`);
      const userId = unwrap(createUser)?.user?.id;
      assert(userId, 'live user id missing');
      const session = await login(email, initialPassword, '198.51.100.81');

      const before = await request(
        '/song-thanh/product-groups?page=1&page_size=1',
        { token: session.access_token }
      );
      assert(before.status === 200, `granted request returned ${before.status}`);

      const revoke = await request(
        `/song-thanh/admin-roles/${role.id}/permissions`,
        {
          method: 'PUT',
          token: context.superSession.access_token,
          body: { permission_codes: [] }
        }
      );
      assert(revoke.status === 200, `revoke returned ${revoke.status}`);

      const after = await request(
        '/song-thanh/product-groups?page=1&page_size=1',
        { token: session.access_token }
      );
      assert(after.status === 403, `revoked live token returned ${after.status}`);

      const reassign = await request(`/song-thanh/admin-users/${userId}`, {
        method: 'PUT',
        token: context.superSession.access_token,
        body: { role_ids: [context.rolesByCode.get('viewer').id] }
      });
      assert(reassign.status === 200, `cleanup role reassignment returned ${reassign.status}`);
      const archive = await request(
        `/song-thanh/admin-roles/${role.id}/archive`,
        {
          method: 'POST',
          token: context.superSession.access_token,
          body: {}
        }
      );
      assert(archive.status === 200, `cleanup role archive returned ${archive.status}`);

      return {
        before_revoke: before.status,
        after_revoke_same_access_token: after.status,
        cleanup_role_archived: true
      };
    }
  );

  await runCase(
    'AUTH-REFRESH-PASSWORD-LOGOUT',
    'Refresh, password change, session revocation and logout form a consistent lifecycle',
    async () => {
      const sales = context.usersByRole.get('sales_admin');
      const session = context.sessionsByRole.get('sales_admin');

      const refreshed = await request('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: session.refresh_token },
        ip: '198.51.100.60'
      });
      assert(refreshed.status === 201, `refresh returned ${refreshed.status}`);
      const rotatedSession = unwrap(refreshed);
      assert(rotatedSession?.refresh_token, 'rotated refresh token missing');
      assert(
        rotatedSession.refresh_token !== session.refresh_token,
        'refresh token was not rotated'
      );

      const replayedRefresh = await request('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: session.refresh_token },
        ip: '198.51.100.61'
      });
      assert(
        replayedRefresh.status === 401,
        `replayed refresh returned ${replayedRefresh.status}`
      );

      const changed = await request('/auth/change-password', {
        method: 'POST',
        token: session.access_token,
        body: {
          current_password: initialPassword,
          new_password: changedPassword
        }
      });
      assert(changed.status === 201, `change password returned ${changed.status}`);

      const oldRefresh = await request('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: rotatedSession.refresh_token },
        ip: '198.51.100.62'
      });
      assert(oldRefresh.status === 401, `revoked refresh returned ${oldRefresh.status}`);

      const oldLogin = await request('/auth/login', {
        method: 'POST',
        body: { email: sales.email, password: initialPassword },
        ip: '198.51.100.63'
      });
      assert(oldLogin.status === 401, `old password login returned ${oldLogin.status}`);

      const newSession = await login(
        sales.email,
        changedPassword,
        '198.51.100.64'
      );

      const concurrentRefreshes = await Promise.all([
        request('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: newSession.refresh_token },
          ip: '198.51.100.65'
        }),
        request('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: newSession.refresh_token },
          ip: '198.51.100.66'
        })
      ]);
      const concurrentStatuses = concurrentRefreshes
        .map((response) => response.status)
        .sort((a, b) => a - b);
      assert(
        JSON.stringify(concurrentStatuses) === JSON.stringify([201, 401]),
        `concurrent refresh statuses were ${concurrentStatuses.join(',')}`
      );
      const winningRefresh = unwrap(
        concurrentRefreshes.find((response) => response.status === 201)
      );
      assert(winningRefresh?.refresh_token, 'concurrent winner refresh token missing');

      const logout = await request('/auth/logout', {
        method: 'POST',
        body: { refresh_token: winningRefresh.refresh_token },
        ip: '198.51.100.67'
      });
      assert(logout.status === 201, `logout returned ${logout.status}`);
      assert(unwrap(logout)?.revoked === true, 'logout did not revoke the session');

      const afterLogout = await request('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: winningRefresh.refresh_token },
        ip: '198.51.100.68'
      });
      assert(afterLogout.status === 401, `logged-out refresh returned ${afterLogout.status}`);

      return {
        refresh_before_change: refreshed.status,
        replayed_refresh: replayedRefresh.status,
        old_refresh_after_change: oldRefresh.status,
        old_password_after_change: oldLogin.status,
        concurrent_refresh_statuses: concurrentStatuses,
        refresh_after_logout: afterLogout.status
      };
    }
  );

  await runCase(
    'AUTH-LOCKED-USER',
    'Locking a user immediately blocks access, refresh and login',
    async () => {
      const viewer = context.usersByRole.get('viewer');
      const viewerSession = context.sessionsByRole.get('viewer');
      const lock = await request(
        `/song-thanh/admin-users/${viewer.id}/status`,
        {
          method: 'POST',
          token: context.superSession.access_token,
          body: { status: 'locked' }
        }
      );
      assert(lock.status === 200, `lock returned ${lock.status}`);

      const access = await request('/song-thanh/product-groups?page=1&page_size=1', {
        token: viewerSession.access_token
      });
      assert(access.status === 403, `locked access returned ${access.status}`);

      const refresh = await request('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: viewerSession.refresh_token },
        ip: '198.51.100.70'
      });
      assert(
        refresh.status === 401,
        `revoked refresh after locking returned ${refresh.status}`
      );

      const loginResponse = await request('/auth/login', {
        method: 'POST',
        body: { email: viewer.email, password: initialPassword },
        ip: '198.51.100.71'
      });
      assert(loginResponse.status === 403, `locked login returned ${loginResponse.status}`);

      const unlock = await request(
        `/song-thanh/admin-users/${viewer.id}/status`,
        {
          method: 'POST',
          token: context.superSession.access_token,
          body: { status: 'active' }
        }
      );
      assert(unlock.status === 200, `unlock returned ${unlock.status}`);
      return {
        access: access.status,
        revoked_refresh: refresh.status,
        login: loginResponse.status
      };
    }
  );

  await runCase(
    'AUTH-DUPLICATE-EMAIL',
    'Admin email uniqueness is enforced case-insensitively',
    async () => {
      const viewer = context.usersByRole.get('viewer');
      const response = await request('/song-thanh/admin-users', {
        method: 'POST',
        token: context.superSession.access_token,
        body: {
          display_name: 'QA Duplicate',
          email: viewer.email.toUpperCase(),
          temporary_password: initialPassword,
          role_ids: [viewer.role_id],
          status: 'active'
        }
      });
      assert(response.status === 409, `duplicate email returned ${response.status}`);
      return { status: response.status };
    }
  );

  await runCase(
    'AUTH-LOGIN-RATE-LIMIT',
    'Login throttling allows five attempts and rejects the sixth per tracker',
    async () => {
      const statuses = [];
      for (let index = 0; index < 6; index += 1) {
        const response = await request('/auth/login', {
          method: 'POST',
          body: {
            email: `qa-rate-limit-${runId}@example.com`,
            password: 'definitely-wrong'
          },
          ip: '198.51.100.200'
        });
        statuses.push(response.status);
      }
      assert(
        statuses.slice(0, 5).every((status) => status === 401),
        `first five statuses were ${statuses.slice(0, 5).join(',')}`
      );
      assert(statuses[5] === 429, `sixth login returned ${statuses[5]}`);
      return { statuses };
    }
  );

  finish();
}

function protectedEndpoints() {
  return context.inventory.endpoints.filter(
    (endpoint) =>
      endpoint.route.startsWith('/song-thanh') &&
      endpoint.permissions.length > 0
  );
}

function runtimeRolePermissionSets() {
  return new Map(
    [...context.sessionsByRole.entries()].map(([roleCode, session]) => [
      roleCode,
      new Set(session.permissions ?? [])
    ])
  );
}

function probePath(route) {
  return route.replace(/:[A-Za-z][A-Za-z0-9_]*/g, missingUuid);
}

async function probeEndpoint(endpoint, token) {
  return request(probePath(endpoint.route), {
    method: endpoint.method,
    token,
    body: endpoint.method === 'GET' ? undefined : {}
  });
}

async function login(email, password, ip) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
    ip
  });
  assert(response.status === 201, `login ${email} returned ${response.status}`);
  const session = unwrap(response);
  assert(session?.access_token, `login ${email} did not return access_token`);
  assert(session?.refresh_token, `login ${email} did not return refresh_token`);
  return session;
}

async function request(route, options = {}) {
  const headers = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.ip) headers['X-Forwarded-For'] = options.ip;

  const response = await fetch(`${API_BASE_URL}${route}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: response.status, ok: response.ok, payload };
}

function unwrap(response) {
  return response?.payload?.data ?? response?.payload;
}

function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

async function runCase(id, name, callback) {
  const started = Date.now();
  try {
    const evidence = await callback();
    results.push({
      id,
      name,
      status: 'PASS',
      duration_ms: Date.now() - started,
      evidence
    });
  } catch (error) {
    results.push({
      id,
      name,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function lastCaseFailed() {
  return results.at(-1)?.status === 'FAIL';
}

function finish() {
  writeReport();
  printSummary();
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1;
}

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function writeReport() {
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const passed = results.filter((result) => result.status === 'PASS').length;
  const failed = results.length - passed;
  const lines = [
    '# RBAC and authentication QA — last run',
    '',
    `Run ID: \`${runId}\``,
    '',
    `Target: \`${API_BASE_URL}\``,
    '',
    `Summary: **${passed}/${results.length} passed**, **${failed} failed**.`,
    '',
    '| ID | Status | Duration | Case | Evidence / error |',
    '| --- | --- | ---: | --- | --- |',
    ...results.map(
      (result) =>
        `| ${result.id} | ${result.status} | ${result.duration_ms} ms | ${escapeCell(result.name)} | ${escapeCell(result.status === 'PASS' ? JSON.stringify(result.evidence) : result.error)} |`
    ),
    '',
    'Notes:',
    '',
    '- QA users are created only inside the isolated QA database; the runner drops that database after the suite.',
    '- Deny-matrix requests cannot mutate because the permission guard returns before DTO/service execution.',
    `- Safe allowed-mutation probes replace every route parameter with the non-existent UUID \`${missingUuid}\`.`,
    '- Create routes without an ID are intentionally excluded from allowed-mutation probing; their real lifecycle belongs to domain integration suites.',
    ''
  ];
  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

function printSummary() {
  const passed = results.filter((result) => result.status === 'PASS').length;
  for (const result of results) {
    console.log(
      `${result.status} ${result.id} ${result.name}${
        result.status === 'FAIL' ? ` — ${result.error}` : ''
      }`
    );
  }
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Summary: ${passed}/${results.length} passed`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
