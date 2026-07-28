import { randomUUID } from 'node:crypto';
import { DealerIntegration, maskConfig, SENSITIVE_CONFIG_KEYS } from '../models/DealerIntegration.js';
import { Dealer } from '../models/Dealer.js';
function lean(doc) {
    const o = doc.toObject ? doc.toObject() : { ...doc };
    delete o._id;
    return o;
}
function withMaskedConfig(row) {
    return { ...row, config: maskConfig(row.type, row.config ?? {}) };
}
export async function listIntegrations(dealerId) {
    const docs = await DealerIntegration.find({ dealer_id: dealerId }).lean();
    return docs.map(d => { const o = { ...d }; delete o._id; return withMaskedConfig(o); });
}
export async function upsertIntegration(dealerId, data) {
    const existing = await DealerIntegration.findOne({ dealer_id: dealerId, type: data.type }).lean();
    // Merge config: keep existing sensitive values if incoming value is '***'
    const existingConfig = (existing?.config ?? {});
    const incomingConfig = (data.config ?? {});
    const sensitive = SENSITIVE_CONFIG_KEYS[data.type] ?? [];
    const mergedConfig = { ...existingConfig };
    for (const [k, v] of Object.entries(incomingConfig)) {
        if (sensitive.includes(k) && v === '***')
            continue; // keep existing value
        mergedConfig[k] = v;
    }
    const now = new Date().toISOString();
    if (existing) {
        const doc = await DealerIntegration.findOneAndUpdate({ dealer_id: dealerId, type: data.type }, {
            $set: {
                is_enabled: data.is_enabled ?? existing.is_enabled,
                events: data.events ?? existing.events,
                config: mergedConfig,
                updated_at: now,
            },
        }, { new: true }).lean();
        if (!doc)
            return null;
        delete doc._id;
        return withMaskedConfig(doc);
    }
    const doc = new DealerIntegration({
        id: randomUUID(),
        dealer_id: dealerId,
        type: data.type,
        is_enabled: data.is_enabled ?? false,
        events: data.events ?? [],
        config: mergedConfig,
        created_at: now,
        updated_at: now,
    });
    await doc.save();
    return withMaskedConfig(lean(doc));
}
export async function deleteIntegration(dealerId, type) {
    await DealerIntegration.deleteOne({ dealer_id: dealerId, type });
}
/** Load full (unmasked) config for a single integration — used internally by the test dispatcher */
export async function getIntegrationConfig(dealerId, type) {
    const doc = await DealerIntegration.findOne({ dealer_id: dealerId, type }).lean();
    if (!doc)
        return null;
    return doc.config;
}
/** Superadmin: list all integrations across all dealers, grouped with dealer info */
export async function listAllIntegrations() {
    const [docs, dealers] = await Promise.all([
        DealerIntegration.find({}).lean(),
        Dealer.find({}, { id: 1, name: 1, contact_email: 1, is_active: 1 }).lean(),
    ]);
    const dealerMap = new Map();
    for (const d of dealers) {
        dealerMap.set(d.id, { id: d.id, name: d.name, contact_email: d.contact_email, is_active: d.is_active });
    }
    // Group integrations by dealer_id
    const grouped = new Map();
    for (const doc of docs) {
        const o = { ...doc };
        delete o._id;
        const masked = withMaskedConfig(o);
        if (!grouped.has(doc.dealer_id)) {
            grouped.set(doc.dealer_id, {
                dealer: dealerMap.get(doc.dealer_id) ?? { id: doc.dealer_id, name: 'Unknown Dealer', contact_email: '', is_active: true },
                integrations: [],
            });
        }
        grouped.get(doc.dealer_id).integrations.push(masked);
    }
    return Array.from(grouped.values());
}
