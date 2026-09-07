import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ISC } from './common/global/ISC';
import { HttpExceptionFilter } from './common/filter/global-exception.filter';
import { ValidationExceptionFilter } from './common/filter/validation-exception.filter';
import { ThrottlerExceptionFilter } from './common/filter/throttler-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /*
    본문 크기 상한.

    50MB 였을 때는 요청 하나에 픽셀 80만 개(캔버스의 77%)를 담을 수 있었다.
    컨트롤러가 픽셀 수를 검사하기 전에 이미 그 본문을 받아 파싱하므로,
    입구에서부터 줄여야 파싱 비용 자체를 막을 수 있다.
    쿼터 상한(기본 2만 픽셀 ≈ 1.3MB)에 여유를 둔 값이다.
  */
  const bodyLimit = process.env.BODY_SIZE_LIMIT ?? '4mb';
  app.use(bodyParser.json({ limit: bodyLimit }));
  app.use(bodyParser.urlencoded({ limit: bodyLimit, extended: true }));

  // CORS 
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    // 리플레이 캔버스 응답의 메타데이터를 프론트가 읽으려면 명시적으로 노출해야 한다
    exposedHeaders: ['X-Canvas-Width', 'X-Canvas-Height', 'X-Applied-Events', 'X-From-Keyframe'],
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, 
    forbidNonWhitelisted: true, 
    transform: true, 
  }));

  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new ValidationExceptionFilter(),
    new ThrottlerExceptionFilter(),
  )

  // 정적 파일 제공
  app.useStaticAssets(join(__dirname, '..', 'public'));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
