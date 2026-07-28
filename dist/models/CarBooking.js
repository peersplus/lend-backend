import mongoose, { Schema } from 'mongoose';
const CarBookingSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    customer_id: { type: String, default: null, index: true },
    vehicle_id: { type: String, default: null, index: true },
    location_id: { type: String, required: true, index: true },
    test_drive_id: { type: String, default: null, index: true },
    opportunity_id: { type: String, default: null },
    sales_person_profile_id: { type: String, default: null, index: true },
    booking_status: {
        type: String,
        enum: ['confirmed', 'cancelled', 'refunded'],
        default: 'confirmed',
        index: true,
    },
    payment_method: {
        type: String,
        enum: ['cash', 'payment_link', 'online'],
        default: 'cash',
    },
    payment_status: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'partial_refund'],
        default: 'pending',
    },
    booking_amount: { type: Number, required: true, default: 0 },
    refund_amount: { type: Number, default: 0 },
    payment_link: { type: String, default: null },
    payment_link_sent_at: { type: String, default: null },
    cancellation_reason: { type: String, default: null },
    refund_notes: { type: String, default: null },
    cancelled_at: { type: String, default: null },
    refunded_at: { type: String, default: null },
    cancelled_by_profile_id: { type: String, default: null },
    notes: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { collection: 'car_bookings', versionKey: false });
CarBookingSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const CarBooking = mongoose.model('CarBooking', CarBookingSchema);
