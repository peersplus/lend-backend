import mongoose, { Schema } from 'mongoose';
const TestDriveFeedbackSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    test_drive_id: { type: String, required: true, index: true },
    customer_id: { type: String, default: null, index: true },
    enquiry_id: { type: String, default: null, index: true },
    customer_name: { type: String, required: true },
    customer_email: { type: String, default: null },
    customer_phone: { type: String, default: null },
    rating: { type: Number, required: true },
    experience_badge: { type: String, required: true },
    total_duration_minutes: { type: Number, default: null },
    feedback_text: { type: String, default: null },
    would_recommend: { type: Boolean, default: true },
    created_at: { type: String, default: () => new Date().toISOString(), index: true },
    updated_at: { type: String, default: () => new Date().toISOString() },
}, { versionKey: false, collection: 'test_drive_feedback' });
TestDriveFeedbackSchema.index({ test_drive_id: 1, created_at: -1 });
export const TestDriveFeedback = mongoose.models['TestDriveFeedback'] ||
    mongoose.model('TestDriveFeedback', TestDriveFeedbackSchema);
