import mongoose, { Schema, Document } from 'mongoose';

export interface IUserFallbackConfig extends Document {
  userId: string;
  modelId: mongoose.Types.ObjectId;
  priority: number;
  enabled: boolean;
}

const UserFallbackConfigSchema: Schema = new Schema({
  userId: { type: String, required: true, index: true },
  modelId: { type: Schema.Types.ObjectId, ref: 'Model', required: true },
  priority: { type: Number, required: true },
  enabled: { type: Boolean, default: true }
});

// Create compound index for fast ordering and querying per user
UserFallbackConfigSchema.index({ userId: 1, priority: 1 });

export const UserFallbackConfig = mongoose.model<IUserFallbackConfig>('UserFallbackConfig', UserFallbackConfigSchema);
