import mongoose, { Schema } from 'mongoose';
const BusinessUnitSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    orgId: { type: String, required: true, index: true },
    code: { type: String, required: true, index: true },
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'business_units' });
BusinessUnitSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
BusinessUnitSchema.index({ orgId: 1, code: 1 }, { unique: true });
export const BusinessUnit = mongoose.models['BusinessUnit'] ||
    mongoose.model('BusinessUnit', BusinessUnitSchema);
