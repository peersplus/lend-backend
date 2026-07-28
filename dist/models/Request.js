import mongoose, { Schema } from 'mongoose';
const RequestSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    owner_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    category: { type: String, default: 'Other' },
    urgency: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
    needed_by: { type: String, default: null },
    radius_km: { type: Number, default: 5 },
    image_url: { type: String, default: null },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { collection: 'requests', versionKey: false });
RequestSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const Request = mongoose.models['Request'] || mongoose.model('Request', RequestSchema);
