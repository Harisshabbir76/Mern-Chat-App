import mongoose from 'mongoose';
import { Message } from '@shared/schema';

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  messageType: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
  mediaUrl: { type: String, default: null }
});

// Create virtual id field that maps to _id
messageSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Ensure virtual fields are serialized
messageSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  }
});

const MessageModel = mongoose.model<Message & mongoose.Document>('Message', messageSchema);

export default MessageModel;