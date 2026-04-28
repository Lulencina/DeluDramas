const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error conectando a Postgres:', err.stack);
  } else {
    console.log('✅ Conexión a Postgres exitosa (Hora del servidor:', res.rows[0].now, ')');
  }
});

module.exports = pool;