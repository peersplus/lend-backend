import mongoose, { Schema } from 'mongoose';
const EmailQueueSchema = new Schema({
    queue: { type: String, required: true, index: true },
    message: { type: Schema.Types.Mixed, required: true },
    visible_after: { type: Date, default: () => new Date(), index: true },
    tries: { type: Number, default: 0 },
    deleted_at: { type: Date, default: null },
    created_at: { type: Date, default: () => new Date() },
}, { versionKey: false, collection: 'email_queue' });
EmailQueueSchema.index({ queue: 1, visible_after: 1, deleted_at: 1 });
export const EmailQueue = mongoose.models['EmailQueue'] ||
    mongoose.model('EmailQueue', EmailQueueSchema);
