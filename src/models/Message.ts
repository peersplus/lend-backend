import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  id: string;
  booking_id: string | null;
  request_id: string | null;
  peer_id: string | null;
  sender_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const MessageSchema = new Schema<IMessage>(
  {
    id: { type: String, required: true, unique: true, index: true },
    booking_id: { type: String, default: null, index: true },
    request_id: { type: String, default: null, index: true },
    peer_id: { type: String, default: null, index: true },
    sender_id: { type: String, required: true, index: true },
    body: { type: String, required: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'messages', versionKey: false },
);

MessageSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const Message = (mongoose.models['Message'] as mongoose.Model<IMessage>) || mongoose.model<IMessage>('Message', MessageSchema);
