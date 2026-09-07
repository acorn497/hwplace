import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UtilModule } from 'src/util/util.module';
import { RedisCacheModule } from 'src/cache/redis-cache.module';
import { WebsocketModule } from '../paint/websocket/websocket.module';
import { PaintModule } from '../paint/paint.module';

@Module({
  imports: [
    PrismaModule,
    UtilModule,
    RedisCacheModule,
    // 영역 초기화 결과를 접속 중인 클라이언트에 즉시 반영하려면 게이트웨이가 필요하다.
    WebsocketModule,
    // 제재 해제 시 누적 위반 기록을 지우기 위해 AbuseDetectorService 가 필요하다
    PaintModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule { }
