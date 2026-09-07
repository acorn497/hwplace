import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ISC } from './common/global/ISC';
import { HttpExceptionFilter } from './common/filter/global-exception.filter';
import { ValidationExceptionFilter } from './common/filter/validation-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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
  )

  // 정적 파일 제공
  app.useStaticAssets(join(__dirname, '..', 'public'));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
