const { Pool } = require('pg');
const argon2 = require('argon2');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  try {
    const passwordHash = await argon2.hash('Fabfleet@2025');
    const query = `
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = $2, role = $4;
    `;
    await pool.query(query, ['admin@fabfleet.com', passwordHash, 'Super Admin', 'SUPER_ADMIN']);
    console.log('Superadmin user created or updated successfully.');
  } catch (err) {
    console.error('Error seeding admin:', err);
  } finally {
    await pool.end();
  }
}

seed();
