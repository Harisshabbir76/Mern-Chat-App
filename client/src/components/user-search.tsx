import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { User } from '@shared/schema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageSquare, Loader2, X } from 'lucide-react';
import { AvatarWithStatus } from '@/components/ui/avatar-with-status';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';

interface UserSearchProps {
  onClose: () => void;
}

export function UserSearch({ onClose }: UserSearchProps) {
  const { user } = useAuth();
  const { setActiveConversation } = useChat();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus the search input when the component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Search users
  const { data: searchResults = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users/search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const res = await apiRequest('GET', `/api/users/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json();
    },
    enabled: debouncedQuery.trim().length > 0,
  });
  
  // Start a conversation
  const startConversationMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      const res = await apiRequest('POST', '/api/messages', {
        content: 'Hello! I would like to chat with you.',
        receiverId,
        senderId: user?.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: 'Conversation started',
        description: 'You can now chat with this user.',
        variant: 'default',
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to start conversation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const handleStartConversation = (userId: string) => {
    startConversationMutation.mutate(userId);
  };
  
  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Find Users</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search by username or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-4 py-2"
        />
      </div>
      
      <div className="mt-4 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : searchResults.length === 0 ? (
          searchQuery.trim() ? (
            <div className="text-center py-8 text-gray-500">
              No users found matching "{searchQuery}"
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Type to search for users
            </div>
          )
        ) : (
          <div className="space-y-3">
            {searchResults.map((foundUser) => (
              <div
                key={foundUser.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-center">
                  <AvatarWithStatus
                    src={foundUser.avatar}
                    name={foundUser.name}
                    size="md"
                    isOnline={foundUser.isOnline}
                    className="mr-3"
                  />
                  <div>
                    <h3 className="font-medium text-gray-900">{foundUser.name}</h3>
                    <p className="text-sm text-gray-500">@{foundUser.username}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => handleStartConversation(foundUser.id)}
                  disabled={startConversationMutation.isPending}
                >
                  {startConversationMutation.isPending && startConversationMutation.variables === foundUser.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <MessageSquare className="h-4 w-4 mr-2" />
                  )}
                  Chat
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}