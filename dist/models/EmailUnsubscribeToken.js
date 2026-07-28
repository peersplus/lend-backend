import mongoose, { Schema } from 'mongoose';
const EmailUnsubscribeTokenSchema = new Schema({
    token: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    unsubscribed_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
}, { versionKey: false, collection: 'email_unsubscribe_tokens' });
export const EmailUnsubscribeToken = mongoose.models['EmailUnsubscribeToken'] ||
    mongoose.model('EmailUnsubscribeToken', EmailUnsubscribeTokenSchema);
