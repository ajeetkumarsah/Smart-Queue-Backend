import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService, ConfigModule } from '@nestjs/config';

export const PG_CONNECTION = 'PG_CONNECTION';

const dbProvider = {
  provide: PG_CONNECTION,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return new Pool({
      user: configService.get<string>('POSTGRES_USER', 'postgres'),
      host: configService.get<string>('POSTGRES_HOST', 'localhost'),
      database: configService.get<string>('POSTGRES_DB', 'smart_queue'),
      password: configService.get<string>('POSTGRES_PASSWORD', 'password'),
      port: configService.get<number>('POSTGRES_PORT', 5432),
    });
  },
};

@Global()
@Module({
  providers: [dbProvider],
  exports: [dbProvider],
})
export class DatabaseModule {}
