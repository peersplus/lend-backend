import mongoose, { Schema } from 'mongoose';
const VehicleTransitRequestSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    vehicle_id: { type: String, required: true, index: true },
    from_location_id: { type: String, required: true, index: true },
    to_location_id: { type: String, required: true, index: true },
    requested_by_profile_id: { type: String, required: true, index: true },
    requested_at: { type: String, default: () => new Date().toISOString() },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending',
        index: true,
    },
    requester_notes: { type: String, default: null },
    manager_notes: { type: String, default: null },
    actioned_by_profile_id: { type: String, default: null },
    actioned_at: { type: String, default: null },
    scheduled_transit_id: { type: String, default: null },
    needed_for_date: { type: String, default: null },
    dealer_id: { type: String, default: null, index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'vehicle_transit_requests' });
VehicleTransitRequestSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const VehicleTransitRequest = mongoose.models['VehicleTransitRequest'] ||
    mongoose.model('VehicleTransitRequest', VehicleTransitRequestSchema);
