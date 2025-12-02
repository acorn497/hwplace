import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { io, Socket } from "socket.io-client";
import { ConnectionStatus } from "./enums/ConnectionStatus.enum";

interface SocketContextType {
  socket: Socket | null;
  connectionStatus: string;
  isConnected: boolean;
  startConnection: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>(ConnectionStatus.CONNECTING);
  const [isConnected, setIsConnected] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);

  // ========================================
  // -- 연결 시작 함수 (PixelProvider에서 호출)
  // ========================================
  const startConnection = () => {
    setShouldConnect(true);
  };

  useEffect(() => {
    if (!shouldConnect) return;

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

    // Socket.IO 클라이언트 생성
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setConnectionStatus(ConnectionStatus.CONNECTED);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionStatus(ConnectionStatus.ERROR);
      setIsConnected(false);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
      setConnectionStatus(ConnectionStatus.CONNECTING);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setConnectionStatus(ConnectionStatus.CONNECTED);
      setIsConnected(true);
    });

    setSocket(newSocket);

    // 컴포넌트 언마운트 시 소켓 연결 해제
    return () => {
      newSocket.close();
    };
  }, [shouldConnect]);

  const value: SocketContextType = {
    socket,
    connectionStatus,
    isConnected,
    startConnection,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket이 SocketProvider 외부에서 호출되었습니다.');
  }
  return context;
};
