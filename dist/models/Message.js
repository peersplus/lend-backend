import mongoose, { Schema } from 'mongoose';
const MessageSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    booking_id: { type: String, default: null, index: true },
    request_id: { type: String, default: null, index: true },
    peer_id: { type: String, default: null, index: true },
    sender_id: { type: String, required: true, index: true },
    body: { type: String, required: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { collection: 'messages', versionKey: false });
MessageSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const Message = mongoose.models['Message'] || mongoose.model('Message', MessageSchema);
