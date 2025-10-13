import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: true, 
    credentials: true,
  },
  transports: ['websocket'] 
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private messageCount = 0;
  private startTime = Date.now();
  private lastResetTime = Date.now();

  handleConnection(client: Socket) {
    console.log(`
Connect   : ${client.id}
Remain    : ${this.server.sockets.sockets.size}
      `);
  }

  handleDisconnect(client: Socket) {
    console.log(`
Disconnect: ${client.id}
Remain    : ${this.server.sockets.sockets.size}
      `);
  }

  @SubscribeMessage('send-message')
  handleMessage(
    @MessageBody() data: { message: string; sender: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.emit('receive-message', {
      message: data.message,
      sender: data.sender,
      timestamp: new Date().toISOString(),
    });
  }
}