import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool, PoolConfig } from 'pg';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const host = process.env.POSTGRES_HOST || 'localhost';
const isLocalHost =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  (connectionString &&
    (connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1')));

const sslEnabled =
  process.env.DB_SSL === 'true' ||
  process.env.POSTGRES_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && !isLocalHost) ||
  (!!connectionString && !isLocalHost);

let servername = host;
let finalConnectionString = connectionString;

if (connectionString) {
  try {
    const url = new URL(connectionString);
    servername = url.hostname;
    const pgUser = process.env.POSTGRES_USER;
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
    // ignore
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
      host,
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      database: process.env.POSTGRES_DB || 'smart_queue',
      ssl: sslConfig,
    };

const pool = new Pool(poolConfig);

async function seed() {
  console.log('Starting seed...');
  const client = await pool.connect();

  try {
    // 1. Hash a standard password for all test users
    const passwordHash = await argon2.hash('Test123');

    // 2. Insert Users
    console.log('Seeding Users...');
    const adminUser = await client.query(
      `
      INSERT INTO users (full_name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    `,
      [
        'Super Admin',
        'admin@test.com',
        '+10000000000',
        passwordHash,
        'SUPER_ADMIN',
      ],
    );

    const businessUser = await client.query(
      `
      INSERT INTO users (full_name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    `,
      [
        'Dr. Smith',
        'business@test.com',
        '+10000000001',
        passwordHash,
        'BUSINESS_OWNER',
      ],
    );

    const customerUser = await client.query(
      `
      INSERT INTO users (full_name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    `,
      [
        'Ajeet Kumarv Sah',
        'customer@test.com',
        '+10000000002',
        passwordHash,
        'CUSTOMER',
      ],
    );

    const ownerId = businessUser.rows[0].id;
    const customerId = customerUser.rows[0].id;

    // 3. Insert Business
    console.log('Seeding Business...');
    const business = await client.query(
      `
      INSERT INTO businesses (owner_id, name, description, address, phone, latitude, longitude, is_verified, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
      [
        ownerId,
        'Dr. Smith Clinic',
        'Top tier medical consulting.',
        '123 Health St.',
        '+10000000001',
        37.7749,
        -122.4194,
        true,
        true,
      ],
    );

    const businessId = business.rows[0].id;

    console.log('Seeding Parking Businesses for Nearby Search...');
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
      const res = await client.query(
        `
        INSERT INTO businesses (owner_id, name, description, address, phone, latitude, longitude, is_verified, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
        [
          ownerId,
          p.name,
          p.desc,
          p.address,
          '+10000000200',
          p.lat,
          p.lng,
          true,
          true,
        ],
      );
      const pId = res.rows[0].id;
      await client.query(
        `
        INSERT INTO services (business_id, name, description, estimated_wait_time_mins, max_queue_size, is_active)
        VALUES ($1, $2, $3, $4, 50, true)
      `,
        [pId, p.service, p.desc, p.waitMins],
      );
    }

    // 4. Insert Services
    console.log('Seeding Services...');
    const service1 = await client.query(
      `
      INSERT INTO services (business_id, name, description, estimated_wait_time_mins, max_queue_size, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [businessId, 'General Consultation', 'Walk-in checkup', 15, 50, true],
    );

    const service2 = await client.query(
      `
      INSERT INTO services (business_id, name, description, estimated_wait_time_mins, max_queue_size, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [businessId, 'Specialist Review', 'Detailed diagnosis', 30, 20, true],
    );

    const serviceId1 = service1.rows[0].id;

    // 5. Insert Queue (Customer joining)
    console.log('Seeding Queue...');
    await client.query(
      `
      INSERT INTO queues (user_id, service_id, token_number, position, status)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [customerId, serviceId1, 'T-0001', 1, 'WAITING'],
    );

    // Another dummy queue to show position
    const dummyUser = await client.query(
      `
      INSERT INTO users (full_name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id
    `,
      [
        'Jane Dummy',
        'dummy@test.com',
        '+10000000003',
        passwordHash,
        'CUSTOMER',
      ],
    );

    await client.query(
      `
      INSERT INTO queues (user_id, service_id, token_number, position, status)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [dummyUser.rows[0].id, serviceId1, 'T-0002', 2, 'WAITING'],
    );

    console.log('Seed completed successfully!');
    console.log('--- TEST ACCOUNTS ---');
    console.log('Admin: admin@test.com / Test123');
    console.log('Business: business@test.com / Test123');
    console.log('Customer: customer@test.com / Test123');
  } catch (error) {
    console.error('Error seeding DB:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
