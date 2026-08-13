import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PlansService } from './plans/plans.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const plansService = app.get(PlansService);
  
  const plans = await plansService.getAllPlans();
  console.log('--- PLANS ---');
  plans.forEach((p: any) => console.log(`ID: ${p.id}, Code: ${p.code}, Name: ${p.name}, Period: ${p.period}`));
  
  await app.close();
}
bootstrap();
