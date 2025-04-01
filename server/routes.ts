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
      const conversationId = parseInt(req.params.conversationId);
      
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

  return httpServer;
}
