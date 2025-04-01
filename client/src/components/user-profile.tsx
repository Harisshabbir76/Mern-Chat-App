import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { User } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AvatarWithStatus } from '@/components/ui/avatar-with-status';
import { Loader2, Check, X, Camera, Image } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

interface UserProfileProps {
  onClose: () => void;
}

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  if (data.password && !data.confirmPassword) return false;
  if (!data.password && data.confirmPassword) return false;
  if (data.password && data.confirmPassword && data.password !== data.confirmPassword) return false;
  return true;
}, {
  message: "Passwords don't match",
  path: ['confirmPassword']
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function UserProfile({ onClose }: UserProfileProps) {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      username: user?.username || '',
      email: user?.email || '',
      password: '',
      confirmPassword: '',
    }
  });
  
  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        username: user.username,
        email: user.email,
        password: '',
        confirmPassword: '',
      });
      setAvatarUrl(user.avatar);
    }
  }, [user, reset]);
  
  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For simplicity, we'll use a service like UI Avatars if we can't upload
      // In a real app, you'd upload the file to a server and get a URL back
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newAvatarUrl = event.target.result.toString();
          setAvatarUrl(newAvatarUrl);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const res = await apiRequest('PATCH', '/api/user/profile', data);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['/api/user'], updatedUser);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
        variant: 'default',
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  const onSubmit = (data: ProfileFormValues) => {
    const updateData: Partial<User> = {
      name: data.name,
      username: data.username,
      email: data.email,
      avatar: avatarUrl,
    };
    
    // Only include password if provided
    if (data.password) {
      updateData.password = data.password;
    }
    
    updateProfileMutation.mutate(updateData);
  };
  
  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Profile Settings</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex flex-col items-center mb-6">
        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
          <AvatarWithStatus
            src={avatarUrl}
            name={user?.name || 'User'}
            size="lg"
            isOnline={true}
            className="mb-3"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleAvatarChange}
          />
        </div>
        <h3 className="font-medium text-gray-900">{user?.name}</h3>
        <p className="text-sm text-gray-500">{user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">Click on avatar to change</p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Full Name
          </label>
          <Input
            id="name"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm font-medium text-red-500">{errors.name.message}</p>
          )}
        </div>
        
        <div className="space-y-1">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <Input
            id="username"
            {...register('username')}
          />
          {errors.username && (
            <p className="text-sm font-medium text-red-500">{errors.username.message}</p>
          )}
        </div>
        
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm font-medium text-red-500">{errors.email.message}</p>
          )}
        </div>
        
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            New Password (optional)
          </label>
          <Input
            id="password"
            type="password"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-sm font-medium text-red-500">{errors.password.message}</p>
          )}
        </div>
        
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm New Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-sm font-medium text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>
        
        <div className="flex gap-4 pt-2">
          <Button 
            type="submit"
            className="flex-1"
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
          
          <Button 
            type="button"
            variant="destructive"
            className="flex-1"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Logout
          </Button>
        </div>
      </form>
    </div>
  );
}