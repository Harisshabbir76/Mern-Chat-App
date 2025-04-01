import mongoose from 'mongoose';
import { User } from '@shared/schema';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
});

// Create virtual id field that maps to _id
userSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  }
});

const UserModel = mongoose.model<User & mongoose.Document>('User', userSchema);

export default UserModel;