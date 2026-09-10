import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SandboxService } from './sandbox.service';

/**
 * 샌드박스를 주기적으로 비운다.
 *
 * 이 초기화가 샌드박스의 존재 이유다. 무제한으로 칠하게 두되 피해가 누적되지 않도록
 * 주기적으로 리셋해서, 봇이 마음껏 놀아도 남는 것이 없게 만든다.
 *
 * 기본은 매시 정각. SANDBOX_RESET_CRON 으로 바꿀 수 있다.
 * (주기를 바꾸면 SANDBOX_RESET_MINUTES 도 함께 맞춰야 남은 시간 표시가 어긋나지 않는다)
 */
@Injectable()
export class SandboxScheduler {
  constructor(
    private readonly sandboxService: SandboxService,
  ) { }

  @Cron(process.env.SANDBOX_RESET_CRON ?? '0 * * * *', { name: 'sandbox-reset' })
  async handleReset() {
    await this.sandboxService.reset('scheduled');
  }
}
