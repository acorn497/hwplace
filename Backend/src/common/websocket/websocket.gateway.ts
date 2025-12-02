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
    private readonly configService: ConfigService
  ) { }
  @WebSocketServer()
  server: Server;

  private messageCount = 0;
  private startTime = Date.now();
  private lastResetTime = Date.now();
  private loadingClients = new Map<string, boolean>(); // 로딩 중인 클라이언트 추적

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

    // 클라이언트 로딩 시작
    this.loadingClients.set(client.id, true);

    try {
      client.emit('chunk_start', {
        chunkWidth: CHUNK_COUNT_X,
        chunkHeight: CHUNK_COUNT_Y,
        chunkSize: CHUNK_SIZE,
      });
      log("Sending chunks")

      const chunkTasks: Array<() => Promise<void>> = [];

      for (let cy = 0; cy < CHUNK_COUNT_Y; cy++) {
        for (let cx = 0; cx < CHUNK_COUNT_X; cx++) {
          chunkTasks.push(async () => {
            if (!this.loadingClients.get(client.id)) {
              log(`Client ${client.id} disconnected, stopping chunk load`);
              return;
            }

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

            const formattedPixels = pixels.map(pixel => ({
              posX: pixel.PIXEL_POS_X,
              posY: pixel.PIXEL_POS_Y,
              colorR: pixel.PIXEL_COLOR_R,
              colorG: pixel.PIXEL_COLOR_G,
              colorB: pixel.PIXEL_COLOR_B,
              uuid: pixel.PIXEL_UUID
            }));

            // 다시 한번 연결 확인 후 emit
            if (this.loadingClients.get(client.id)) {
              client.emit('chunk_data', {
                chunkX: cx,
                chunkY: cy,
                pixels: formattedPixels,
              });
            }
          });
        }
      }

      // 한 번에 최대 5개씩 Promise 실행
      const CONCURRENT_LIMIT = 20;
      for (let i = 0; i < chunkTasks.length; i += CONCURRENT_LIMIT) {
        if (!this.loadingClients.get(client.id)) {
          log(`Client ${client.id} disconnected, aborting remaining chunks`);
          break;
        }

        const batch = chunkTasks.slice(i, i + CONCURRENT_LIMIT);
        await Promise.all(batch.map(task => task()));
      }

      // 모든 chunk 전송 완료 후 finish 이벤트 전송
      if (this.loadingClients.get(client.id)) {
        client.emit('chunk_finish');
        log(`Finished sending chunks to ${client.id}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      // 로딩 완료 후 클라이언트 제거
      this.loadingClients.delete(client.id);
    }
  }
  handleDisconnect(client: Socket) {
    // 로딩 중인 클라이언트 연결 끊김 처리
    if (this.loadingClients.has(client.id)) {
      this.loadingClients.delete(client.id);
      log(`Client ${client.id} disconnected during chunk loading`);
    }

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

  @SubscribeMessage('request-information')
  handleInformation(
    @ConnectedSocket() client: Socket,
  ) {
    this.server
  }
}