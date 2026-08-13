/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Pool, PoolClient } from 'pg';
import { PG_CONNECTION } from './database.constants';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(
      'Initializing database schema and checking default seed data...',
    );
    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch (err) {
      this.logger.error(
        'Failed to connect to PostgreSQL pool during module init:',
        err,
      );
      return;
    }

    try {
      // 1. Extensions & Functions
      await client
        .query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)
        .catch(() => {
          this.logger.warn(
            'Could not enable uuid-ossp extension; using fallback UUID functions.',
          );
        });

      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
           NEW.updated_at = NOW();
           RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      // 2. Tables creation
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            full_name VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            role VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS businesses (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            address TEXT,
            phone VARCHAR(50),
            logo_url VARCHAR(255),
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            is_verified BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS business_settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
            timezone VARCHAR(50) DEFAULT 'UTC',
            working_hours JSONB,
            max_queue_limit INT DEFAULT 100,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS branches (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            latitude DECIMAL(10, 8),
            longitude DECIMAL(11, 8),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS services (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
            branch_id UUID,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            estimated_wait_time_mins INT DEFAULT 15,
            estimated_time_mins INT DEFAULT 15,
            max_queue_size INT DEFAULT 50,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS queues (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_number VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'WAITING',
            position INT NOT NULL,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            called_at TIMESTAMP WITH TIME ZONE,
            served_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS queue_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            queue_id UUID NOT NULL,
            service_id UUID NOT NULL,
            user_id UUID NOT NULL,
            status_changed_to VARCHAR(50) NOT NULL,
            changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS feedback (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comments TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            body TEXT NOT NULL,
            is_read BOOLEAN DEFAULT false,
            type VARCHAR(50),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP WITH TIME ZONE
        );
      `);

      // 3. Ensure any missing columns are added safely

      const createPlansQuery = `
        CREATE TABLE IF NOT EXISTS plans (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            period VARCHAR(50) NOT NULL,
            features JSONB,
            is_active BOOLEAN DEFAULT true,
            has_tag BOOLEAN DEFAULT false,
            tag_text VARCHAR(50),
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await client.query(createPlansQuery);
      
      // Remove unique constraint if it was created in older versions
      try {
        await client.query('ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_code_key;');
        await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS has_tag BOOLEAN DEFAULT false;');
        await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS tag_text VARCHAR(50);');
        await client.query('ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;');
      } catch (err) {
        // Ignore if constraint doesn't exist or name is different
      }

      // Seed default plans if empty
      const plansCheck = await client.query('SELECT COUNT(*) FROM plans');
      if (parseInt(plansCheck.rows[0].count, 10) === 0) {
        await client.query(`
          INSERT INTO plans (name, code, price, period, features, has_tag, tag_text, description) VALUES
          ('Monthly Plan', 'MONTHLY', 9.99, '/mo', '["Add more businesses"]'::jsonb, true, 'Active', 'Get started with essential tools to manage your team efficiently. Ideal for small teams with fundamental needs.'),
          ('Yearly Plan', 'YEARLY', 99.99, '/yr', '["Add more businesses", "Best value"]'::jsonb, true, 'Save 15%', 'Maximize team performance with premium tools and full customization options, perfect for larger organizations.')
        `);
      }

      const createSubscriptionsQuery = `
        CREATE TABLE IF NOT EXISTS subscriptions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan_type VARCHAR(50) NOT NULL,
            start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            end_date TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await client.query(createSubscriptionsQuery);

      const createBusinessOperatorsQuery = `
        CREATE TABLE IF NOT EXISTS business_operators (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(business_id, user_id)
        );
      `;
      await client.query(createBusinessOperatorsQuery);

      const createAuditLogsQuery = `
        CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(50) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id UUID NOT NULL,
            old_data JSONB,
            new_data JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      await client.query(createAuditLogsQuery);

      const addColumnQueries = [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address TEXT;`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`,
        `ALTER TABLE services ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;`,
        `ALTER TABLE services ADD COLUMN IF NOT EXISTS estimated_wait_time_mins INT DEFAULT 15;`,
        `ALTER TABLE services ADD COLUMN IF NOT EXISTS max_queue_size INT DEFAULT 50;`,
        `ALTER TABLE services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS category VARCHAR(100);`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS allow_rejoin BOOLEAN DEFAULT true;`,
        `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rejoin_grace_period_mins INT DEFAULT 15;`,
        `ALTER TABLE queues ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0;`,
        `CREATE INDEX IF NOT EXISTS idx_businesses_location ON businesses (latitude, longitude);`,
      ];
      for (const query of addColumnQueries) {
        await client
          .query(query)
          .catch((e: Error) => this.logger.debug(e.message));
      }

      this.logger.log('Database schema ensured.');

      // Removed seeder logic as requested by user
    } catch (err) {
      this.logger.error('Error initializing database schema or seeding:', err);
    } finally {
      client.release();
    }
  }
}
