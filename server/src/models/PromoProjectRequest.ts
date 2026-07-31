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
  poolUpgrade: boolean;
  allowVision: boolean;
  allowVoice: boolean;
  allowTTS: boolean;
  allowImageGen: boolean;
  approvedPoolUpgrade: boolean;
  approvedAllowVision: boolean;
  approvedAllowVoice: boolean;
  approvedAllowTTS: boolean;
  approvedAllowImageGen: boolean;
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
  poolUpgrade: { type: Boolean, default: false },
  allowVision: { type: Boolean, default: false },
  allowVoice: { type: Boolean, default: false },
  allowTTS: { type: Boolean, default: false },
  allowImageGen: { type: Boolean, default: false },
  approvedPoolUpgrade: { type: Boolean, default: false },
  approvedAllowVision: { type: Boolean, default: false },
  approvedAllowVoice: { type: Boolean, default: false },
  approvedAllowTTS: { type: Boolean, default: false },
  approvedAllowImageGen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const PromoProjectRequest = mongoose.model<IPromoProjectRequest>('PromoProjectRequest', PromoProjectRequestSchema);
