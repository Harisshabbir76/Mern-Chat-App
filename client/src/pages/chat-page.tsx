import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ChatProvider, useChat } from "@/hooks/use-chat";
import { AvatarWithStatus } from "@/components/ui/avatar-with-status";
import { UserProfile } from "@/components/user-profile";
import { UserSearch } from "@/components/user-search";
import {
  Search,
  Settings,
  ArrowLeft,
  Phone,
  Video,
  Info,
  Paperclip,
  Send,
  ChevronDown,
  Menu,
  X,
  UserPlus,
  LogOut,
  User as UserIcon,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function ChatPageContent() {
  const { user, logoutMutation, deleteConversationMutation, deleteMessageMutation } = useAuth();
  const isMobile = useIsMobile();
  const [showConversations, setShowConversations] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [messageInput, setMessageInput] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false); // Added state for selection mode
  const [selectedMessages, setSelectedMessages] = useState(new Set<string>()); // Added state for selected messages

  const {
    conversations,
    isLoadingConversations,
    activeConversation,
    activeUser,
    messages,
    isLoadingMessages,
    sendMessage,
    sendImageMessage,
    sendVideoMessage,
    setActiveConversation,
    usersTyping,
    setTypingStatus,
    onlineUsers,
  } = useChat();

  const filteredConversations = conversations?.filter(
    (conv) =>
      conv.otherUser.username
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      conv.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleConversationSelect = (conversation: any) => {
    if (activeConversation?.id === conversation.id) {
      setShowChat(!showChat);
      return;
    }

    setActiveConversation(conversation);
    setShowChat(true);

    if (isMobile) {
      setShowConversations(false);
    }
  };

  const handleBackToConversations = () => {
    setShowConversations(true);
    setShowChat(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput("");

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      setTypingStatus(false);
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    setTypingStatus(true);

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      setTypingStatus(false);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (messageInputRef.current && showChat && !isMobile) {
      messageInputRef.current.focus();
    }
  }, [activeConversation, showChat, isMobile]);

  useEffect(() => {
    if (isMobile) {
      setShowConversations(!showChat);
    } else {
      setShowConversations(true);
    }
  }, [isMobile, showChat]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    setUploadingMedia(true);
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      if (!event.target || !event.target.result) return;

      const imageUrl = event.target.result as string;
      const caption = prompt("Add a caption (optional):", "");

      sendImageMessage(imageUrl, caption || "");
      setUploadingMedia(false);
      e.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    setUploadingMedia(true);
    const file = e.target.files[0];

    if (file.size > 10 * 1024 * 1024) {
      alert("Video file is too large. Please select a file under 10MB.");
      setUploadingMedia(false);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      if (!event.target || !event.target.result) return;

      const videoUrl = event.target.result as string;
      const caption = prompt("Add a caption (optional):", "");

      sendVideoMessage(videoUrl, caption || "");
      setUploadingMedia(false);
      e.target.value = "";
    };

    reader.readAsDataURL(file);
  };

  const handleSelectMessage = (messageId: string) => {
    if (selectedMessages.has(messageId)) {
      setSelectedMessages(new Set(selectedMessages).delete(messageId));
    } else {
      setSelectedMessages(new Set([...selectedMessages, messageId]));
    }
  };

  const handleDeleteSelectedMessages = () => {
    selectedMessages.forEach((messageId) => {
      deleteMessageMutation.mutate(messageId);
    });
    setSelectedMessages(new Set());
    setIsSelectMode(false);
  };

  return (
    <div
      className={`h-screen flex flex-col ${isDarkMode ? "bg-black" : "bg-gray-100"}`}
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar / Conversation List */}
        {showConversations && (
          <div
            className={cn(
              `bg-${isDarkMode ? "black" : "white"} border-r border-${isDarkMode ? "gray-700" : "gray-200"} flex flex-col z-10`,
              isMobile ? "w-full" : "w-[350px]",
            )}
          >
            {/* User Profile Header */}
            <div
              className={`p-4 border-b border-${isDarkMode ? "gray-700" : "gray-200"} flex items-center justify-between bg-primary/5`}
            >
              <div className="flex items-center">
                <AvatarWithStatus
                  src={user?.avatar}
                  name={user?.name || "User"}
                  size="md"
                  isOnline={true}
                  className="mr-3"
                />
                <div>
                  <p
                    className={`font-medium text-${isDarkMode ? "white" : "gray-900"}`}
                  >
                    {user?.name}
                  </p>
                  <p
                    className={`text-xs text-${isDarkMode ? "gray-400" : "gray-500"}`}
                  >
                    @{user?.username}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`text-${isDarkMode ? "gray-400" : "gray-500"} hover:text-${isDarkMode ? "gray-200" : "gray-700"} hover:bg-${isDarkMode ? "gray-800" : "gray-100"}`}
                  onClick={() => setIsDarkMode(!isDarkMode)}
                >
                  {isDarkMode ? "☀️" : "🌙"}
                </Button>
                <Dialog open={showUserSearch} onOpenChange={setShowUserSearch}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`text-${isDarkMode ? "gray-400" : "gray-500"} hover:text-${isDarkMode ? "gray-200" : "gray-700"} hover:bg-${isDarkMode ? "gray-800" : "gray-100"}`}
                    >
                      <UserPlus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md p-0">
                    <UserSearch onClose={() => setShowUserSearch(false)} />
                  </DialogContent>
                </Dialog>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`text-${isDarkMode ? "gray-400" : "gray-500"} hover:text-${isDarkMode ? "gray-200" : "gray-700"} hover:bg-${isDarkMode ? "gray-800" : "gray-100"}`}
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <Dialog
                      open={showUserProfile}
                      onOpenChange={setShowUserProfile}
                    >
                      <DialogTrigger asChild>
                        <DropdownMenuItem>
                          <UserIcon className="h-4 w-4 mr-2" />
                          <span>Profile</span>
                        </DropdownMenuItem>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md p-0">
                        <UserProfile
                          onClose={() => setShowUserProfile(false)}
                        />
                      </DialogContent>
                    </Dialog>
                    <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                      <LogOut className="h-4 w-4 mr-2" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Search Bar */}
            <div
              className={`p-4 border-b border-${isDarkMode ? "gray-700" : "gray-200"}`}
            >
              <div className="relative">
                <Search
                  className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-${isDarkMode ? "gray-300" : "gray-400"} h-4 w-4`}
                />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-full text-sm ${isDarkMode ? "bg-gray-800 text-gray-200" : "bg-white text-gray-900"}`}
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {isLoadingConversations ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className={`p-4 border-b border-${isDarkMode ? "gray-700" : "gray-200"} flex items-center`}
                    >
                      <Skeleton className="h-12 w-12 rounded-full mr-3" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))
              ) : filteredConversations?.length === 0 ? (
                <div
                  className={`p-8 text-center text-${isDarkMode ? "gray-400" : "gray-500"}`}
                >
                  <p className="mb-4">No conversations found</p>
                  <Button
                    variant="outline"
                    className="mx-auto"
                    onClick={() => setShowUserSearch(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Find Users
                  </Button>
                </div>
              ) : (
                filteredConversations?.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      `p-4 border-b border-${isDarkMode ? "gray-700" : "gray-200"} flex items-center cursor-pointer hover:bg-${isDarkMode ? "gray-800" : "gray-50"}`,
                      activeConversation?.id === conversation.id &&
                        showChat &&
                        "bg-primary/10",
                    )}
                    onClick={() => handleConversationSelect(conversation)}
                  >
                    <div className="relative mr-3">
                      <AvatarWithStatus
                        src={conversation.otherUser.avatar}
                        name={conversation.otherUser.name}
                        size="lg"
                        isOnline={onlineUsers.has(
                          conversation.otherUser.id.toString(),
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3
                          className={`text-sm font-medium text-${isDarkMode ? "white" : "gray-900"} truncate`}
                        >
                          {conversation.otherUser.name}
                        </h3>
                        <span
                          className={`text-xs text-${isDarkMode ? "gray-400" : "gray-500"}`}
                        >
                          {conversation.lastMessage &&
                            format(
                              new Date(conversation.lastMessage.timestamp),
                              "h:mm a",
                            )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p
                          className={`text-xs text-${isDarkMode ? "gray-400" : "gray-500"} truncate`}
                        >
                          {conversation.lastMessage?.content ||
                            "No messages yet"}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <Badge className="ml-2 bg-primary">
                            {conversation.unreadCount}
                          </Badge>
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
          <div
            className={cn(
              `bg-${isDarkMode ? "black" : "gray-50"} flex flex-col`,
              isMobile ? "w-full absolute inset-0" : "flex-1",
            )}
          >
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <div
                  className={`p-4 border-b border-${isDarkMode ? "gray-700" : "gray-200"} bg-${isDarkMode ? "black" : "white"} flex items-center justify-between`}
                >
                  <div className="flex items-center">
                    {isMobile && (
                      <button
                        onClick={handleBackToConversations}
                        className={`text-${isDarkMode ? "gray-300" : "gray-500"} mr-3`}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                    )}
                    <AvatarWithStatus
                      src={activeUser?.avatar}
                      name={activeUser?.name || ""}
                      size="md"
                      isOnline={
                        activeUser
                          ? onlineUsers.has(activeUser.id.toString())
                          : false
                      }
                      className="mr-3"
                    />
                    <div>
                      <p
                        className={`font-medium text-${isDarkMode ? "white" : "gray-900"}`}
                      >
                        {activeUser?.name}
                      </p>
                      <div className="flex items-center">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full mr-2",
                            activeUser &&
                              onlineUsers.has(activeUser.id.toString())
                              ? "bg-emerald-500"
                              : "bg-gray-400",
                          )}
                        ></span>
                        <span
                          className={`text-xs text-${isDarkMode ? "gray-400" : "gray-500"}`}
                        >
                          {activeUser &&
                          onlineUsers.has(activeUser.id.toString())
                            ? "Online"
                            : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`text-${isDarkMode ? "gray-300" : "gray-500"} hover:text-${isDarkMode ? "gray-200" : "gray-700"} hidden md:flex`}
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`text-${isDarkMode ? "gray-300" : "gray-500"} hover:text-${isDarkMode ? "gray-200" : "gray-700"} hidden md:flex`}
                    >
                      <Video className="h-5 w-5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`text-${isDarkMode ? "gray-300" : "gray-500"} hover:text-${isDarkMode ? "gray-200" : "gray-700"}`}
                        >
                          <Menu className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            if (window.confirm("Delete this entire conversation? This cannot be undone.")) {
                              deleteConversationMutation.mutate(activeConversation.id);
                            }
                          }}
                          className="text-destructive"
                        >
                          Delete Conversation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {!isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`text-${isDarkMode ? "gray-300" : "gray-500"} hover:text-${isDarkMode ? "gray-200" : "gray-700"}`}
                        onClick={() => setShowChat(false)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    )}
                    {isSelectMode && (
                      <Button variant="ghost" onClick={handleDeleteSelectedMessages}>
                        Delete Selected
                      </Button>
                    )}
                    {!isSelectMode && (
                      <Button variant="ghost" onClick={() => setIsSelectMode(true)}>
                        Select Messages
                      </Button>
                    )}
                  </div>
                </div>

                {/* Messages Area */}
                <div
                  ref={messageListRef}
                  className="flex-1 p-4 overflow-y-auto"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23e5e7eb' fill-opacity='0.3' fill-rule='evenodd'/%3E%3C/svg%3E\")",
                  }}
                >
                  <div className="flex justify-center mb-4">
                    <span
                      className={`text-xs text-${isDarkMode ? "gray-400" : "gray-500"} bg-${isDarkMode ? "gray-800" : "gray-100"} rounded-full px-3 py-1`}
                    >
                      {messages.length > 0
                        ? format(
                            new Date(messages[0].timestamp),
                            "MMMM d, yyyy",
                          )
                        : "Today"}
                    </span>
                  </div>

                  {isLoadingMessages ? (
                    Array(4)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={i}
                          className={`flex ${i % 2 === 0 ? "" : "justify-end"} mb-4`}
                        >
                          {i % 2 === 0 && (
                            <Skeleton className="h-8 w-8 rounded-full mr-2 self-end" />
                          )}
                          <Skeleton
                            className={`h-20 w-64 rounded-lg ${i % 2 === 0 ? "bg-gray-200" : "bg-primary/20"}`}
                          />
                        </div>
                      ))
                  ) : messages.length === 0 ? (
                    <div
                      className={`text-center text-${isDarkMode ? "gray-400" : "gray-500"} my-12`}
                    >
                      No messages yet. Send a message to start the conversation!
                    </div>
                  ) : (
                    messages.map((message, index) => {
                      const isSent = message.senderId === user?.id;

                      return (
                        <div
                          key={message.id || `temp-${index}`}
                          className={`flex ${isSent ? "justify-end" : ""} mb-4`}
                        >
                          {!isSent && (
                            <AvatarWithStatus
                              src={activeUser?.avatar}
                              name={activeUser?.name || ""}
                              size="sm"
                              className="mr-2 self-end"
                            />
                          )}
                          {isSent && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 hover:bg-transparent"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Message</AlertDialogTitle>
                                </AlertDialogHeader>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this message? This action cannot be undone.
                                </AlertDialogDescription>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMessageMutation.mutate(message.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <div
                            className={cn(
                              `py-2 px-4 max-w-[80%] rounded-lg shadow-sm relative`,
                              isSent
                                ? `bg-primary text-white rounded-tr-none`
                                : `bg-gray-200 text-gray-900 rounded-tl-none`,
                              isSelectMode && isSent && selectedMessages.has(message.id) && 'ring-2 ring-blue-500'
                            )}
                            onClick={() => isSelectMode && handleSelectMessage(message.id)} //Added onClick handler for selection
                          >
                            {message.messageType === "image" &&
                            message.mediaUrl ? (
                              <div className="mb-2">
                                <img
                                  src={message.mediaUrl}
                                  alt={message.content || "Image"}
                                  className="max-w-full rounded-md"
                                />
                              </div>
                            ) : message.messageType === "video" &&
                              message.mediaUrl ? (
                              <div className="mb-2">
                                <video
                                  src={message.mediaUrl}
                                  controls
                                  className="max-w-full rounded-md"
                                />
                              </div>
                            ) : null}
                            <p>{message.content}</p>
                            <div className="flex items-center justify-end mt-1 gap-1">
                              <p
                                className={cn(
                                  "text-xs",
                                  isSent ? "text-primary-100" : "text-gray-500",
                                )}
                              >
                                {format(new Date(message.timestamp), "h:mm a")}
                              </p>
                              {isSent && (
                                <span
                                  className={cn(
                                    "text-xs",
                                    message.read
                                      ? "text-blue-400"
                                      : "text-primary-100",
                                  )}
                                >
                                  {message.read ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {activeUser && usersTyping[activeUser.id.toString()] && (
                    <div className="flex mb-4">
                      <AvatarWithStatus
                        src={activeUser.avatar}
                        name={activeUser.name}
                        size="sm"
                        className="mr-2 self-end"
                      />
                      <div
                        className={`bg-${isDarkMode ? "gray-800" : "white"} rounded-lg py-2 px-4 shadow-sm`}
                      >
                        <div className="flex space-x-1">
                          <div
                            className={`w-2 h-2 bg-${isDarkMode ? "gray-400" : "gray-400"} rounded-full animate-bounce`}
                          ></div>
                          <div
                            className={`w-2 h-2 bg-${isDarkMode ? "gray-400" : "gray-400"} rounded-full animate-bounce`}
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                          <div
                            className={`w-2 h-2 bg-${isDarkMode ? "gray-400" : "gray-400"} rounded-full animate-bounce`}
                            style={{ animationDelay: "0.4s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Input */}
                <div
                  className={`p-4 border-t border-${isDarkMode ? "gray-700" : "gray-200"} bg-${isDarkMode ? "black" : "white"}`}
                >
                  <form
                    onSubmit={handleSendMessage}
                    className="flex items-center"
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`text-${isDarkMode ? "gray-300" : "gray-500"} mr-2`}
                        >
                          <Paperclip className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() =>
                            document.getElementById("image-upload")?.click()
                          }
                        >
                          Image
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            document.getElementById("video-upload")?.click()
                          }
                        >
                          Video
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <input
                      type="file"
                      id="image-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                    <input
                      type="file"
                      id="video-upload"
                      className="hidden"
                      accept="video/*"
                      onChange={handleVideoUpload}
                    />
                    <Input
                      ref={messageInputRef}
                      type="text"
                      value={messageInput}
                      onChange={handleMessageInputChange}
                      placeholder="Type a message..."
                      className={`flex-1 rounded-full ${isDarkMode ? "bg-gray-800 text-gray-200" : "bg-white text-gray-900"}`}
                    />
                    <Button
                      type="submit"
                      className="ml-2 rounded-full aspect-square"
                      disabled={!messageInput.trim()}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <div
                  className={`text-center max-w-md p-8 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
                >
                  <div className="bg-primary/10 p-4 rounded-full inline-block mb-4">
                    <MessageSquare className="h-12 w-12 text-primary" />
                  </div>
                  <h2
                    className={`text-2xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}
                  >
                    Select a conversation
                  </h2>
                  <p
                    className={`text-${isDarkMode ? "gray-400" : "gray-500"} mb-6`}
                  >
                    Choose a conversation from the list or start a new one by
                    clicking the "Find Users" button.
                  </p>
                  <Button
                    variant="outline"
                    className="mx-auto"
                    onClick={() => setShowUserSearch(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Find Users
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state for desktop when no chat is selected */}
        {!showChat && !isMobile && (
          <div
            className={`flex-1 bg-${isDarkMode ? "black" : "gray-50"} flex items-center justify-center`}
          >
            <div
              className={`text-center max-w-md p-8 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}
            >
              <div className="bg-primary/10 p-4 rounded-full inline-block mb-4">
                <MessageSquare className="h-12 w-12 text-primary" />
              </div>
              <h2
                className={`text-2xl font-bold mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}
              >
                Select a conversation
              </h2>
              <p
                className={`text-${isDarkMode ? "gray-400" : "gray-500"} mb-6`}
              >
                Choose a conversation from the list or start a new one.
              </p>
              <Button
                variant="outline"
                className="mx-auto"
                onClick={() => setShowUserSearch(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Find Users
              </Button>
            </div>
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