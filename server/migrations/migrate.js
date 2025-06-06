import { readFileSync } from 'fs';
import { pool, testConnection } from '../config/database.js';
import { logger } from '../config/logger.js';

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Read and execute schema
    const schema = readFileSync('./server/migrations/schema.sql', 'utf8');
    const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      try {
        await pool.execute(statement);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();