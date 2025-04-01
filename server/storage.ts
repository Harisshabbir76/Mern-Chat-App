import { messages, users, conversations, type User, type InsertUser, type Message, type InsertMessage, type Conversation, type InsertConversation } from "@shared/schema";
import memorystore from "memorystore";
import session from "express-session";

const MemoryStore = memorystore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(userId: number, isOnline: boolean): Promise<void>;
  searchUsers(query: string, currentUserId: number): Promise<User[]>;
  updateUser(userId: number, userData: Partial<User>): Promise<User>;
  
  // Message methods
  getMessages(userId: number, otherUserId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(userId: number, otherUserId: number): Promise<void>;
  
  // Conversation methods
  getConversations(userId: number): Promise<any[]>;
  getConversation(user1Id: number, user2Id: number): Promise<Conversation | undefined>;
  createOrUpdateConversation(userId: number, otherUserId: number, messageId: number): Promise<Conversation>;
  
  // Session store
  sessionStore: any;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  private conversations: Map<number, Conversation>;
  sessionStore: any;
  
  currentUserId: number;
  currentMessageId: number;
  currentConversationId: number;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.conversations = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    this.currentUserId = 1;
    this.currentMessageId = 1;
    this.currentConversationId = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { 
      id,
      name: insertUser.name,
      username: insertUser.username,
      email: insertUser.email,
      password: insertUser.password,
      avatar: insertUser.avatar || null,
      createdAt: now,
      lastActive: now,
      isOnline: true
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUserStatus(userId: number, isOnline: boolean): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.isOnline = isOnline;
      user.lastActive = new Date();
      this.users.set(userId, user);
    }
  }

  async searchUsers(query: string, currentUserId: number): Promise<User[]> {
    // Skip empty queries
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase().trim();
    
    return Array.from(this.users.values())
      .filter(user => 
        // Exclude current user
        user.id !== currentUserId && 
        // Match username or email
        (user.username.toLowerCase().includes(lowerQuery) || 
         user.email.toLowerCase().includes(lowerQuery) ||
         user.name.toLowerCase().includes(lowerQuery))
      )
      // Limit to 10 results
      .slice(0, 10);
  }
  
  async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Update fields
    const updatedUser: User = {
      ...user,
      ...userData,
      // Prevent overriding these fields
      id: user.id,
      createdAt: user.createdAt,
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  // Message methods
  async getMessages(userId: number, otherUserId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => 
        (message.senderId === userId && message.receiverId === otherUserId) ||
        (message.senderId === otherUserId && message.receiverId === userId)
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    // Ensure senderId and receiverId are defined
    if (insertMessage.senderId === undefined || insertMessage.receiverId === undefined) {
      throw new Error('senderId and receiverId must be defined');
    }
    
    const message: Message = {
      id,
      content: insertMessage.content,
      senderId: insertMessage.senderId,
      receiverId: insertMessage.receiverId,
      timestamp: new Date(),
      read: false
    };
    this.messages.set(id, message);
    
    // Update or create conversation
    await this.createOrUpdateConversation(
      insertMessage.senderId,
      insertMessage.receiverId,
      id
    );
    
    return message;
  }
  
  async markMessagesAsRead(userId: number, otherUserId: number): Promise<void> {
    Array.from(this.messages.values())
      .filter(message => 
        message.senderId === otherUserId && 
        message.receiverId === userId &&
        !message.read
      )
      .forEach(message => {
        message.read = true;
        this.messages.set(message.id, message);
      });
  }
  
  // Conversation methods
  async getConversations(userId: number): Promise<any[]> {
    // Get all conversations that this user is part of
    const userConversations = Array.from(this.conversations.values())
      .filter(conv => conv.user1Id === userId || conv.user2Id === userId);
      
    // For each conversation, get the other user details and the last message
    const result = await Promise.all(
      userConversations.map(async conv => {
        const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
        const otherUser = await this.getUser(otherUserId);
        
        if (!otherUser) return null;
        
        const lastMessage = conv.lastMessageId 
          ? this.messages.get(conv.lastMessageId) 
          : undefined;
        
        // Count unread messages
        const unreadCount = Array.from(this.messages.values())
          .filter(msg => 
            msg.senderId === otherUserId && 
            msg.receiverId === userId && 
            !msg.read
          ).length;
        
        return {
          ...conv,
          otherUser,
          lastMessage,
          unreadCount
        };
      })
    );
    
    // Sort by most recent message
    return result
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  
  async getConversation(user1Id: number, user2Id: number): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      conv => 
        (conv.user1Id === user1Id && conv.user2Id === user2Id) ||
        (conv.user1Id === user2Id && conv.user2Id === user1Id)
    );
  }
  
  async createOrUpdateConversation(userId: number, otherUserId: number, messageId: number): Promise<Conversation> {
    // Ensure all parameters are defined
    if (userId === undefined || otherUserId === undefined || messageId === undefined) {
      throw new Error('userId, otherUserId, and messageId must be defined');
    }
    // Try to find existing conversation
    const existingConversation = await this.getConversation(userId, otherUserId);
    
    if (existingConversation) {
      // Update existing conversation
      const updatedConversation: Conversation = {
        ...existingConversation,
        lastMessageId: messageId,
        updatedAt: new Date()
      };
      this.conversations.set(existingConversation.id, updatedConversation);
      return updatedConversation;
    } else {
      // Create new conversation
      const id = this.currentConversationId++;
      const newConversation: Conversation = {
        id,
        user1Id: userId,
        user2Id: otherUserId,
        lastMessageId: messageId,
        updatedAt: new Date()
      };
      this.conversations.set(id, newConversation);
      return newConversation;
    }
  }
}

export const storage = new MemStorage();
