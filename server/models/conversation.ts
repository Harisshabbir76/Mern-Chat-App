import mongoose from 'mongoose';
import { Conversation } from '@shared/schema';

const conversationSchema = new mongoose.Schema({
  user1Id: { type: String, required: true },
  user2Id: { type: String, required: true },
  lastMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  updatedAt: { type: Date, default: Date.now }
});

// Create compound index for user1Id and user2Id
conversationSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

// Create virtual id field that maps to _id
conversationSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Ensure virtual fields are serialized
conversationSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    if (ret.lastMessageId) {
      ret.lastMessageId = ret.lastMessageId.toString();
    }
    delete ret._id;
    delete ret.__v;
  }
});

const ConversationModel = mongoose.model<Conversation & mongoose.Document>('Conversation', conversationSchema);

export default ConversationModel;