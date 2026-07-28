import { randomUUID } from 'node:crypto';
import { UserRole } from '../models/UserRole.js';
const DEFAULT_SUPERADMIN_EMAILS = ['yogitadheerajvarshney@gmail.com'];
function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
}
export function resolveAppRole(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail)
        return 'user';
    const configuredEmails = (process.env.SUPERADMIN_EMAILS || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    const superadminEmails = new Set([...DEFAULT_SUPERADMIN_EMAILS, ...configuredEmails]);
    return superadminEmails.has(normalizedEmail) ? 'superadmin' : 'user';
}
function lean(doc) {
    const o = doc.toObject ? doc.toObject() : { ...doc };
    delete o._id;
    return o;
}
export async function getRoleByUserId(userId, email) {
    const doc = await UserRole.findOne({ user_id: userId }).lean();
    if (doc) {
        const o = { ...doc };
        delete o._id;
        return o;
    }
    return { user_id: userId, role: resolveAppRole(email) };
}
export async function listUserRoles(filters = {}) {
    const q = {};
    if (filters.role)
        q.role = filters.role;
    const docs = await UserRole.find(q).lean();
    return docs.map((d) => { const o = { ...d }; delete o._id; return o; });
}
export async function upsertUserRole(userId, role) {
    const doc = await UserRole.findOneAndUpdate({ user_id: userId }, { $set: { user_id: userId, role }, $setOnInsert: { id: randomUUID() } }, { upsert: true, new: true });
    return lean(doc);
}
export async function deleteUserRole(userId) {
    await UserRole.deleteOne({ user_id: userId });
}
