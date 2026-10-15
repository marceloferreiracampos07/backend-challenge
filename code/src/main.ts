import 'tsconfig-paths/register';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  // Passando o ExpressAdapter explicitamente aqui:
  const app = await NestFactory.create(AppModule, new ExpressAdapter());

  app.enableCors();
  app.useGlobalPipes(new ZodValidationPipe());

  await app.listen(app.get(ConfigService).get<number>('PORT', 3000));
}

void bootstrap();