import mongoose, { Schema } from 'mongoose';
const TestDriveSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, required: true, index: true },
    vehicle_id: { type: String, required: true, index: true },
    location_id: { type: String, required: true, index: true },
    source: { type: String, default: 'online', index: true },
    source_name: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    assigned_sales_person_id: { type: String, default: null, index: true },
    assigned_gro_id: { type: String, default: null, index: true },
    gro_id: { type: String, default: null },
    assigned_security_person_id: { type: String, default: null, index: true },
    status: {
        type: String,
        enum: ['scheduled', 'confirmed', 'show', 'in_progress', 'completed', 'no_show', 'cancelled', 'rescheduled'],
        default: 'scheduled',
        index: true,
    },
    scheduled_date: { type: String, required: true, index: true },
    scheduled_time: { type: String, required: true },
    slot_duration_minutes: { type: Number, default: 30 },
    started_at: { type: String, default: null },
    completed_at: { type: String, default: null },
    security_checked_in_at: { type: String, default: null },
    security_checked_out_at: { type: String, default: null },
    key_handed_at: { type: String, default: null },
    inspection_submitted_at: { type: String, default: null },
    pre_drive_km: { type: Number, default: null },
    post_drive_km: { type: Number, default: null },
    pre_drive_fuel_level: { type: String, default: null },
    post_drive_fuel_level: { type: String, default: null },
    pre_drive_notes: { type: String, default: null },
    post_drive_notes: { type: String, default: null },
    pre_drive_scratches: { type: String, default: null },
    post_drive_scratches: { type: String, default: null },
    rescheduled_from: { type: String, default: null, index: true },
    notes: { type: String, default: null },
    cancelled_reason: { type: String, default: null },
    cancellation_reason: { type: String, default: null },
    feedback_submitted: { type: Boolean, default: false },
    inspection_checklist: { type: Schema.Types.Mixed, default: null },
    stage: { type: String, default: null },
    reminder_sent_24h: { type: Boolean, default: false },
    reminder_sent_4h: { type: Boolean, default: false },
    thank_you_sent: { type: Boolean, default: false },
    no_show_reengagement_sent: { type: Boolean, default: false },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'test_drives' });
TestDriveSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
TestDriveSchema.index({ scheduled_date: 1, status: 1 });
TestDriveSchema.index({ location_id: 1, scheduled_date: 1 });
export const TestDrive = mongoose.models['TestDrive'] || mongoose.model('TestDrive', TestDriveSchema);
