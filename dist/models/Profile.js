import mongoose, { Schema } from 'mongoose';
const ProfileSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, unique: true, index: true },
    full_name: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, default: null },
    avatar_url: { type: String, default: null },
    neighborhood: { type: String, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    fcm_tokens: { type: [String], default: [] },
    location_id: { type: String, default: null, index: true },
    brand_ids: { type: [String], default: [] },
    is_active: { type: Boolean, default: true },
    on_leave: { type: Boolean, default: false },
    leave_start_date: { type: String, default: null },
    leave_end_date: { type: String, default: null },
    last_login_at: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'profiles' });
ProfileSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const Profile = mongoose.models['Profile'] ||
    mongoose.model('Profile', ProfileSchema);
