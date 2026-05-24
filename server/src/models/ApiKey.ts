import mongoose, { Schema, Document } from 'mongoose';
import type { Platform } from '@omnikey-ai/shared/types.js';

export interface IApiKey extends Document {
  userId: string;
  platform: Platform;
  label: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  status: 'healthy' | 'rate_limited' | 'invalid' | 'error';
  enabled: boolean;
  createdAt: Date;
  lastCheckedAt: Date | null;
}

const ApiKeySchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  platform: { type: String, required: true },
  label: { type: String, default: '' },
  encryptedKey: { type: String, required: true },
  iv: { type: String, required: true },
  authTag: { type: String, required: true },
  status: { type: String, default: 'healthy', enum: ['healthy', 'rate_limited', 'invalid', 'error'] },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastCheckedAt: { type: Date, default: null }
});

// Enforce compound index for fast lookups per user and platform
ApiKeySchema.index({ userId: 1, platform: 1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
