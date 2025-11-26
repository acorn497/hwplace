import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { io, Socket } from "socket.io-client";

interface SocketInterface {
  socket: Socket,

  connectionStatus: ConnectionStatusEnum,
  setConnectionStatus: (parameter: ConnectionStatusEnum) => void,
}

const socket = io(`${import.meta.env.VITE_BACKEND_URL}`, {
  transports: ["websocket"],
  autoConnect: false,
});

const SocketContext = createContext<SocketInterface | undefined>(undefined);

export enum ConnectionStatusEnum {
  CONNECTING = "CONNECTING",
  ESTABLISHED = "ESTABLISHED",
  DISCONNECTED = "DISCONNECTED",
  FAILED = "FAILED",
}

export const SocketProvider = ({ children }: PropsWithChildren) => {
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatusEnum.CONNECTING);

  useEffect(() => {
    setTimeout(() => {
      socket.connect();
    }, 1500);

    socket.on("connect", () => {
      setConnectionStatus(ConnectionStatusEnum.ESTABLISHED);
      console.log("소켓 연결됨:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnectionStatus(ConnectionStatusEnum.DISCONNECTED);
      console.log("소켓 연결 끊김:", reason);
    });

    socket.on("connect_error", (error) => {
      setConnectionStatus(ConnectionStatusEnum.FAILED);
      console.error("소켓 연결 실패:", error);
    });

    socket.on("reconnect_attempt", () => {
      setConnectionStatus(ConnectionStatusEnum.CONNECTING);
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

  const value: SocketInterface = {
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