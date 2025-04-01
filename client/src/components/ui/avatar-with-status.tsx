import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type AvatarWithStatusProps = {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
  className?: string;
};

export function AvatarWithStatus({
  src,
  name,
  size = 'md',
  isOnline,
  className,
}: AvatarWithStatusProps) {
  // Calculate size values
  const sizeMap = {
    sm: {
      avatar: 'h-8 w-8',
      status: 'w-2 h-2 right-0 bottom-0',
    },
    md: {
      avatar: 'h-10 w-10',
      status: 'w-3 h-3 right-0 bottom-0',
    },
    lg: {
      avatar: 'h-12 w-12',
      status: 'w-3.5 h-3.5 right-0 bottom-0',
    },
  };

  // Get initials from name
  const getInitials = () => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0);
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`;
  };

  return (
    <div className={cn('relative', className)}>
      <Avatar className={sizeMap[size].avatar}>
        <AvatarImage src={src} alt={name} />
        <AvatarFallback>{getInitials()}</AvatarFallback>
      </Avatar>
      {isOnline !== undefined && (
        <span
          className={cn(
            'absolute border-2 border-white rounded-full',
            sizeMap[size].status,
            isOnline ? 'bg-emerald-500' : 'bg-gray-400'
          )}
        />
      )}
    </div>
  );
}
