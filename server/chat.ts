import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { MessageType, WebSocketMessage } from '@shared/schema';
import { storage } from './storage';

interface AuthenticatedClient extends WebSocket {
  userId?: string;
  isAlive: boolean;
}

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  // Map of connected clients by user ID
  const clients = new Map<string, AuthenticatedClient>();
  
  // Handle new connections
  wss.on('connection', (ws: AuthenticatedClient) => {
    console.log('New WebSocket connection');
    ws.isAlive = true;
    
    // Handle messages from clients
    ws.on('message', async (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        
        // Add authentication check
        if (!ws.userId && message.type !== MessageType.TEXT) {
          // For non-text messages (like status updates and typing indicators),
          // we use the senderId from the message as authentication
          const user = await storage.getUser(message.senderId);
          if (!user) {
            console.error('User not found:', message.senderId);
            return;
          }
          
          ws.userId = message.senderId;
          
          // Register client with userId
          if (clients.has(ws.userId)) {
            // If there's already a connection for this user, close it
            const existingClient = clients.get(ws.userId);
            if (existingClient && existingClient !== ws) {
              existingClient.close();
            }
          }
          
          clients.set(ws.userId, ws);
          console.log(`User ${ws.userId} connected`);
          
          // If this is a status message, update the user's status in storage
          if (message.type === MessageType.STATUS) {
            const isOnline = message.content === 'online';
            await storage.updateUserStatus(ws.userId, isOnline);
          }
        }
        
        // Process by message type
        switch (message.type) {
          case MessageType.TEXT: {
            // Forward message to recipient if online
            const recipientWs = clients.get(message.receiverId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(data);
            }
            break;
          }
          
          case MessageType.TYPING: {
            // Forward typing status to recipient if online
            const recipientWs = clients.get(message.receiverId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(data);
            }
            break;
          }
          
          case MessageType.STATUS: {
            // Broadcast status update to all clients
            for (const [userId, client] of clients.entries()) {
              // Don't send to self
              if (userId !== message.senderId && client.readyState === WebSocket.OPEN) {
                client.send(data);
              }
            }
            break;
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Handle client disconnection
    ws.on('close', async () => {
      if (ws.userId) {
        console.log(`User ${ws.userId} disconnected`);
        
        // Update user status to offline
        await storage.updateUserStatus(ws.userId, false);
        
        // Broadcast offline status to all clients
        const offlineMessage: WebSocketMessage = {
          type: MessageType.STATUS,
          senderId: ws.userId,
          receiverId: '0', // broadcast
          content: 'offline'
        };
        
        for (const [userId, client] of clients.entries()) {
          if (userId !== ws.userId && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(offlineMessage));
          }
        }
        
        // Remove client from map
        clients.delete(ws.userId);
      }
    });
    
    // Handle pings to keep connection alive
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });
  
  // Set up interval to ping clients and check if they're still alive
  const interval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedClient) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Check every 30 seconds
  
  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  return wss;
}
