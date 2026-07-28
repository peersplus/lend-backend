import mongoose, { Schema } from 'mongoose';
const BrandSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, default: null, index: true },
    orgId: { type: String, default: null, index: true },
    businessUnitId: { type: String, default: null, index: true },
    salesOfficeId: { type: String, default: null, index: true },
    plantId: { type: String, default: null, index: true },
    code: { type: String, default: null, index: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    logo_url: { type: String, default: null },
    meta_title: { type: String, default: null },
    meta_description: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'brands' });
BrandSchema.pre('save', function (next) {
    if (!this.orgId && this.dealer_id) {
        this.orgId = this.dealer_id;
    }
    if (!this.dealer_id && this.orgId) {
        this.dealer_id = this.orgId;
    }
    this.updated_at = new Date().toISOString();
    next();
});
// Unique code per dealer, but only when code is a non-null string.
// sparse:true alone still indexes null — use a partial filter expression instead.
BrandSchema.index({ dealer_id: 1, code: 1 }, {
    unique: true,
    partialFilterExpression: { code: { $type: 'string' } },
    name: 'brand_dealer_code_unique',
});
export const Brand = mongoose.models['Brand'] || mongoose.model('Brand', BrandSchema);
