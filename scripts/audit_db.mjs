// Audit script: inspect SQLite DB schema without destructive actions
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', 'dev.db');

console.log('DB Path:', dbPath, '- exists:', fs.existsSync(dbPath));

const db = new Database(dbPath, { readonly: true });

console.log('=== Part table columns ===');
for (const col of db.pragma('table_info("Part")')) {
  console.log(`  ${col.name} ${col.type} pk=${col.pk} notnull=${col.notnull} dflt=${col.dflt_value}`);
}

console.log('\n=== User table columns ===');
for (const col of db.pragma('table_info("User")')) {
  console.log(`  ${col.name} ${col.type} pk=${col.pk} notnull=${col.notnull} dflt=${col.dflt_value}`);
}

console.log('\n=== Part table indexes ===');
for (const idx of db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='Part'").all()) {
  console.log(`  ${idx.name}: ${idx.sql}`);
}

console.log('\n=== User table indexes ===');
for (const idx of db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='User'").all()) {
  console.log(`  ${idx.name}: ${idx.sql}`);
}

console.log('\n=== _prisma_migrations (applied migrations) ===');
const migs = db.prepare('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY finished_at').all();
for (const m of migs) {
  console.log(`  ${m.migration_name}  finished=${m.finished_at}  rolledBack=${m.rolled_back_at}`);
}

// Count rows (no sensitive data)
console.log('\n=== Row counts ===');
for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").all()) {
  const { cnt } = db.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).get();
  console.log(`  ${name}: ${cnt} rows`);
}

// Check if barcodeValue unique constraint exists
const barcodeIdx = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='Part' AND sql LIKE '%barcodeValue%'").all();
console.log('\n=== barcodeValue unique constraint ===');
if (barcodeIdx.length === 0) {
  console.log('  NOT FOUND — missing unique index for barcodeValue');
} else {
  for (const idx of barcodeIdx) {
    console.log(`  ${idx.name}: ${idx.sql}`);
  }
}

// Check if mustChangePassword column exists
const mustChgCol = db.prepare("SELECT name FROM pragma_table_info('User') WHERE name='mustChangePassword'").all();
console.log('\n=== User.mustChangePassword column ===');
console.log(mustChgCol.length > 0 ? '  EXISTS' : '  NOT FOUND');

// Check if isActive column exists
const isActiveCol = db.prepare("SELECT name FROM pragma_table_info('User') WHERE name='isActive'").all();
console.log('\n=== User.isActive column ===');
console.log(isActiveCol.length > 0 ? '  EXISTS' : '  NOT FOUND');

db.close();
console.log('\nDone.');
