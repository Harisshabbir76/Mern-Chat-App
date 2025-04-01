import mongoose from 'mongoose';
import { Message } from '@shared/schema';

const messageSchema = new mongoose.Schema({
  senderId: { type: Number, required: true },
  receiverId: { type: Number, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

// Create virtual id field that maps to _id
messageSchema.virtual('id').get(function() {
  return this._id;
});

// Ensure virtual fields are serialized
messageSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
  }
});

const MessageModel = mongoose.model<Message & mongoose.Document>('Message', messageSchema);

export default MessageModel;