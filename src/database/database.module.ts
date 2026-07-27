import { Module, Global } from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';
import { ConfigService } from '@nestjs/config';
import { DatabaseInitService } from './database-init.service';

export const PG_CONNECTION = 'PG_CONNECTION';

const dbProvider = {
  provide: PG_CONNECTION,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const connectionString =
      configService.get<string>('DATABASE_URL') ||
      configService.get<string>('POSTGRES_URL');
    const host = configService.get<string>('POSTGRES_HOST', 'localhost');
    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      (connectionString &&
        (connectionString.includes('localhost') ||
          connectionString.includes('127.0.0.1')));

    const sslEnabled =
      configService.get<string>('DB_SSL') === 'true' ||
      configService.get<string>('POSTGRES_SSL') === 'true' ||
      (process.env.NODE_ENV === 'production' && !isLocalHost) ||
      (!!connectionString && !isLocalHost);

    const poolConfig: PoolConfig = connectionString
      ? {
          connectionString,
          ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
        }
      : {
          user: configService.get<string>('POSTGRES_USER', 'postgres'),
          host,
          database: configService.get<string>('POSTGRES_DB', 'smart_queue'),
          password: configService.get<string>('POSTGRES_PASSWORD', 'password'),
          port: configService.get<number>('POSTGRES_PORT', 5432),
          ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
        };

    return new Pool(poolConfig);
  },
};

@Global()
@Module({
  providers: [dbProvider, DatabaseInitService],
  exports: [dbProvider, DatabaseInitService],
})
export class DatabaseModule {}
