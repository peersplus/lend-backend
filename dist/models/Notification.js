import mongoose, { Schema } from 'mongoose';
const NotificationSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    profile_id: { type: String, default: null },
    location_id: { type: String, default: null },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, required: true, index: true },
    reference_id: { type: String, default: null },
    reference_type: { type: String, default: null },
    is_read: { type: Boolean, default: false, index: true },
    read_at: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'notifications' });
NotificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });
export const Notification = mongoose.models['Notification'] ||
    mongoose.model('Notification', NotificationSchema);
