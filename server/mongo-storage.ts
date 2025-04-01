import mongoose from 'mongoose';
import { IStorage } from './storage';
import { User, Message, Conversation, InsertUser, InsertMessage } from '@shared/schema';
import UserModel from './models/user';
import MessageModel from './models/message';
import ConversationModel from './models/conversation';
import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

export class MongoStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  // Connect to MongoDB
  async connect(uri: string) {
    try {
      await mongoose.connect(uri);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const user = await UserModel.findById(id);
      return user ? user.toJSON() as User : undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ username });
      return user ? user.toJSON() as User : undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const user = await UserModel.findOne({ email });
      return user ? user.toJSON() as User : undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const newUser = new UserModel(userData);
      await newUser.save();
      return newUser.toJSON() as User;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUserStatus(userId: number, isOnline: boolean): Promise<void> {
    try {
      await UserModel.findByIdAndUpdate(userId, { 
        isOnline, 
        lastActive: new Date() 
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  async searchUsers(query: string, currentUserId: number): Promise<User[]> {
    try {
      const users = await UserModel.find({
        $and: [
          { _id: { $ne: currentUserId } },
          {
            $or: [
              { username: { $regex: query, $options: 'i' } },
              { name: { $regex: query, $options: 'i' } },
              { email: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      }).limit(10);
      
      return users.map(user => user.toJSON() as User);
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    try {
      const updatedUser = await UserModel.findByIdAndUpdate(
        userId, 
        userData, 
        { new: true }
      );
      
      if (!updatedUser) {
        throw new Error('User not found');
      }
      
      return updatedUser.toJSON() as User;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Message methods
  async getMessages(userId: number, otherUserId: number): Promise<Message[]> {
    try {
      const messages = await MessageModel.find({
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      }).sort({ timestamp: 1 });
      
      // Mark messages as read
      await this.markMessagesAsRead(userId, otherUserId);
      
      return messages.map(message => message.toJSON() as Message);
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    try {
      const newMessage = new MessageModel(messageData);
      await newMessage.save();
      
      // Update or create conversation
      await this.createOrUpdateConversation(
        messageData.senderId,
        messageData.receiverId,
        newMessage._id
      );
      
      return newMessage.toJSON() as Message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async markMessagesAsRead(userId: number, otherUserId: number): Promise<void> {
    try {
      await MessageModel.updateMany(
        { senderId: otherUserId, receiverId: userId, read: false },
        { $set: { read: true } }
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Conversation methods
  async getConversations(userId: number): Promise<any[]> {
    try {
      // Find all conversations for user
      const conversations = await ConversationModel.find({
        $or: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }).sort({ updatedAt: -1 });
      
      // Get details for each conversation
      const result = [];
      
      for (const conversation of conversations) {
        // Determine the other user in the conversation
        const otherUserId = conversation.user1Id === userId 
          ? conversation.user2Id 
          : conversation.user1Id;
        
        // Get the other user's information
        const otherUser = await this.getUser(otherUserId);
        
        if (!otherUser) continue;
        
        // Get the last message if it exists
        let lastMessage = null;
        if (conversation.lastMessageId) {
          lastMessage = await MessageModel.findById(conversation.lastMessageId);
        }
        
        // Count unread messages
        const unreadCount = await MessageModel.countDocuments({
          senderId: otherUserId,
          receiverId: userId,
          read: false
        });
        
        result.push({
          ...conversation.toJSON(),
          otherUser,
          lastMessage: lastMessage ? lastMessage.toJSON() : null,
          unreadCount
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  async getConversation(user1Id: number, user2Id: number): Promise<Conversation | undefined> {
    try {
      const conversation = await ConversationModel.findOne({
        $or: [
          { user1Id, user2Id },
          { user1Id: user2Id, user2Id: user1Id }
        ]
      });
      
      return conversation ? conversation.toJSON() as Conversation : undefined;
    } catch (error) {
      console.error('Error getting conversation:', error);
      return undefined;
    }
  }

  async createOrUpdateConversation(userId: number, otherUserId: number, messageId: mongoose.Types.ObjectId): Promise<Conversation> {
    try {
      // Find existing conversation
      let conversation = await ConversationModel.findOne({
        $or: [
          { user1Id: userId, user2Id: otherUserId },
          { user1Id: otherUserId, user2Id: userId }
        ]
      });
      
      if (conversation) {
        // Update existing conversation
        conversation.lastMessageId = messageId;
        conversation.updatedAt = new Date();
        await conversation.save();
      } else {
        // Create new conversation
        conversation = new ConversationModel({
          user1Id: userId,
          user2Id: otherUserId,
          lastMessageId: messageId,
          updatedAt: new Date()
        });
        await conversation.save();
      }
      
      return conversation.toJSON() as Conversation;
    } catch (error) {
      console.error('Error creating or updating conversation:', error);
      throw error;
    }
  }
}