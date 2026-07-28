import mongoose, { Document, Schema } from 'mongoose';

export interface IRequestOffer extends Document {
  id: string;
  request_id: string;
  helper_id: string;
  created_at: string;
  updated_at: string;
}

const RequestOfferSchema = new Schema<IRequestOffer>(
  {
    id: { type: String, required: true, unique: true, index: true },
    request_id: { type: String, required: true, index: true },
    helper_id: { type: String, required: true, index: true },
    created_at: { type: String, default: () => new Date().toISOString() },
    updated_at: { type: String, default: () => new Date().toISOString() },
  },
  { collection: 'request_offers', versionKey: false },
);

RequestOfferSchema.pre('save', function (next) {
  this.updated_at = new Date().toISOString();
  next();
});

export const RequestOffer = (mongoose.models['RequestOffer'] as mongoose.Model<IRequestOffer>) || mongoose.model<IRequestOffer>('RequestOffer', RequestOfferSchema);
