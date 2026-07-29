import mongoose, { Schema } from 'mongoose';
const AppFeedbackSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, default: null, index: true },
    email: { type: String, default: null, index: true },
    name: { type: String, default: null },
    category: { type: String, enum: ['feedback', 'idea'], default: 'feedback' },
    message: { type: String, required: true },
    is_known_user: { type: Boolean, default: false },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'app_feedback' });
AppFeedbackSchema.pre('save', function (next) {
    this.updated_at = new Date().toISOString();
    next();
});
export const AppFeedback = mongoose.models['AppFeedback'] ||
    mongoose.model('AppFeedback', AppFeedbackSchema);
