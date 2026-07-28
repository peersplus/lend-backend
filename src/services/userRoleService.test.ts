import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppRole } from './userRoleService.ts';

test('defaults new users to the user role', () => {
  assert.equal(resolveAppRole(undefined), 'user');
  assert.equal(resolveAppRole('new-user@example.com'), 'user');
});

test('promotes configured superadmin emails to superadmin', () => {
  process.env.SUPERADMIN_EMAILS = 'admin@example.com';
  assert.equal(resolveAppRole('admin@example.com'), 'superadmin');
});
