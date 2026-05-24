import mongoose, { Schema, Document } from 'mongoose';
import type { Platform } from '@omnikey-ai/shared/types.js';

export interface IModel extends Document {
  platform: Platform;
  modelId: string;
  displayName: string;
  intelligenceRank: number;
  speedRank: number;
  sizeLabel: string;
  rpmLimit: number | null;
  rpdLimit: number | null;
  tpmLimit: number | null;
  tpdLimit: number | null;
  monthlyTokenBudget: string;
  contextWindow: number | null;
  enabled: boolean;
}

const ModelSchema: Schema = new Schema({
  platform: { type: String, required: true },
  modelId: { type: String, required: true },
  displayName: { type: String, required: true },
  intelligenceRank: { type: Number, required: true },
  speedRank: { type: Number, required: true },
  sizeLabel: { type: String, default: '' },
  rpmLimit: { type: Number, default: null },
  rpdLimit: { type: Number, default: null },
  tpmLimit: { type: Number, default: null },
  tpdLimit: { type: Number, default: null },
  monthlyTokenBudget: { type: String, default: '' },
  contextWindow: { type: Number, default: null },
  enabled: { type: Boolean, default: true }
});

// A system model is unique by platform + modelId combination
ModelSchema.index({ platform: 1, modelId: 1 }, { unique: true });

export const Model = mongoose.model<IModel>('Model', ModelSchema);
