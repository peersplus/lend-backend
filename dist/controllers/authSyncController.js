import { getAuth } from 'firebase-admin/auth';
import { Profile } from '../models/Profile.js';
import { UserRole } from '../models/UserRole.js';
import { resolveAppRole } from '../services/userRoleService.js';
import { randomUUID } from 'node:crypto';
export async function syncAuthUserController(req, res) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    if (!token) {
        res.status(401).json({ error: { message: 'Unauthorized' } });
        return;
    }
    try {
        const decoded = await getAuth().verifyIdToken(token);
        const firebaseUid = decoded.uid;
        const body = req.body || {};
        const email = decoded.email || body.email || '';
        const displayName = body.displayName || decoded.name || email?.split('@')[0] || 'Neighbor';
        const neighborhood = body.neighborhood || null;
        const fcmTokens = Array.isArray(body.fcmTokens) ? body.fcmTokens.filter(Boolean) : [];
        const resolvedRole = resolveAppRole(email);
        const [profile, role] = await Promise.all([
            Profile.findOne({ user_id: firebaseUid }).lean(),
            UserRole.findOne({ user_id: firebaseUid }).lean(),
        ]);
        if (!profile) {
            await Profile.create({
                id: randomUUID(),
                user_id: firebaseUid,
                full_name: displayName,
                email,
                phone: null,
                avatar_url: null,
                neighborhood,
                fcm_tokens: fcmTokens,
                location_id: null,
                brand_ids: [],
                is_active: true,
                on_leave: false,
                leave_start_date: null,
                leave_end_date: null,
                last_login_at: new Date().toISOString(),
            });
        }
        else {
            await Profile.updateOne({ user_id: firebaseUid }, {
                $set: {
                    full_name: displayName,
                    email,
                    neighborhood,
                    fcm_tokens: fcmTokens,
                    last_login_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            });
        }
        await UserRole.findOneAndUpdate({ user_id: firebaseUid }, { $set: { user_id: firebaseUid, role: resolvedRole }, $setOnInsert: { id: randomUUID() } }, { upsert: true, new: true });
        res.json({
            ok: true,
            user: {
                id: firebaseUid,
                email,
                displayName,
                role: role?.role || resolvedRole,
            },
        });
    }
    catch (error) {
        console.error('[auth-sync]', error);
        res.status(401).json({ error: { message: 'Invalid Firebase token' } });
    }
}
