import mongoose, { Schema, Document } from 'mongoose';

export interface IPromoUser extends Document {
  userId: string;
  email: string;
  tokensUsed: number;
  tokensLimit: number;
  createdAt: Date;
}

const PromoUserSchema: Schema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  tokensUsed: { type: Number, default: 0 },
  tokensLimit: { type: Number, default: 1000000 }, // 1M default
  createdAt: { type: Date, default: Date.now }
});

export const PromoUser = mongoose.model<IPromoUser>('PromoUser', PromoUserSchema);
