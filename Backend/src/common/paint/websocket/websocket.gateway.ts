import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import log from 'spectra-log';
import { CacheService } from 'src/cache/redis-cache.service';
import { ChunkService } from 'src/util/chunk.service';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket']
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly cacheService: CacheService,
    private readonly chunkService: ChunkService,
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

    // 청크는 클라이언트가 리스너 준비 후 request-chunks 로 요청할 때 보낸다.
    this.broadcastOnlineUsers();
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

    this.broadcastOnlineUsers();
  }

  // 현재 접속자 수를 모든 클라이언트에게 브로드캐스트
  private broadcastOnlineUsers() {
    this.server.emit('server-information', {
      onlineUsers: this.server.sockets.sockets.size,
    });
  }

  /** 연결 성공 후 클라이언트가 요청하면 캔버스 청크를 전송한다. */
  @SubscribeMessage('request-chunks')
  async handleRequestChunks(
    @ConnectedSocket() client: Socket,
  ) {
    if (this.loadingClients.get(client.id)) {
      log(`Client ${client.id} already loading chunks, ignoring duplicate request`);
      return;
    }

    await this.sendChunksToClient(client);
  }

  /**
   * 한 번의 MGET으로 읽어 한꺼번에 내보내는 청크 묶음 크기.
   * 이 값이 청크 총 개수보다 작아야 실제로 스트리밍이 된다.
   */
  private static readonly CHUNK_BATCH_SIZE = 20;

  private async sendChunksToClient(client: Socket) {
    const { chunkSize, chunkCountX, chunkCountY, canvasWidth, canvasHeight } = this.chunkService;

    this.loadingClients.set(client.id, true);

    try {
      // 부팅 로드가 끝나기 전에 보내면 흰 캔버스를 내려주게 된다. 준비될 때까지 기다린다.
      if (!this.cacheService.isReady) {
        log(`Cache not ready, holding chunk request from ${client.id}`);
        await this.cacheService.whenReady();

        // 기다리는 사이에 끊겼다면 보낼 필요가 없다.
        if (!this.loadingClients.get(client.id)) {
          log(`Client ${client.id} disconnected while waiting for cache`);
          return;
        }
      }

      // 캔버스 크기의 단일 출처는 서버다. 클라이언트가 청크 수 x 청크 크기로 역산하면
      // 캔버스 변이 청크 크기의 배수가 아닐 때 어긋나므로 실제 크기를 그대로 내려준다.
      client.emit('chunk_start', {
        canvasWidth,
        canvasHeight,
        chunkSize,
        chunkCountX,
        chunkCountY,
        totalChunks: chunkCountX * chunkCountY,
      });
      log("Sending chunks");

      const coordinates: Array<{ cx: number; cy: number }> = [];
      for (let cy = 0; cy < chunkCountY; cy++) {
        for (let cx = 0; cx < chunkCountX; cx++) {
          coordinates.push({ cx, cy });
        }
      }

      for (let i = 0; i < coordinates.length; i += WebsocketGateway.CHUNK_BATCH_SIZE) {
        if (!this.loadingClients.get(client.id)) {
          log(`Client ${client.id} disconnected, aborting remaining chunks`);
          break;
        }

        const batch = coordinates.slice(i, i + WebsocketGateway.CHUNK_BATCH_SIZE);
        const buffers = await this.cacheService.getChunkBuffers(batch);

        if (!this.loadingClients.get(client.id)) {
          log(`Client ${client.id} disconnected, aborting remaining chunks`);
          break;
        }

        batch.forEach(({ cx, cy }, index) => {
          // 원본 RGB 버퍼를 그대로 실어 보낸다. socket.io가 바이너리 프레임으로 처리한다.
          client.emit('chunk_data', {
            chunkNumber: cy * chunkCountX + cx,
            chunkX: cx,
            chunkY: cy,
            width: this.chunkService.getChunkWidth(cx),
            height: this.chunkService.getChunkHeight(cy),
            data: buffers[index],
          });
        });
      }

      if (this.loadingClients.get(client.id)) {
        client.emit('chunk_finish');
        log(`Finished sending chunks to ${client.id}`);
      }
    } catch (error) {
      console.error(error);
      client.emit('chunk_error', { message: '캔버스 데이터를 전송하지 못했습니다.' });
    } finally {
      this.loadingClients.delete(client.id);
    }
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
    // 요청한 클라이언트에게만 현재 서버 정보(접속자 수)를 응답
    client.emit('server-information', {
      onlineUsers: this.server.sockets.sockets.size,
    });
  }
}
