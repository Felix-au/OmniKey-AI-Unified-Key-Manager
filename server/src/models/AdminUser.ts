import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminUser extends Document {
  username: string;
  passwordHash: string;
  createdAt: Date;
}

const AdminUserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const AdminUser = mongoose.model<IAdminUser>('AdminUser', AdminUserSchema);
