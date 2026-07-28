import { randomUUID } from 'node:crypto';
import { Brand } from '../models/Brand.js';
import { BrandLocation } from '../models/BrandLocation.js';
function toPlain(doc) {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    delete obj._id;
    return obj;
}
// ── Brands ────────────────────────────────────────────────────────────────────
export async function listBrandsWithLocations(filters = {}) {
    const query = {};
    if (filters.orgId)
        query.orgId = filters.orgId;
    if (filters.dealer_id)
        query.dealer_id = filters.dealer_id;
    if (filters.businessUnitId)
        query.businessUnitId = filters.businessUnitId;
    if (typeof filters.is_active === 'boolean')
        query.is_active = filters.is_active;
    const brands = await Brand.find(query).sort({ name: 1 }).lean();
    const plainBrands = brands.map(b => { const o = { ...b }; delete o._id; return o; });
    if (plainBrands.length === 0)
        return [];
    const brandIds = plainBrands.map((b) => b.id);
    const links = await BrandLocation.find({ brandId: { $in: brandIds }, isActive: true }).lean();
    const locationsByBrand = {};
    for (const link of links) {
        const l = { ...link };
        if (!locationsByBrand[l.brandId])
            locationsByBrand[l.brandId] = [];
        locationsByBrand[l.brandId].push(l.locationId);
    }
    return plainBrands.map((b) => ({
        ...b,
        locationIds: locationsByBrand[b.id] ?? [],
    }));
}
export async function updateBrandBusinessUnit(brandId, businessUnitId) {
    const doc = await Brand.findOneAndUpdate({ id: brandId }, { $set: { businessUnitId, updated_at: new Date().toISOString() } }, { new: true });
    if (!doc)
        return null;
    return toPlain(doc);
}
// ── Brand ↔ Location links ────────────────────────────────────────────────────
export async function listBrandLocations(filters = {}) {
    const query = {};
    if (filters.orgId)
        query.orgId = filters.orgId;
    if (filters.brandId)
        query.brandId = filters.brandId;
    if (filters.locationId)
        query.locationId = filters.locationId;
    if (filters.businessUnitId)
        query.businessUnitId = filters.businessUnitId;
    const docs = await BrandLocation.find(query).lean();
    return docs.map(d => { const o = { ...d }; delete o._id; return o; });
}
export async function linkBrandLocation(data) {
    const existing = await BrandLocation.findOne({ orgId: data.orgId, brandId: data.brandId, locationId: data.locationId });
    if (existing) {
        existing.isActive = true;
        existing.businessUnitId = data.businessUnitId ?? null;
        existing.updated_at = new Date().toISOString();
        await existing.save();
        return toPlain(existing);
    }
    const now = new Date().toISOString();
    const doc = new BrandLocation({
        id: randomUUID(),
        orgId: data.orgId,
        brandId: data.brandId,
        locationId: data.locationId,
        businessUnitId: data.businessUnitId ?? null,
        isActive: true,
        created_at: now,
        updated_at: now,
    });
    await doc.save();
    return toPlain(doc);
}
export async function unlinkBrandLocation(orgId, brandId, locationId) {
    await BrandLocation.deleteOne({ orgId, brandId, locationId });
}
