import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { io } from "socket.io-client";
import { ConnectionStatus } from "./enums/ConnectionStatus.enum";
import type { SocketContext } from "./interfaces/Socket.interface";

const socket = io(`${import.meta.env.VITE_BACKEND_URL}`, {
  transports: ["websocket"],
  autoConnect: false,
});

const SocketContext = createContext<SocketContext | undefined>(undefined);

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.CONNECTING);

  useEffect(() => {
    setTimeout(() => {
      socket.connect();
    }, 1500);

    socket.on("connect", () => {
      setConnectionStatus(ConnectionStatus.ESTABLISHED);
      console.log("소켓 연결됨:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      console.log("소켓 연결 끊김:", reason);
    });

    socket.on("connect_error", (error) => {
      setConnectionStatus(ConnectionStatus.FAILED);
      console.error("소켓 연결 실패:", error);
    });

    socket.on("reconnect_attempt", () => {
      setConnectionStatus(ConnectionStatus.CONNECTING);
      console.log("재연결 시도 중...");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("reconnect_attempt");
      socket.disconnect();
    };
  }, []);

  const value: SocketContext = {
    socket: socket,
    connectionStatus, setConnectionStatus
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket이 SocketProvider 외부에서 호출되었습니다.");
  }
  return context;
}