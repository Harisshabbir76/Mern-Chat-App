import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketMessage } from '@shared/schema';

type WebSocketHookResult = {
  socket: WebSocket | null;
  connected: boolean;
  sendMessage: (message: WebSocketMessage) => void;
};

export function useWebSocket(): WebSocketHookResult {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      console.log('WebSocket connection established');
      setConnected(true);
    });

    socket.addEventListener('close', () => {
      console.log('WebSocket connection closed');
      setConnected(false);
    });

    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    });

    // Clean up function
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected, cannot send message');
    }
  }, []);

  return {
    socket: socketRef.current,
    connected,
    sendMessage,
  };
}
