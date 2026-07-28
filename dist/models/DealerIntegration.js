import mongoose, { Schema } from 'mongoose';
export const ALL_INTEGRATION_EVENTS = [
    'test_drive_booked',
    'test_drive_confirmed',
    'test_drive_cancelled',
    'test_drive_completed',
    'test_drive_no_show',
    'test_drive_in_progress',
    'test_drive_rescheduled',
    'walkin_registered',
];
const DealerIntegrationSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    dealer_id: { type: String, required: true, index: true },
    type: {
        type: String,
        required: true,
        enum: ['whatsapp', 'sms', 'email', 'google_calendar', 'outlook', 'crm', 'dms'],
    },
    is_enabled: { type: Boolean, default: false },
    events: { type: [String], default: [] },
    config: { type: Schema.Types.Mixed, default: {} },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'dealer_integrations' });
// Compound unique: one record per (dealer_id, type)
DealerIntegrationSchema.index({ dealer_id: 1, type: 1 }, { unique: true });
DealerIntegrationSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
/** Sensitive config keys that are masked (replaced with '***') in GET responses */
export const SENSITIVE_CONFIG_KEYS = {
    whatsapp: ['auth_token', 'token'],
    sms: ['auth_token', 'api_key'],
    email: ['api_key', 'smtp_pass'],
    google_calendar: ['access_token', 'refresh_token', 'client_secret'],
    outlook: ['access_token', 'refresh_token', 'client_secret'],
    crm: ['api_key', 'secret_value'],
    dms: ['api_key', 'secret_value'],
};
export function maskConfig(type, config) {
    const sensitive = SENSITIVE_CONFIG_KEYS[type] ?? [];
    const masked = {};
    for (const [k, v] of Object.entries(config)) {
        masked[k] = sensitive.includes(k) && typeof v === 'string' && v.length > 0 ? '***' : v;
    }
    return masked;
}
export const DealerIntegration = mongoose.models['DealerIntegration'] ||
    mongoose.model('DealerIntegration', DealerIntegrationSchema);
