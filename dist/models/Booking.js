import mongoose, { Schema } from 'mongoose';
const BookingSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    item_id: { type: String, required: true, index: true },
    owner_id: { type: String, required: true, index: true },
    borrower_id: { type: String, required: true, index: true },
    status: { type: String, default: 'requested', index: true },
    urgency: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
    reminder_count: { type: Number, default: 0 },
    last_reminder_at: { type: String, default: null },
    last_high_alert_at: { type: String, default: null },
    response_deadline_at: { type: String, default: null },
    agreed_rent_per_day: { type: Number, default: null },
    agreed_days: { type: Number, default: null },
    agreed_deposit: { type: Number, default: 0 },
    consent_accepted_at: { type: String, default: null },
    pickup_at: { type: String, default: null },
    return_due: { type: String, default: null },
    returned_at: { type: String, default: null },
    pickup_scheduled_at: { type: String, default: null },
    return_scheduled_at: { type: String, default: null },
    pickup_person_name: { type: String, default: null },
    pickup_person_photo: { type: String, default: null },
    return_person_name: { type: String, default: null },
    return_person_photo: { type: String, default: null },
    has_defect: { type: Boolean, default: false },
    defect_notes: { type: String, default: null },
    amount_paid: { type: Number, default: null },
    pickup_photo_url: { type: String, default: null },
    return_photo_url: { type: String, default: null },
    borrower_rating: { type: Number, min: 1, max: 5, default: null },
    borrower_feedback: { type: String, default: null },
    borrower_feedback_submitted_at: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { collection: 'bookings', versionKey: false });
BookingSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const Booking = mongoose.models['Booking'] || mongoose.model('Booking', BookingSchema);
