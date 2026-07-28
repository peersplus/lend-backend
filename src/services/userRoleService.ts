import { randomUUID } from 'node:crypto';
import { UserRole, AppRole } from '../models/UserRole.js';

const DEFAULT_SUPERADMIN_EMAILS = ['yogitadheerajvarshney@gmail.com'];

function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function resolveAppRole(email?: string | null): AppRole {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return 'user';

  const configuredEmails = (process.env.SUPERADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const superadminEmails = new Set([...DEFAULT_SUPERADMIN_EMAILS, ...configuredEmails]);
  return superadminEmails.has(normalizedEmail) ? 'superadmin' : 'user';
}

function lean(doc: any) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  delete o._id;
  return o;
}

export async function getRoleByUserId(userId: string, email?: string | null) {
  const doc = await UserRole.findOne({ user_id: userId }).lean();
  if (doc) {
    const o = { ...doc } as any;
    delete o._id;
    return o;
  }

  return { user_id: userId, role: resolveAppRole(email) };
}

export async function listUserRoles(filters: Record<string, unknown> = {}) {
  const q: Record<string, unknown> = {};
  if (filters.role) q.role = filters.role;
  const docs = await UserRole.find(q).lean();
  return docs.map((d) => { const o = { ...d } as any; delete o._id; return o; });
}

export async function upsertUserRole(userId: string, role: AppRole) {
  const doc = await UserRole.findOneAndUpdate(
    { user_id: userId },
    { $set: { user_id: userId, role }, $setOnInsert: { id: randomUUID() } },
    { upsert: true, new: true },
  );
  return lean(doc);
}

export async function deleteUserRole(userId: string) {
  await UserRole.deleteOne({ user_id: userId });
}
