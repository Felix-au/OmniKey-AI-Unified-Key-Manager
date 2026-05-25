import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings extends Document {
  userId: string;
  email: string;
  unifiedApiKey: string;
  unifiedGeminiApiKey?: string;
  createdAt: Date;
}

const UserSettingsSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  unifiedApiKey: { type: String, required: true, unique: true, index: true },
  unifiedGeminiApiKey: { type: String, required: false, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', UserSettingsSchema);
