import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

function enableBigIntJsonSerialization() {
  if (typeof (BigInt.prototype as any).toJSON !== 'function') {
    Object.defineProperty(BigInt.prototype, 'toJSON', {
      value: function () {
        return this.toString();
      },
      writable: true,
      configurable: true,
    });
  }
}

async function bootstrap() {
  enableBigIntJsonSerialization();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('BrainBattle Battle API')
    .setDescription(
      'Realtime battle, matchmaking, rank, reward, shop and blockchain proof APIs.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`BrainBattle Battle API running at http://localhost:${port}/api/docs`);
}

bootstrap();