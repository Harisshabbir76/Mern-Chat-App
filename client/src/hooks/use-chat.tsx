import { createContext, ReactNode, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { useWebSocket } from "@/lib/websocket";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Message, User, Conversation, MessageType, WebSocketMessage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChatContextType {
  conversations: ConversationWithUser[] | undefined;
  isLoadingConversations: boolean;
  activeConversation: ConversationWithUser | null;
  activeUser: User | null;
  messages: Message[];
  isLoadingMessages: boolean;
  sendMessage: (content: string) => void;
  sendImageMessage: (imageUrl: string, caption: string) => void;
  sendVideoMessage: (videoUrl: string, caption: string) => void;
  setActiveConversation: (conv: ConversationWithUser) => void;
  usersTyping: Record<string, boolean>;
  setTypingStatus: (isTyping: boolean) => void;
  onlineUsers: Set<string>;
}

export interface ConversationWithUser extends Conversation {
  otherUser: User;
  lastMessage?: Message;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeConversation, setActiveConversation] = useState<ConversationWithUser | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [usersTyping, setUsersTyping] = useState<Record<string, boolean>>({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  
  const { socket, connected, sendMessage: sendWsMessage } = useWebSocket();
  
  // Load last active conversation from localStorage on initial load
  useEffect(() => {
    if (user && !activeConversation) {
      const savedConversationId = localStorage.getItem('activeConversationId');
      if (savedConversationId) {
        // We'll set this later when conversations are loaded
        console.log('Found saved conversation ID:', savedConversationId);
      }
    }
  }, [user, activeConversation]);

  // Fetch all conversations
  const { data: conversations, isLoading: isLoadingConversations } = useQuery<ConversationWithUser[]>({
    queryKey: ['/api/conversations'],
    enabled: !!user
  });

  // Fetch messages for current active conversation
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: [`/api/messages/${activeConversation?.id}`],
    enabled: !!activeConversation,
  });

  // Send a new message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !activeConversation || !activeUser) {
        throw new Error("Cannot send message - missing user or conversation");
      }
      
      const messageData = {
        content,
        senderId: user.id,
        receiverId: activeUser.id,
      };
      
      const res = await apiRequest("POST", "/api/messages", messageData);
      return res.json();
    },
    onSuccess: (newMessage: Message) => {
      // Update messages in the current conversation
      queryClient.setQueryData([`/api/messages/${activeConversation?.id}`], 
        (old: Message[] = []) => [...old, newMessage]);
      
      // Also update conversations list to move this to the top
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      
      // Send the message via WebSocket as well
      if (connected && activeUser) {
        sendWsMessage({
          type: MessageType.TEXT,
          senderId: user!.id,
          receiverId: activeUser.id,
          content: newMessage.content,
          timestamp: new Date().toISOString(),
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user || !activeUser) return;
      
      const res = await apiRequest("POST", `/api/messages/read/${conversationId}`, {
        userId: user.id,
        otherUserId: activeUser.id,
      });
      return res.json();
    },
    onSuccess: () => {
      // Update unread count in conversations
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    }
  });

  // Handle setting active conversation and user
  const handleSetActiveConversation = useCallback((conv: ConversationWithUser) => {
    setActiveConversation(conv);
    setActiveUser(conv.otherUser);
    
    // Save the conversation ID to localStorage for persistence between refreshes
    localStorage.setItem('activeConversationId', conv.id);
    
    // Mark messages as read when opening a conversation
    if (conv.unreadCount > 0) {
      markAsReadMutation.mutate(conv.id);
    }
  }, [markAsReadMutation]);

  // Effect to handle restoring the saved conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversation) {
      const savedConversationId = localStorage.getItem('activeConversationId');
      if (savedConversationId) {
        // Find the saved conversation in the loaded conversations
        const savedConv = conversations.find(conv => conv.id === savedConversationId);
        if (savedConv) {
          // Restore the saved conversation
          handleSetActiveConversation(savedConv);
        }
      }
    }
  }, [conversations, activeConversation, handleSetActiveConversation]);

  // Send a typing indicator
  const setTypingStatus = useCallback((isTyping: boolean) => {
    if (!connected || !user || !activeUser) return;
    
    sendWsMessage({
      type: MessageType.TYPING,
      senderId: user.id,
      receiverId: activeUser.id,
      content: isTyping ? "typing" : "stopped_typing"
    });
  }, [connected, user, activeUser, sendWsMessage]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!socket || !user) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);
        
        switch (data.type) {
          case MessageType.TEXT:
          case MessageType.IMAGE:
          case MessageType.VIDEO:
            // New message received, update messages if it's for the current conversation
            if (activeUser?.id === data.senderId) {
              const newMessage: Message = {
                id: "temp-" + new Date().getTime(), // Temp ID until we refresh
                content: data.content!,
                senderId: data.senderId,
                receiverId: data.receiverId,
                timestamp: new Date(data.timestamp!),
                read: true,
                messageType: data.type as 'text' | 'image' | 'video',
                mediaUrl: data.mediaUrl || null
              };
              
              queryClient.setQueryData(
                [`/api/messages/${activeConversation?.id}`],
                (old: Message[] = []) => [...old, newMessage]
              );
              
              // Mark as read automatically since user is viewing this conversation
              if (activeConversation) {
                markAsReadMutation.mutate(activeConversation.id);
              }
            }
            
            // Always update the conversations list when new message comes in
            queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
            break;
            
          case MessageType.TYPING:
            // Update typing status
            setUsersTyping(prev => ({
              ...prev,
              [data.senderId]: data.content === "typing"
            }));
            break;
            
          case MessageType.STATUS:
            // Update online status
            if (data.content === "online") {
              setOnlineUsers(prev => new Set([...Array.from(prev), data.senderId]));
            } else if (data.content === "offline") {
              setOnlineUsers(prev => {
                const newSet = new Set(Array.from(prev));
                newSet.delete(data.senderId);
                return newSet;
              });
            }
            break;
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    socket.addEventListener("message", handleMessage);

    // Send online status when connected
    if (connected) {
      sendWsMessage({
        type: MessageType.STATUS,
        senderId: user.id,
        receiverId: "0", // Broadcast to all users
        content: "online"
      });
    }

    return () => {
      socket.removeEventListener("message", handleMessage);
      
      // Send offline status when unmounting if still connected
      if (connected && user) {
        sendWsMessage({
          type: MessageType.STATUS,
          senderId: user.id,
          receiverId: "0", // Broadcast to all users
          content: "offline"
        });
      }
    };
  }, [socket, connected, user, activeUser, activeConversation, markAsReadMutation, sendWsMessage]);

  // Function to send a text message
  const sendMessage = useCallback((content: string) => {
    if (content.trim() === "") return;
    sendMessageMutation.mutate(content);
  }, [sendMessageMutation]);
  
  // Function to send an image message
  const sendImageMessage = useCallback((imageUrl: string, caption: string) => {
    if (!user || !activeConversation || !activeUser) {
      toast({
        title: "Error",
        description: "Cannot send image - missing user or conversation",
        variant: "destructive",
      });
      return;
    }
    
    const messageData = {
      content: caption || "Image",
      senderId: user.id,
      receiverId: activeUser.id,
      messageType: "image" as const,
      mediaUrl: imageUrl
    };
    
    apiRequest("POST", "/api/messages", messageData)
      .then(res => res.json())
      .then((newMessage: Message) => {
        // Update messages in the current conversation
        queryClient.setQueryData([`/api/messages/${activeConversation?.id}`], 
          (old: Message[] = []) => [...old, newMessage]);
        
        // Also update conversations list to move this to the top
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        
        // Send the message via WebSocket as well
        if (connected && activeUser) {
          sendWsMessage({
            type: MessageType.IMAGE,
            senderId: user.id,
            receiverId: activeUser.id,
            content: caption || "Image",
            timestamp: new Date().toISOString(),
            mediaUrl: imageUrl
          });
        }
      })
      .catch(error => {
        toast({
          title: "Failed to send image",
          description: error.message,
          variant: "destructive",
        });
      });
  }, [user, activeConversation, activeUser, connected, sendWsMessage, toast]);
  
  // Function to send a video message
  // Delete a message
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiRequest("DELETE", `/api/messages/${messageId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/messages/${activeConversation?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete message",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete a conversation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest("DELETE", `/api/conversations/${conversationId}`);
      return res.json();
    },
    onSuccess: () => {
      setActiveConversation(null);
      setActiveUser(null);
      localStorage.removeItem('activeConversationId');
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete conversation",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const sendVideoMessage = useCallback((videoUrl: string, caption: string) => {
    if (!user || !activeConversation || !activeUser) {
      toast({
        title: "Error",
        description: "Cannot send video - missing user or conversation",
        variant: "destructive",
      });
      return;
    }
    
    const messageData = {
      content: caption || "Video",
      senderId: user.id,
      receiverId: activeUser.id,
      messageType: "video" as const,
      mediaUrl: videoUrl
    };
    
    apiRequest("POST", "/api/messages", messageData)
      .then(res => res.json())
      .then((newMessage: Message) => {
        // Update messages in the current conversation
        queryClient.setQueryData([`/api/messages/${activeConversation?.id}`], 
          (old: Message[] = []) => [...old, newMessage]);
        
        // Also update conversations list to move this to the top
        queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        
        // Send the message via WebSocket as well
        if (connected && activeUser) {
          sendWsMessage({
            type: MessageType.VIDEO,
            senderId: user.id,
            receiverId: activeUser.id,
            content: caption || "Video",
            timestamp: new Date().toISOString(),
            mediaUrl: videoUrl
          });
        }
      })
      .catch(error => {
        toast({
          title: "Failed to send video",
          description: error.message,
          variant: "destructive",
        });
      });
  }, [user, activeConversation, activeUser, connected, sendWsMessage, toast]);

  return (
    <ChatContext.Provider value={{
      conversations,
      isLoadingConversations,
      activeConversation,
      activeUser,
      messages,
      isLoadingMessages,
      sendMessage,
      sendImageMessage,
      sendVideoMessage,
      setActiveConversation: handleSetActiveConversation,
      usersTyping,
      setTypingStatus,
      onlineUsers
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}