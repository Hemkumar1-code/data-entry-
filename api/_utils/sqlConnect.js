import pg from 'pg';
const { Pool } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
    throw new Error(
        'POSTGRES_URL environment variable is missing. Please add it to your .env.local (local) or Vercel Environment Variables.'
    );
}

// Global cache to prevent exhaustive connections in serverless (dev mode mainly)
let pool;

if (!global.pgPool) {
    global.pgPool = new Pool({
        connectionString: POSTGRES_URL,
        ssl: POSTGRES_URL && POSTGRES_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
}
pool = global.pgPool;

export default pool;
