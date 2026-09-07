import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { io, Socket } from "socket.io-client";
import { ConnectionStatus } from "./enums/ConnectionStatus.enum";

interface SocketContextType {
  socket: Socket | null;
  connectionStatus: string;
  isConnected: boolean;
  onlineUsers: number | null;
  startConnection: () => void;
  /** 연결 실패 후 소켓을 다시 연다 */
  retryConnection: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>(ConnectionStatus.CONNECTING);
  const [isConnected, setIsConnected] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);
  const [sessionId, setSessionId] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<number | null>(null);

  const startConnection = useCallback(() => {
    setShouldConnect(true);
  }, []);

  const retryConnection = useCallback(() => {
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setIsConnected(false);
    setOnlineUsers(null);
    setSessionId((id) => id + 1);
    setShouldConnect(true);
  }, []);

  useEffect(() => {
    if (!shouldConnect) return;

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // PixelProvider가 chunk 리스너를 등록한 뒤 connect / request-chunks 한다.
      autoConnect: false,
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setConnectionStatus(ConnectionStatus.CONNECTED);
      setIsConnected(true);
      newSocket.emit('request-information');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      setIsConnected(false);
      setOnlineUsers(null);
    });

    newSocket.on('server-information', (data: { onlineUsers: number }) => {
      setOnlineUsers(data.onlineUsers);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionStatus(ConnectionStatus.ERROR);
      setIsConnected(false);
    });

    /*
     * 재연결 관련 이벤트는 소켓이 아니라 Manager(newSocket.io)가 낸다.
     * socket.on('reconnect_failed')는 임의의 서버 이벤트명으로 취급되어
     * 타입 검사는 통과하지만 영원히 발화하지 않는다 → FAILED 상태와 재시도 UI가 죽는다.
     */
    newSocket.io.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
      setConnectionStatus(ConnectionStatus.CONNECTING);
    });

    newSocket.io.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setConnectionStatus(ConnectionStatus.CONNECTED);
      setIsConnected(true);
    });

    newSocket.io.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      setConnectionStatus(ConnectionStatus.FAILED);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('server-information');
      newSocket.off('connect_error');
      newSocket.io.off('reconnect_attempt');
      newSocket.io.off('reconnect');
      newSocket.io.off('reconnect_failed');
      newSocket.close();
    };
  }, [shouldConnect, sessionId]);

  const value: SocketContextType = {
    socket,
    connectionStatus,
    isConnected,
    onlineUsers,
    startConnection,
    retryConnection,
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
