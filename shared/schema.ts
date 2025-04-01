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

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  username: true,
  email: true, 
  password: true,
  avatar: true,
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

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  senderId: true,
  receiverId: true,
});

// Conversations schema for easy retrieval of recent conversations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  user1Id: serial("user1_id").references(() => users.id).notNull(),
  user2Id: serial("user2_id").references(() => users.id).notNull(),
  lastMessageId: serial("last_message_id").references(() => messages.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  user1Id: true,
  user2Id: true,
  lastMessageId: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// WebSocket message types
export enum MessageType {
  TEXT = 'text',
  TYPING = 'typing',
  STATUS = 'status'
}

export type WebSocketMessage = {
  type: MessageType;
  senderId: number;
  receiverId: number;
  content?: string;
  timestamp?: string;
};
