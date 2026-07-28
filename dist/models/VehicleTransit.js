import mongoose, { Schema } from 'mongoose';
const VehicleTransitSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    vehicle_id: { type: String, required: true, index: true },
    from_location_id: { type: String, required: true, index: true },
    to_location_id: { type: String, required: true, index: true },
    trigger: { type: String, enum: ['auto', 'manual'], default: 'auto' },
    triggered_by_test_drive_id: { type: String, default: null },
    for_test_drive_id: { type: String, default: null },
    distance_km: { type: Number, default: null },
    transit_minutes: { type: Number, default: null },
    depart_time: { type: String, required: true },
    eta_time: { type: String, required: true },
    status: {
        type: String,
        enum: ['scheduled', 'in_transit', 'arrived', 'cancelled'],
        default: 'scheduled',
        index: true,
    },
    dispatched_at: { type: String, default: null },
    arrived_at: { type: String, default: null },
    notes: { type: String, default: null },
    scheduled_by_profile_id: { type: String, default: null, index: true },
    receiver_profile_id: { type: String, default: null, index: true },
    receiver_assigned_at: { type: String, default: null },
    received_notes: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'vehicle_transits' });
VehicleTransitSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const VehicleTransit = mongoose.models['VehicleTransit'] ||
    mongoose.model('VehicleTransit', VehicleTransitSchema);
