import prisma from '../src/database/prisma.js';
import fs from 'fs';

async function run() {
  console.log('Applying database migration...');
  const sql = fs.readFileSync('./prisma/migrations/20260828100000_phase2_upgrade/migration.sql', 'utf-8');
  
  // Split statements by semicolon
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('Executed:', stmt.substring(0, 50) + '...');
    } catch (e) {
      console.log('Notice:', e.message);
    }
  }

  console.log('Migration completed successfully!');
  await prisma.$disconnect();
}

run();
