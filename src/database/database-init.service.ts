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

      // 4. Seed test users if explicitly requested via env variable
      if (process.env.RUN_SEEDERS === 'true') {
        await this.seedTestUsers(client);
      }
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
          'Ajeet Kumarv Sah',
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
          INSERT INTO businesses (owner_id, name, description, address, phone, latitude, longitude, is_verified, is_active, category)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT DO NOTHING
          RETURNING id
        `,
          [
            ownerId,
            'Dr. Smith Clinic',
            'General Healthcare & Cardiology',
            '123 Health Ave, New York, NY',
            '+18005550199',
            37.7749,
            -122.4194,
            true,
            true,
            'Hospitals',
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
            );
          }
        }

        // Seed Sample Parking Businesses for Nearby Search
        const parkingBusinesses = [
          {
            name: 'Central Mall Smart Parking',
            desc: 'Automated barrier and valet parking at Central Mall',
            address: '456 Market St, San Francisco, CA',
            lat: 37.775,
            lng: -122.418,
            service: 'Express Valet Parking',
            waitMins: 10,
          },
          {
            name: 'Downtown Express Valet Parking',
            desc: 'Covered VIP parking with instant queue join',
            address: '789 Mission St, San Francisco, CA',
            lat: 37.78,
            lng: -122.41,
            service: 'Covered VIP Parking',
            waitMins: 5,
          },
          {
            name: 'Airport Terminal Smart Parking',
            desc: 'Short-stay gate parking and luggage drop-off',
            address: '100 Airport Blvd, San Francisco, CA',
            lat: 37.6213,
            lng: -122.379,
            service: 'Short-Stay Gate Queue',
            waitMins: 15,
          },
        ];

        for (const p of parkingBusinesses) {
          const res = await client.query<{ id: string }>(
            `
            INSERT INTO businesses (owner_id, name, description, address, phone, latitude, longitude, is_verified, is_active, category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING
            RETURNING id
          `,
            [
              ownerId,
              p.name,
              p.desc,
              p.address,
              '+18005550200',
              p.lat,
              p.lng,
              true,
              true,
              'Parking',
            ],
          );
          let pId = res.rows[0]?.id;
          if (!pId) {
            const existRes = await client.query<{ id: string }>(
              `SELECT id FROM businesses WHERE name = $1 LIMIT 1`,
              [p.name],
            );
            pId = existRes.rows[0]?.id;
          }
          if (pId) {
            const servRes = await client.query<{ id: string }>(
              `SELECT id FROM services WHERE business_id = $1 LIMIT 1`,
              [pId],
            );
            if (servRes.rows.length === 0) {
              await client.query(
                `
                INSERT INTO services (business_id, name, description, estimated_wait_time_mins, estimated_time_mins, max_queue_size, is_active)
                VALUES ($1, $2, $3, $4, $4, 50, true)
              `,
                [pId, p.service, p.desc, p.waitMins],
              );
            }
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
