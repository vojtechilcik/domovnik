import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Swagger / OpenAPI docs
  const config = new DocumentBuilder()
    .setTitle('Domovník API')
    .setDescription('Property management app for the Czech rental market')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('Domovník — Phase 2 server running on http://localhost:3000');
  console.log('Swagger docs at http://localhost:3000/api');
}

void bootstrap();
