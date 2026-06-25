import mongoose, { Schema, Document } from 'mongoose';

export interface IPromoProjectRequest extends Document {
  userId: string;
  userEmail: string;
  projectKeyId: string;
  projectName: string;
  projectKey: string;
  format: 'openai' | 'gemini';
  projectLink: string;
  remarks: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

const PromoProjectRequestSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true },
  projectKeyId: { type: String, required: true },
  projectName: { type: String, required: true },
  projectKey: { type: String, required: true },
  format: { type: String, required: true, enum: ['openai', 'gemini'] },
  projectLink: { type: String, required: true },
  remarks: { type: String, default: '' },
  status: { type: String, required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export const PromoProjectRequest = mongoose.model<IPromoProjectRequest>('PromoProjectRequest', PromoProjectRequestSchema);
