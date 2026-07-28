import mongoose, { Schema } from 'mongoose';
const DailyTestDriveReportSchema = new Schema({
    id: { type: String, required: true, unique: true, index: true },
    location_id: { type: String, required: true, index: true },
    report_date: { type: String, required: true, index: true },
    report_type: { type: String, enum: ['test_drive_daily', 'activity_daily'], required: true },
    recipient_email: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    last_attempt_at: { type: Date, default: null },
    sent_at: { type: Date, default: null },
    error_message: { type: String, default: null },
    created_at: { type: Date, default: () => new Date() },
}, { versionKey: false, collection: 'daily_test_drive_reports' });
DailyTestDriveReportSchema.index({ location_id: 1, report_date: 1, report_type: 1 }, { unique: true });
export const DailyTestDriveReport = mongoose.models['DailyTestDriveReport'] ||
    mongoose.model('DailyTestDriveReport', DailyTestDriveReportSchema);
