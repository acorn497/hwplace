import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GlobalResponse } from '../global/global-response.dto';
import { ISC } from '../global/ISC';

/** 토큰 앞에 붙는 식별자. 로그나 코드에 섞여 있어도 무엇인지 알아보기 쉽다. */
const TOKEN_PREFIX = 'hwp_';

/** 한 유저가 가질 수 있는 토큰 수 */
const MAX_TOKENS_PER_USER = 5;

@Injectable()
export class ApiTokenService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  /**
   * 토큰 원문을 해시로 바꾼다.
   *
   * bcrypt가 아니라 SHA-256을 쓰는 이유:
   * 토큰은 32바이트 난수라 사전 공격이 불가능하고(비밀번호와 다르다),
   * 매 요청마다 검증해야 하므로 느린 해시는 그대로 지연이 된다.
   * 대신 DB에서 해시로 바로 조회할 수 있어 전체 스캔이 필요 없다.
   */
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userIndex: number, label: string) {
    const count = await this.prisma.api_token.count({
      where: { userId: userIndex, revoked: false },
    });

    if (count >= MAX_TOKENS_PER_USER) {
      const response: GlobalResponse = {
        title: 'API 토큰',
        message: `토큰은 최대 ${MAX_TOKENS_PER_USER}개까지 만들 수 있습니다. 쓰지 않는 토큰을 폐기해 주세요.`,
        internalStatusCode: ISC.TOKEN.LIMIT_EXCEEDED,
      };
      throw new NotFoundException(response);
    }

    const raw = TOKEN_PREFIX + randomBytes(32).toString('hex');

    await this.prisma.api_token.create({
      data: {
        userId: userIndex,
        token_hash: this.hash(raw),
        token_prefix: raw.slice(0, 12),
        label: label.slice(0, 32),
      },
    });

    const response: GlobalResponse = {
      title: 'API 토큰 발급',
      message: '토큰은 지금 한 번만 표시됩니다. 안전한 곳에 보관해 주세요.',
      internalStatusCode: ISC.SUCCESS,
      // 원문은 저장하지 않으므로 여기서만 볼 수 있다.
      data: { token: raw, label },
    };

    return response;
  }

  async list(userIndex: number) {
    const tokens = await this.prisma.api_token.findMany({
      where: { userId: userIndex, revoked: false },
      select: {
        token_idx: true,
        token_prefix: true,
        label: true,
        created_at: true,
        last_used_at: true,
      },
      orderBy: { token_idx: 'desc' },
    });

    const response: GlobalResponse = {
      title: 'API 토큰',
      internalStatusCode: ISC.SUCCESS,
      data: {
        limit: MAX_TOKENS_PER_USER,
        tokens: tokens.map(token => ({
          index: token.token_idx,
          prefix: token.token_prefix,
          label: token.label,
          createdAt: token.created_at,
          lastUsedAt: token.last_used_at,
        })),
      },
    };

    return response;
  }

  async revoke(userIndex: number, tokenIndex: number) {
    // 남의 토큰을 폐기하지 못하도록 소유자까지 조건에 넣는다.
    const result = await this.prisma.api_token.updateMany({
      where: { token_idx: tokenIndex, userId: userIndex, revoked: false },
      data: { revoked: true },
    });

    if (result.count === 0) {
      const response: GlobalResponse = {
        title: 'API 토큰',
        message: '해당 토큰을 찾을 수 없습니다.',
        internalStatusCode: ISC.TOKEN.NOT_FOUND,
      };
      throw new NotFoundException(response);
    }

    const response: GlobalResponse = {
      title: 'API 토큰 폐기',
      message: '토큰을 폐기했습니다.',
      internalStatusCode: ISC.SUCCESS,
    };

    return response;
  }

  /**
   * 토큰 원문으로 소유자를 찾는다. 유효하지 않으면 null.
   * 제재된 계정의 토큰은 통과시키지 않는다.
   */
  async resolve(raw: string) {
    const token = await this.prisma.api_token.findUnique({
      where: { token_hash: this.hash(raw) },
      select: {
        token_idx: true,
        revoked: true,
        user: {
          select: { USER_INDEX: true, USER_RESTRICTED: true },
        },
      },
    });

    if (!token || token.revoked || token.user.USER_RESTRICTED) return null;

    // 마지막 사용 시각 갱신은 실패해도 요청을 막을 이유가 없다.
    this.prisma.api_token
      .update({
        where: { token_idx: token.token_idx },
        data: { last_used_at: new Date() },
      })
      .catch(() => undefined);

    return { userIndex: token.user.USER_INDEX, tokenIndex: token.token_idx };
  }
}
