import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ChatProvider, useChat } from '@/hooks/use-chat';
import { AvatarWithStatus } from '@/components/ui/avatar-with-status';
import { 
  Search, 
  Settings, 
  ArrowLeft, 
  Phone, 
  Video, 
  Info, 
  Paperclip, 
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

function ChatPageContent() {
  const { user, logoutMutation } = useAuth();
  const isMobile = useIsMobile();
  const [showConversations, setShowConversations] = useState(!isMobile);
  const [showChat, setShowChat] = useState(!isMobile);
  const [searchQuery, setSearchQuery] = useState('');
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [messageInput, setMessageInput] = useState('');
  const typingTimeoutRef = useRef<number | null>(null);
  
  const { 
    conversations, 
    isLoadingConversations,
    activeConversation,
    activeUser,
    messages,
    isLoadingMessages,
    sendMessage,
    setActiveConversation,
    usersTyping,
    setTypingStatus,
    onlineUsers
  } = useChat();

  // Filter conversations by search query
  const filteredConversations = conversations?.filter(conv => 
    conv.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Handle conversation selection
  const handleConversationSelect = (conversation: any) => {
    setActiveConversation(conversation);
    
    if (isMobile) {
      setShowConversations(false);
      setShowChat(true);
    }
  };
  
  // Handle back button on mobile
  const handleBackToConversations = () => {
    setShowConversations(true);
    setShowChat(false);
  };
  
  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
      
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      setTypingStatus(false);
    }
  };
  
  // Handle typing indicator
  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    // Send typing indicator
    setTypingStatus(true);
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to clear typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = window.setTimeout(() => {
      setTypingStatus(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };
  
  // Scroll to bottom of message list when messages change
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Focus input when conversation changes
  useEffect(() => {
    if (messageInputRef.current && !isMobile) {
      messageInputRef.current.focus();
    }
  }, [activeConversation, isMobile]);
  
  // Set layout on mobile/desktop change
  useEffect(() => {
    if (isMobile) {
      setShowConversations(true);
      setShowChat(!activeConversation);
    } else {
      setShowConversations(true);
      setShowChat(true);
    }
  }, [isMobile, activeConversation]);

  return (
    <div className="h-screen flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Conversation List */}
        {showConversations && (
          <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col z-10">
            {/* User Profile Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                <AvatarWithStatus 
                  src={user?.avatar}
                  name={user?.username || "User"}
                  size="md"
                  isOnline={true}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900">{user?.username}</p>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                    <span className="text-xs text-gray-500">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => logoutMutation.mutate()}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-full text-sm"
                />
              </div>
            </div>
            
            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingConversations ? (
                // Skeleton loader for conversations
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="p-4 border-b border-gray-200 flex items-center">
                    <Skeleton className="h-12 w-12 rounded-full mr-3" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))
              ) : filteredConversations?.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No conversations found
                </div>
              ) : (
                filteredConversations?.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "p-4 border-b border-gray-200 flex items-center cursor-pointer hover:bg-gray-50",
                      activeConversation?.id === conversation.id && "bg-indigo-50"
                    )}
                    onClick={() => handleConversationSelect(conversation)}
                  >
                    <div className="relative mr-3">
                      <AvatarWithStatus
                        src={conversation.otherUser.avatar}
                        name={conversation.otherUser.username}
                        size="lg"
                        isOnline={onlineUsers.has(conversation.otherUser.id)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {conversation.otherUser.username}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {conversation.lastMessage && format(new Date(conversation.lastMessage.timestamp), 'h:mm a')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 truncate">
                          {conversation.lastMessage?.content || "No messages yet"}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <Badge className="ml-2 bg-primary">{conversation.unreadCount}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Chat Main Content */}
        {showChat && (
          <div className="hidden md:flex flex-1 flex-col bg-gray-50">
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center">
                    <button 
                      onClick={handleBackToConversations} 
                      className="md:hidden text-gray-500 mr-3"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <AvatarWithStatus
                      src={activeUser?.avatar}
                      name={activeUser?.username || ""}
                      size="md"
                      isOnline={activeUser ? onlineUsers.has(activeUser.id) : false}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900">
                        {activeUser?.username}
                      </p>
                      <div className="flex items-center">
                        <span className={cn(
                          "w-2 h-2 rounded-full mr-2",
                          activeUser && onlineUsers.has(activeUser.id) 
                            ? "bg-emerald-500" 
                            : "bg-gray-400"
                        )}></span>
                        <span className="text-xs text-gray-500">
                          {activeUser && onlineUsers.has(activeUser.id) ? "Online" : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Video className="h-5 w-5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                
                {/* Messages Area */}
                <div 
                  ref={messageListRef}
                  className="flex-1 p-4 overflow-y-auto"
                >
                  {/* Date Separator */}
                  <div className="flex justify-center mb-4">
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-3 py-1">
                      {messages.length > 0 
                        ? format(new Date(messages[0].timestamp), 'MMMM d, yyyy') 
                        : 'Today'}
                    </span>
                  </div>
                  
                  {isLoadingMessages ? (
                    // Message loading skeleton
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? '' : 'justify-end'} mb-4`}>
                        {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full mr-2 self-end" />}
                        <Skeleton className={`h-20 w-64 rounded-lg ${i % 2 === 0 ? 'bg-gray-200' : 'bg-primary/20'}`} />
                      </div>
                    ))
                  ) : messages.length === 0 ? (
                    <div className="text-center text-gray-500 my-12">
                      No messages yet. Send a message to start the conversation!
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const isSent = message.senderId === user?.id;
                      
                      return (
                        <div 
                          key={message.id || `temp-${index}`} 
                          className={`flex ${isSent ? 'justify-end' : ''} mb-4`}
                        >
                          {!isSent && (
                            <AvatarWithStatus
                              src={activeUser?.avatar}
                              name={activeUser?.username || ""}
                              size="sm"
                              className="mr-2 self-end"
                            />
                          )}
                          <div 
                            className={cn(
                              "py-2 px-4 max-w-[80%] rounded-lg",
                              isSent 
                                ? "bg-primary text-white" 
                                : "bg-white shadow-sm"
                            )}
                          >
                            <p>{message.content}</p>
                            <p 
                              className={cn(
                                "text-xs text-right mt-1",
                                isSent ? "text-primary-200" : "text-gray-500"
                              )}
                            >
                              {format(new Date(message.timestamp), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  
                  {/* Typing indicator */}
                  {activeUser && usersTyping[activeUser.id] && (
                    <div className="flex mb-4">
                      <AvatarWithStatus
                        src={activeUser.avatar}
                        name={activeUser.username}
                        size="sm"
                        className="mr-2 self-end"
                      />
                      <div className="bg-white rounded-lg py-2 px-4 shadow-sm">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 bg-white">
                  <form onSubmit={handleSendMessage} className="flex items-center">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="text-gray-500 mr-2"
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Input
                      ref={messageInputRef}
                      type="text"
                      placeholder="Type a message..."
                      value={messageInput}
                      onChange={handleMessageInputChange}
                      className="flex-1 rounded-full px-4 py-2"
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      className="ml-2 bg-primary text-white rounded-full hover:bg-primary/90"
                      disabled={!messageInput.trim()}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              // No conversation selected
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="bg-primary/10 rounded-full p-6 mb-4">
                  <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Start a conversation</h3>
                <p className="text-gray-500 max-w-md">
                  Select a user from the sidebar to start chatting, or search for a specific person.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatPageContent />
    </ChatProvider>
  );
}
