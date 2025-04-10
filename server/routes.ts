import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { setupWebSocketServer } from "./chat";
import { z } from "zod";
import { insertMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up authentication routes
  setupAuth(app);
  
  // Set up WebSocket server
  setupWebSocketServer(httpServer);
  
  // API routes
  
  // Middleware to check authentication
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).send("Unauthorized");
  };
  
  // Get user conversations
  app.get("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error getting conversations:", error);
      res.status(500).send("Server error");
    }
  });
  
  // Get messages for a conversation
  app.get("/api/messages/:conversationId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.conversationId;
      
      // Find the conversation
      const conversations = await storage.getConversations(userId);
      const conversation = conversations.find(c => c.id === conversationId);
      
      if (!conversation) {
        return res.status(404).send("Conversation not found");
      }
      
      // Get messages between these users
      const messages = await storage.getMessages(userId, conversation.otherUser.id);
      
      // Mark messages as read
      await storage.markMessagesAsRead(userId, conversation.otherUser.id);
      
      res.json(messages);
    } catch (error) {
      console.error("Error getting messages:", error);
      res.status(500).send("Server error");
    }
  });
  
  // Send a message
  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user!.id,
      });
      
      // Ensure receiver exists
      const receiver = await storage.getUser(validatedData.receiverId);
      if (!receiver) {
        return res.status(404).send("Receiver not found");
      }
      
      // Create the message
      const message = await storage.createMessage(validatedData);
      
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation failed",
          errors: error.errors,
        });
      }
      console.error("Error sending message:", error);
      res.status(500).send("Server error");
    }
  });
  
  // Mark messages as read
  app.post("/api/messages/read/:conversationId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.body;
      
      if (!otherUserId) {
        return res.status(400).send("Missing otherUserId parameter");
      }
      
      await storage.markMessagesAsRead(userId, otherUserId);
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).send("Server error");
    }
  });

  // Delete a message
  app.delete("/api/messages/:messageId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const messageId = req.params.messageId;
      
      // Ensure message exists and belongs to user
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).send("Message not found");
      }
      
      if (message.senderId !== userId) {
        return res.status(403).send("Not authorized to delete this message");
      }
      
      await storage.deleteMessage(messageId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).send("Server error");
    }
  });

  // Delete a conversation
  app.delete("/api/conversations/:conversationId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const conversationId = req.params.conversationId;
      
      // Ensure conversation exists and user is a participant
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).send("Conversation not found");
      }
      
      if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
        return res.status(403).send("Not authorized to delete this conversation");
      }
      
      await storage.deleteConversation(conversationId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).send("Server error");
    }
  });

  // Search users by username or email
  app.get("/api/users/search", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).send("Missing search query");
      }
      
      const users = await storage.searchUsers(query, userId);
      res.json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      res.status(500).send("Server error");
    }
  });

  // Update user profile
  app.patch("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userData = req.body;
      
      // Prevent updating critical fields
      delete userData.id;
      delete userData.createdAt;
      
      // If updating username, check if it's already taken
      if (userData.username) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }
      
      // If updating email, check if it's already taken
      if (userData.email) {
        const existingUser = await storage.getUserByEmail(userData.email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Email already taken" });
        }
      }
      
      const updatedUser = await storage.updateUser(userId, userData);
      
      // Don't return password
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).send("Server error");
    }
  });

  return httpServer;
}
