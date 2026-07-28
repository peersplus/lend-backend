import { z } from 'zod';
import { runDbQuery } from '../services/databaseService.js';
const filterSchema = z.object({
    field: z.string().min(1),
    op: z.enum(['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is']),
    value: z.unknown(),
});
const orderSchema = z.object({
    field: z.string().min(1),
    ascending: z.boolean().optional(),
});
const querySchema = z.object({
    table: z.string().min(1),
    action: z.enum(['select', 'insert', 'update', 'delete', 'upsert']),
    select: z.string().optional(),
    filters: z.array(filterSchema).optional(),
    order: z.array(orderSchema).optional(),
    limit: z.number().int().positive().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    values: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]).optional(),
    options: z
        .object({
        count: z.union([z.literal('exact'), z.null()]).optional(),
        head: z.boolean().optional(),
        onConflict: z.string().optional(),
        ignoreDuplicates: z.boolean().optional(),
    })
        .optional(),
});
/** Tables whose rows are scoped to a single showroom via `location_id`. */
const LOCATION_SCOPED_TABLES = new Set([
    'staff_activity_events',
    'staff_activity_sessions',
    'test_drives',
    'vehicles',
    'profiles',
    'location_blocked_slots',
    'location_operating_hours',
    'location_special_periods',
]);
/** Tables scoped to a dealer group via `dealer_id`. */
const DEALER_SCOPED_TABLES = new Set(['locations']);
/** Staff roles that are restricted to their single assigned location. */
const LOCATION_SCOPED_ROLES = new Set([
    'gro', 'sales', 'sales_admin', 'branch_admin', 'security',
]);
/**
 * Injects location / dealer scope filters into the query body for `select`
 * actions, overriding any conflicting filters supplied by the client.
 */
export function enforceScope(body, req) {
    if (body.action !== 'select')
        return;
    const role = req.authUser?.role;
    if (!role)
        return;
    const existing = body.filters ?? [];
    if (LOCATION_SCOPED_ROLES.has(role)) {
        const locationId = req.authUser?.location_id;
        if (!locationId)
            return;
        if (LOCATION_SCOPED_TABLES.has(body.table)) {
            const scoped = [
                ...existing.filter((f) => f.field !== 'location_id'),
                { field: 'location_id', op: 'eq', value: locationId },
            ];
            body.filters = scoped;
        }
        else if (DEALER_SCOPED_TABLES.has(body.table)) {
            // For locations table: scope to just their own location row
            const scoped = [
                ...existing.filter((f) => f.field !== 'id'),
                { field: 'id', op: 'eq', value: locationId },
            ];
            body.filters = scoped;
        }
        return;
    }
    if (role === 'dealer_admin') {
        const dealerLocationIds = req.authUser?.dealer_location_ids;
        const dealerId = req.authUser?.dealer_id;
        // Honour a specific location selection sent by the client (validated against dealer's locations)
        const requestedLocId = req.headers['x-selected-location-id'];
        const effectiveLocationIds = requestedLocId && dealerLocationIds?.includes(requestedLocId)
            ? [requestedLocId]
            : dealerLocationIds;
        if (LOCATION_SCOPED_TABLES.has(body.table) && effectiveLocationIds?.length) {
            const scoped = [
                ...existing.filter((f) => f.field !== 'location_id'),
                { field: 'location_id', op: effectiveLocationIds.length === 1 ? 'eq' : 'in', value: effectiveLocationIds.length === 1 ? effectiveLocationIds[0] : effectiveLocationIds },
            ];
            body.filters = scoped;
        }
        else if (DEALER_SCOPED_TABLES.has(body.table) && dealerId) {
            // For locations table: if a specific location is selected, filter to that row
            if (requestedLocId && dealerLocationIds?.includes(requestedLocId)) {
                const scoped = [
                    ...existing.filter((f) => f.field !== 'id' && f.field !== 'dealer_id'),
                    { field: 'id', op: 'eq', value: requestedLocId },
                ];
                body.filters = scoped;
            }
            else {
                const scoped = [
                    ...existing.filter((f) => f.field !== 'dealer_id'),
                    { field: 'dealer_id', op: 'eq', value: dealerId },
                ];
                body.filters = scoped;
            }
        }
    }
}
export async function dbQueryController(req, res) {
    try {
        const body = querySchema.parse(req.body);
        enforceScope(body, req);
        const result = await runDbQuery(body);
        res.status(200).json({ data: result.data ?? null, count: result.count ?? null, error: null });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Database query failed';
        res.status(400).json({ data: null, count: null, error: { message } });
    }
}
