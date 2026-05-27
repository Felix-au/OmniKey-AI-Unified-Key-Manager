import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminEmail extends Document {
  email: string;
  createdAt: Date;
}

const AdminEmailSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

export const AdminEmail = mongoose.model<IAdminEmail>('AdminEmail', AdminEmailSchema);
