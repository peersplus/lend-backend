import * as activityService from '../services/activityService.js';
// ── Events ────────────────────────────────────────────────────────────────────
export async function listEventsController(req, res) {
    const limit = Number(req.query.limit) || 200;
    const filters = { ...req.query };
    if (req.query.event_types)
        filters.event_types = req.query.event_types;
    if (req.query.role)
        filters.role = req.query.role;
    const data = await activityService.listEvents(filters, limit);
    res.json({ data });
}
export async function logEventController(req, res) {
    const data = await activityService.logEvent(req.body);
    res.status(201).json({ data });
}
// ── Sessions ──────────────────────────────────────────────────────────────────
export async function startSessionController(req, res) {
    const data = await activityService.startSession(req.body);
    res.status(201).json({ data });
}
export async function endSessionController(req, res) {
    await activityService.endSession(req.params.id);
    res.json({ success: true });
}
export async function touchSessionController(req, res) {
    const { active_seconds = 0, idle_seconds = 0 } = req.body;
    await activityService.touchSession(req.params.id, Number(active_seconds), Number(idle_seconds));
    res.json({ success: true });
}
export async function listOnlineSessionsController(req, res) {
    const filters = {};
    if (req.query.location_id)
        filters.location_id = req.query.location_id;
    const locationIds = filters.location_ids;
    const locationId = filters.location_id;
    const data = await activityService.listOnlineSessions(locationId, locationIds);
    res.json({ data });
}
