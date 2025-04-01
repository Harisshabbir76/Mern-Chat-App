import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  isOnline: boolean("is_online").default(false),
});

export const insertUserSchema = z.object({
  name: z.string(),
  username: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
  avatar: z.string().nullable().optional()
});

// Messages schema
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: serial("sender_id").references(() => users.id).notNull(),
  receiverId: serial("receiver_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  read: boolean("read").default(false),
});

export const insertMessageSchema = z.object({
  content: z.string(),
  senderId: z.string(),
  receiverId: z.string()
});

// Conversations schema for easy retrieval of recent conversations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  user1Id: serial("user1_id").references(() => users.id).notNull(),
  user2Id: serial("user2_id").references(() => users.id).notNull(),
  lastMessageId: serial("last_message_id").references(() => messages.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = z.object({
  user1Id: z.string(),
  user2Id: z.string(),
  lastMessageId: z.string().nullable()
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string;
  avatar: string | null;
  createdAt: Date;
  lastActive: Date;
  isOnline: boolean;
};

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
  read: boolean;
};

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = {
  id: string;
  user1Id: string;
  user2Id: string;
  lastMessageId: string | null;
  updatedAt: Date;
};

// WebSocket message types
export enum MessageType {
  TEXT = 'text',
  TYPING = 'typing',
  STATUS = 'status'
}

export type WebSocketMessage = {
  type: MessageType;
  senderId: string;
  receiverId: string;
  content?: string;
  timestamp?: string;
};
