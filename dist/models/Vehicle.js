import mongoose, { Schema } from 'mongoose';
const VehicleSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    orgId: { type: String, default: null, index: true },
    businessUnitId: { type: String, default: null, index: true },
    brandId: { type: String, default: null, index: true },
    salesOfficeId: { type: String, default: null, index: true },
    plantId: { type: String, default: null, index: true },
    condition: { type: String, default: null, index: true },
    status: { type: String, default: 'available', index: true },
    vin: { type: String, sparse: true },
    stockNumber: { type: String, sparse: true },
    brand: { type: String, required: true, index: true },
    model: { type: String, required: true, index: true },
    variant: { type: String, default: null },
    trim: { type: String, default: null },
    year: { type: Number, required: true },
    color: { type: String, default: null },
    fuel_type: { type: String, default: null },
    transmission: { type: String, default: null },
    engine_type: { type: String, default: null },
    drive_type: { type: String, default: null },
    horsepower: { type: Number, default: null },
    torque: { type: String, default: null },
    top_speed: { type: String, default: null },
    acceleration: { type: String, default: null },
    mileage: { type: String, default: null },
    battery_capacity: { type: String, default: null },
    range_km: { type: Number, default: null },
    seating_capacity: { type: Number, default: null },
    vehicle_segment: { type: String, default: null },
    vehicle_condition: { type: String, default: null },
    grade: { type: String, default: null },
    image_url: { type: String, default: null },
    registration_number: { type: String, default: null },
    set_price: { type: Number, default: null },
    available_units: { type: Number, default: 1 },
    total_units: { type: Number, default: 1 },
    location_id: { type: String, required: true, index: true },
    is_active: { type: Boolean, default: true },
    is_available: { type: Boolean, default: true },
    is_new: { type: Boolean, default: true },
    is_used: { type: Boolean, default: false },
    is_demo: { type: Boolean, default: null },
    demo_for_vehicle_id: { type: String, default: null },
    vehicle_time_days: { type: Number, default: null },
    // ── Shared fleet fields ───────────────────────────────────────────────────
    is_shared: { type: Boolean, default: false, index: true },
    shared_location_ids: { type: [String], default: [] },
    current_location_id: { type: String, default: null, index: true },
    transit_status: { type: String, default: 'at_location' },
    transit_eta: { type: String, default: null },
    transit_to_location_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'vehicles' });
VehicleSchema.pre('save', function (next) {
    if (!this.condition && this.vehicle_condition) {
        this.condition = this.vehicle_condition;
    }
    this.updated_at = new Date().toISOString();
    next();
});
VehicleSchema.index({ vin: 1 }, { unique: false, sparse: true, name: 'vin_sparse_idx' });
VehicleSchema.index({ orgId: 1, businessUnitId: 1, brandId: 1, condition: 1 });
VehicleSchema.index({ salesOfficeId: 1, plantId: 1, location_id: 1 });
export const Vehicle = mongoose.models['Vehicle'] ||
    mongoose.model('Vehicle', VehicleSchema);
