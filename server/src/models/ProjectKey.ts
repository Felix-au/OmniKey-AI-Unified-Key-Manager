import mongoose, { Schema, Document } from 'mongoose';

export interface IProjectKey extends Document {
  userId: string;
  name: string;
  projectKey: string;
  format: 'openai' | 'gemini';
  enabled: boolean;
  isPromoted: boolean;
  projectLink?: string;
  allowVision: boolean;
  allowVoice: boolean;
  allowTTS: boolean;
  allowImageGen: boolean;
  createdAt: Date;
}

const ProjectKeySchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  projectKey: { type: String, required: true, unique: true, index: true },
  format: { type: String, required: true, enum: ['openai', 'gemini'] },
  enabled: { type: Boolean, default: true },
  isPromoted: { type: Boolean, default: false },
  projectLink: { type: String, default: '' },
  allowVision: { type: Boolean, default: false },
  allowVoice: { type: Boolean, default: false },
  allowTTS: { type: Boolean, default: false },
  allowImageGen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const ProjectKey = mongoose.model<IProjectKey>('ProjectKey', ProjectKeySchema);
