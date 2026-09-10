import { Module } from '@nestjs/common';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';
import { SandboxScheduler } from './sandbox.scheduler';
import { SandboxGuard } from '../auth/guard/sandbox.guard';
import { UtilModule } from 'src/util/util.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WebsocketModule } from '../paint/websocket/websocket.module';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [UtilModule, PrismaModule, WebsocketModule, TokenModule],
  controllers: [SandboxController],
  providers: [SandboxService, SandboxScheduler, SandboxGuard],
})
export class SandboxModule { }
