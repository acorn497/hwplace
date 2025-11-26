import type { Socket } from "socket.io-client";
import type { ConnectionStatus } from "../enums/ConnectionStatus.enum";

export interface SocketContext {
  socket: Socket,

  connectionStatus: ConnectionStatus,
  setConnectionStatus: (parameter: ConnectionStatus) => void,
}