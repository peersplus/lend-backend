import mongoose, { Schema } from 'mongoose';
const ItemSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    owner_id: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    category: { type: String, default: 'Other' },
    price_mode: { type: String, enum: ['free', 'rent'], default: 'free' },
    price_amount: { type: Number, default: null },
    deposit_amount: { type: Number, default: null },
    image_url: { type: String, default: null },
    image_urls: { type: [String], default: [] },
    video_url: { type: String, default: null },
    status: { type: String, enum: ['available', 'unavailable'], default: 'available', index: true },
    building_name: { type: String, default: null },
    address: { type: String, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { collection: 'items', versionKey: false });
ItemSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const Item = mongoose.models['Item'] || mongoose.model('Item', ItemSchema);
