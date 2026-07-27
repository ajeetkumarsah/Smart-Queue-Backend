/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import * as argon2 from 'argon2';
import { PG_CONNECTION } from './database.module';

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
      ];
      for (const query of addColumnQueries) {
        await client
          .query(query)
          .catch((e: Error) => this.logger.debug(e.message));
      }

      this.logger.log('Database schema ensured.');

      // 4. Seed test users if not present
      await this.seedTestUsers(client);
    } catch (err) {
      this.logger.error('Error initializing database schema or seeding:', err);
    } finally {
      client.release();
    }
  }

  private async seedTestUsers(client: PoolClient): Promise<void> {
    try {
      const defaultPasswordHash = await argon2.hash('Test123');
      const examplePasswordHash = await argon2.hash('password123');

      // Super Admin
      await client.query(
        `
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name, role = EXCLUDED.role
      `,
        [
          'Super Admin',
          'admin@test.com',
          '+10000000000',
          defaultPasswordHash,
          'SUPER_ADMIN',
        ],
      );

      // Business Owner
      const businessUserRes = await client.query<{ id: string }>(
        `
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name, role = EXCLUDED.role
        RETURNING id
      `,
        [
          'Dr. Smith',
          'business@test.com',
          '+10000000001',
          defaultPasswordHash,
          'BUSINESS_OWNER',
        ],
      );

      // Customer 1 (customer@test.com)
      await client.query(
        `
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name, role = EXCLUDED.role
      `,
        [
          'John Customer',
          'customer@test.com',
          '+10000000002',
          defaultPasswordHash,
          'CUSTOMER',
        ],
      );

      // Customer 2 (test@example.com / password123)
      await client.query(
        `
        INSERT INTO users (full_name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name, role = EXCLUDED.role
      `,
        [
          'Test User',
          'test@example.com',
          '+10000000099',
          examplePasswordHash,
          'CUSTOMER',
        ],
      );

      // Check if business exists for Dr. Smith
      const ownerId = businessUserRes.rows[0]?.id;
      if (ownerId) {
        const businessRes = await client.query<{ id: string }>(
          `
          INSERT INTO businesses (owner_id, name, description, address, phone, is_verified, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
          RETURNING id
        `,
          [
            ownerId,
            'Dr. Smith Clinic',
            'General Healthcare & Cardiology',
            '123 Health Ave, New York, NY',
            '+18005550199',
            true,
            true,
          ],
        );

        let businessId = businessRes.rows[0]?.id;
        if (!businessId) {
          const existingBiz = await client.query<{ id: string }>(
            `SELECT id FROM businesses WHERE owner_id = $1 LIMIT 1`,
            [ownerId],
          );
          businessId = existingBiz.rows[0]?.id;
        }

        if (businessId) {
          // Check if services exist
          const existingServices = await client.query<{ id: string }>(
            `SELECT id FROM services WHERE business_id = $1 LIMIT 1`,
            [businessId],
          );
          if (existingServices.rows.length === 0) {
            await client.query(
              `
              INSERT INTO services (business_id, name, description, estimated_wait_time_mins, estimated_time_mins, max_queue_size, is_active)
              VALUES 
              ($1, 'General Consultation', 'Walk-in doctor consultation', 15, 15, 50, true),
              ($1, 'Dental Checkup', 'Routine dental cleaning and checkup', 20, 20, 30, true)
            `,
              [businessId],
            );
          }
        }
      }

      this.logger.log(
        'Default test users and sample business seeded successfully.',
      );
    } catch (e) {
      this.logger.error('Error in seedTestUsers:', e);
    }
  }
}
