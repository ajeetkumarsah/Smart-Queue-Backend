import { Module, Global } from '@nestjs/common';
import { Pool, PoolConfig } from 'pg';
import { ConfigService } from '@nestjs/config';
import { DatabaseInitService } from './database-init.service';
import { PG_CONNECTION } from './database.constants';

export { PG_CONNECTION } from './database.constants';

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

    let servername = host;
    let finalConnectionString = connectionString;

    if (connectionString) {
      try {
        const url = new URL(connectionString);
        servername = url.hostname;

        const pgUser = configService.get<string>('POSTGRES_USER');
        if (
          url.hostname.includes('pooler.supabase.com') &&
          url.username === 'postgres' &&
          pgUser &&
          pgUser.includes('.')
        ) {
          url.username = pgUser;
          finalConnectionString = url.toString();
        }
      } catch {
        // ignore invalid URL
      }
    }

    const sslConfig = sslEnabled
      ? { rejectUnauthorized: false, servername }
      : undefined;

    const poolConfig: PoolConfig = finalConnectionString
      ? {
          connectionString: finalConnectionString,
          ssl: sslConfig,
        }
      : {
          user: configService.get<string>('POSTGRES_USER', 'postgres'),
          host,
          database: configService.get<string>('POSTGRES_DB', 'smart_queue'),
          password: configService.get<string>('POSTGRES_PASSWORD', 'password'),
          port: configService.get<number>('POSTGRES_PORT', 5432),
          ssl: sslConfig,
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
