import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminEmail extends Document {
  email: string;
  isFundingProvider: boolean;
  createdAt: Date;
}

const AdminEmailSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  isFundingProvider: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const AdminEmail = mongoose.model<IAdminEmail>('AdminEmail', AdminEmailSchema);
