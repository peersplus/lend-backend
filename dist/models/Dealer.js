import mongoose, { Schema } from 'mongoose';
const DealerSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    code: { type: String, default: null, unique: true, sparse: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    contact_email: { type: String, required: true },
    contact_phone: { type: String, default: null },
    logo_url: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    admin_user_id: { type: String, default: null },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'dealers' });
DealerSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const Dealer = mongoose.models['Dealer'] ||
    mongoose.model('Dealer', DealerSchema);
