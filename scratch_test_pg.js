const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/smart_queue' });

async function run() {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM users WHERE role = $3', [20, 0, 'CUSTOMER']);
    console.log(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}
run();
