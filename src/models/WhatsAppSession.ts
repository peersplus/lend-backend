import mongoose, { Document, Schema } from 'mongoose';

export interface IWhatsAppSession extends Document {
  id: string;
  phone: string;
  flow: 'menu' | 'lend' | 'request' | 'other';
  step: string;
  data: Record<string, unknown>;
  is_active: boolean;
  last_interaction_at: string;
  created_at: string;
  updated_at: string;
}

const WhatsAppSessionSchema = new Schema<IWhatsAppSession>(
  {
    id: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, unique: true, index: true },
    flow: { type: String, enum: ['menu', 'lend', 'request', 'other'], default: 'menu' },
    step: { type: String, default: 'awaiting_menu' },
    data: { type: Schema.Types.Mixed, default: {} },
    is_active: { type: Boolean, default: true, index: true },
    last_interaction_at: { type: String, default: () => new Date().toISOString(), index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'whatsapp_sessions', versionKey: false },
);

WhatsAppSessionSchema.pre('save', function (next) {
  const now = new Date().toISOString();
  this.updated_at = now;
  this.last_interaction_at = now;
  next();
});

export const WhatsAppSession =
  (mongoose.models['WhatsAppSession'] as mongoose.Model<IWhatsAppSession>) ||
  mongoose.model<IWhatsAppSession>('WhatsAppSession', WhatsAppSessionSchema);
