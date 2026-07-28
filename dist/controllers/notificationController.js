import * as notificationService from '../services/notificationService.js';
export async function listNotificationsController(req, res) {
    const uid = req.authUser?.uid;
    if (!uid)
        return res.status(401).json({ error: 'Unauthorized' });
    const unreadOnly = req.query.unread_only === 'true';
    const data = await notificationService.listNotifications(uid, unreadOnly);
    res.json({ data });
}
export async function unreadCountController(req, res) {
    const uid = req.authUser?.uid;
    if (!uid)
        return res.status(401).json({ error: 'Unauthorized' });
    const count = await notificationService.countUnread(uid);
    res.json({ count });
}
export async function markReadController(req, res) {
    const uid = req.authUser?.uid;
    if (!uid)
        return res.status(401).json({ error: 'Unauthorized' });
    await notificationService.markAsRead(req.params.id, uid);
    res.json({ success: true });
}
export async function markAllReadController(req, res) {
    const uid = req.authUser?.uid;
    if (!uid)
        return res.status(401).json({ error: 'Unauthorized' });
    await notificationService.markAllAsRead(uid);
    res.json({ success: true });
}
