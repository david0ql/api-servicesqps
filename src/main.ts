import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { join } from 'path';
import * as express from 'express';

import { AppModule } from './app.module';

import envVars from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ forbidNonWhitelisted: true, whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = new DocumentBuilder()
    .setTitle('Services QPS API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  app.enableCors({
    origin: "*"
  });

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(envVars.PORT);
}

bootstrap();
