import mongoose, { Schema } from 'mongoose';
const LocationBlockedSlotSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    location_id: { type: String, required: true, index: true },
    blocked_date: { type: String, required: true, index: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    reason: { type: String, default: null },
    block_source: {
        type: String,
        enum: ['manual', 'special_period', 'system'],
        default: 'manual',
    },
    created_by_profile_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'location_blocked_slots' });
LocationBlockedSlotSchema.index({ location_id: 1, blocked_date: 1 });
export const LocationBlockedSlot = mongoose.models['LocationBlockedSlot'] ||
    mongoose.model('LocationBlockedSlot', LocationBlockedSlotSchema);
