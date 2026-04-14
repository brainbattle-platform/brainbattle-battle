import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './ws/redis-io.adapter';
import Redis from 'ioredis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Socket.IO + Redis adapter (required for multi-instance scale)
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL is not defined');

  const pub = new Redis(redisUrl);
  const sub = pub.duplicate();
  app.useWebSocketAdapter(new RedisIoAdapter(app, pub, sub));

  if (process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('BrainBattle - Battle API (Sprint 1)')
      .setDescription('Room/Lobby + Socket.IO (No Auth)')
      .setVersion('1.0.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
