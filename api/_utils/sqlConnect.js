import pg from 'pg';
const { Pool } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
    // We don't throw here to allow build to pass, but API calls will fail if missing
    console.warn('POSTGRES_URL is not defined');
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
