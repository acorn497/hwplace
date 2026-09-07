process.env.CHUNK_SIZE = '64';
process.env.CANVAS_SIZE_X = '128';
process.env.CANVAS_SIZE_Y = '128';

import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from 'src/common/auth/guard/jwt.guard';
import { PaintPixelProcess, UnrecoverablePaintError } from 'src/common/paint/worker/paint.worker';
import { EncodeService } from 'src/util/encode.service';
import { ISC } from 'src/common/global/ISC';

const prisma = new PrismaClient();
let fail = 0;
const ok = (n: string, c: boolean, e = '') => { console.log(`${c?'PASS':'FAIL'}  ${n} ${c?'':e}`); if(!c) fail++; };

const SECRET = 'test-secret';
const jwt = new JwtService({ secret: SECRET });
const config = { get: () => SECRET } as unknown as ConfigService;

const ctx = (token: string) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }),
}) as unknown as ExecutionContext;

(async () => {
  const user = await prisma.user.create({ data:{ USER_DISPLAY:'u', USER_EMAIL:'u@x.com', USER_PASSWORD:'x' }});
  const guard = new AuthGuard(jwt, config, prisma as any);

  // --- AuthGuard: 존재하는 유저는 통과 ---
  const goodToken = await jwt.signAsync({ index: user.USER_INDEX, email:'u@x.com' });
  ok('존재하는 유저 토큰은 통과', await guard.canActivate(ctx(goodToken)) === true);

  // --- AuthGuard: 사라진 유저는 401 (FK 위반 전에 차단) ---
  const ghostToken = await jwt.signAsync({ index: 99999, email:'ghost@x.com' });
  let caught: any = null;
  try { await guard.canActivate(ctx(ghostToken)); } catch (e) { caught = e; }
  ok('없는 유저 토큰은 401로 차단', caught instanceof UnauthorizedException);
  ok('  ISC 코드가 USER_NOT_FOUND', caught?.getResponse?.()?.internalStatusCode === ISC.AUTH.USER_NOT_FOUND,
     JSON.stringify(caught?.getResponse?.()));

  // 유저가 삭제된 뒤에도 차단되는가 (로그의 실제 시나리오)
  const doomed = await prisma.user.create({ data:{ USER_DISPLAY:'d', USER_EMAIL:'d@x.com', USER_PASSWORD:'x' }});
  const doomedToken = await jwt.signAsync({ index: doomed.USER_INDEX, email:'d@x.com' });
  ok('삭제 전에는 통과', await guard.canActivate(ctx(doomedToken)) === true);
  await prisma.user.delete({ where:{ USER_INDEX: doomed.USER_INDEX }});
  let after: any = null;
  try { await guard.canActivate(ctx(doomedToken)); } catch (e) { after = e; }
  ok('삭제 후 같은 토큰은 401', after instanceof UnauthorizedException);

  // --- Worker: 실패를 삼키지 않고 던지는가 ---
  const cacheStub = { applyPixels: async () => {} } as any;
  const wsStub = { server: { sockets:{ sockets:{ size:0 }}, emit(){} } } as any;
  const cfgStub = { get: () => 3 } as unknown as ConfigService;
  const worker = new PaintPixelProcess(wsStub, cfgStub, prisma as any, cacheStub, new EncodeService());

  // 정상 경로
  const okJob: any = { data:{ pixels:[{ posX:1,posY:1,colorR:1,colorG:2,colorB:3, userIndex:user.USER_INDEX }] } };
  const result = await worker.process(okJob);
  ok('정상 픽셀은 저장 성공', result?.painted === 1, JSON.stringify(result));
  const saved = await prisma.pixel.findFirst({ where:{ PIXEL_POS_X:1, PIXEL_POS_Y:1 }});
  ok('  DB에 실제로 기록됨', saved?.PIXEL_COLOR_G === 2);
  const evt = await prisma.canvas_events.count();
  ok('  canvas_events 에도 기록됨 (리플레이용)', evt === 1, String(evt));

  // 없는 유저 -> 조용히 삼키지 말고 던져야 한다
  const badJob: any = { data:{ pixels:[{ posX:5,posY:5,colorR:9,colorG:9,colorB:9, userIndex:99999 }] } };
  let thrown: any = null;
  try { await worker.process(badJob); } catch (e) { thrown = e; }
  ok('FK 위반 시 예외를 던진다 (삼키지 않음)', thrown !== null);
  ok('  UnrecoverablePaintError 로 구분됨', thrown instanceof UnrecoverablePaintError, thrown?.name);
  const ghost = await prisma.pixel.findFirst({ where:{ PIXEL_POS_X:5, PIXEL_POS_Y:5 }});
  ok('  실패한 픽셀은 DB에 없음 (트랜잭션 롤백)', ghost === null);

  await prisma.$disconnect();
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
  process.exit(fail?1:0);
})().catch(async e => { console.error('ERROR:', e); await prisma.$disconnect(); process.exit(1); });
