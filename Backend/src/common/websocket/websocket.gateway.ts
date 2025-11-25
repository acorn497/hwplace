import { ConfigService } from '@nestjs/config';
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
import log from 'spectra-log';
import DB from 'src/util/db.util';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket']
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly configService: ConfigService,
  ) { }
  @WebSocketServer()
  server: Server;

  private messageCount = 0;
  private startTime = Date.now();
  private lastResetTime = Date.now();

  async handleConnection(client: Socket) {
    console.log(`
Connect   : ${client.id}
Remain    : ${this.server.sockets.sockets.size}
      `);

    const CANVAS_SIZE_X = this.configService.get<number>("CANVAS_SIZE_X") ?? 500;
    const CANVAS_SIZE_Y = this.configService.get<number>("CANVAS_SIZE_Y") ?? 500;
    const CHUNK_SIZE = this.configService.get<number>("CHUNK_SIZE") ?? 100;

    const CHUNK_COUNT_X = CANVAS_SIZE_X / CHUNK_SIZE;
    const CHUNK_COUNT_Y = CANVAS_SIZE_Y / CHUNK_SIZE;

    try {
      this.server.emit('chunk_start', {
        chunkWidth: CHUNK_COUNT_X,
        chunkHeight: CHUNK_COUNT_Y,
        chunkSize: CHUNK_SIZE,
      });
      log("Sending chunks")

      for (let cy = 0; cy < CHUNK_COUNT_Y; cy++) {
        for (let cx = 0; cx < CHUNK_COUNT_X; cx++) {
          const pixels = await DB.pixel.findMany({
            where: {
              PIXEL_POS_Y: {
                gte: cy * CHUNK_SIZE,
                lt: Math.min((cy + 1) * CHUNK_SIZE, CANVAS_SIZE_X),
              },
              PIXEL_POS_X: {
                gte: cx * CHUNK_SIZE,
                lt: Math.min((cx + 1) * CHUNK_SIZE, CANVAS_SIZE_Y),
              },
            }
          });

          this.server.emit('chunk_data', {
            chunkX: cx,
            chunkY: cy,
            pixels: pixels,
          })
        }
      }

      this.server.emit('chunk_finish')
    } catch (error) {
      console.error(error)
    }
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