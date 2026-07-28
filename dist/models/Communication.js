import mongoose, { Schema } from 'mongoose';
const CommunicationSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, required: true, index: true },
    test_drive_id: { type: String, default: null, index: true },
    parent_id: { type: String, default: null },
    type: { type: String, required: true },
    purpose: { type: String, required: true },
    sent_to: { type: String, required: true },
    subject: { type: String, default: null },
    body: { type: String, default: null },
    status: { type: String, default: 'pending', index: true },
    external_id: { type: String, default: null },
    sent_at: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'communications' });
CommunicationSchema.index({ customer_id: 1, created_at: -1 });
export const Communication = mongoose.models['Communication'] ||
    mongoose.model('Communication', CommunicationSchema);
