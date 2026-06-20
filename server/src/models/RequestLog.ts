import mongoose, { Schema, Document } from 'mongoose';

export interface IRequestLog extends Document {
  userId: string;
  fundedByUserId?: string | null;
  platform: string;
  modelId: string;
  status: 'success' | 'error' | 'fallback';
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  error: string | null;
  projectKey?: string | null;
  createdAt: Date;
}

const RequestLogSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  fundedByUserId: { type: String, default: null, index: true },
  platform: { type: String, required: true },
  modelId: { type: String, required: true },
  status: { type: String, required: true, enum: ['success', 'error', 'fallback'] },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  latencyMs: { type: Number, required: true },
  error: { type: String, default: null },
  projectKey: { type: String, default: null, index: true },
  createdAt: { type: Date, default: Date.now }
});

// Index by userId and createdAt for fast analytics range filters
RequestLogSchema.index({ userId: 1, createdAt: -1 });
RequestLogSchema.index({ fundedByUserId: 1, createdAt: -1 });
RequestLogSchema.index({ projectKey: 1, createdAt: -1 });

export const RequestLog = mongoose.model<IRequestLog>('RequestLog', RequestLogSchema);
