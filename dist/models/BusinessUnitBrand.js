import mongoose, { Schema } from 'mongoose';
const BusinessUnitBrandSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    businessUnitId: { type: String, required: true, index: true },
    brandId: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'business_unit_brands' });
BusinessUnitBrandSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
BusinessUnitBrandSchema.index({ businessUnitId: 1, brandId: 1 }, { unique: true });
export const BusinessUnitBrand = mongoose.models['BusinessUnitBrand'] ||
    mongoose.model('BusinessUnitBrand', BusinessUnitBrandSchema);
