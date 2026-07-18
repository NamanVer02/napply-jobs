#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const username = argv.filter(a => !a.startsWith('-'))[0];

if (!username) {
  console.error('Error: Username required. Usage: node users/migrate.mjs <username> [--dry-run]');
  process.exit(1);
}

const userDir = path.join(repoRoot, 'users', username);

// Define user-layer files and directories to move (source relative to repoRoot, destination relative to userDir)
const pathsToMove = [
  'cv.md',
  'config/profile.yml',
  'config/cv-facts.json',
  'portals.yml',
  'config/portals.yml',
  'data',
  'reports',
  'output',
  'jds',
  'modes/_profile.md',
  'modes/_custom.md',
  'voice-dna.md',
  'article-digest.md',
  'interview-prep',
  'writing-samples',
  '.env',
  '.career-ops-web'
];

console.log(`Starting migration to user '${username}'...`);
if (dryRun) console.log('=== DRY RUN MODE (No files will be moved) ===');

let movedCount = 0;
let skippedCount = 0;

for (const relPath of pathsToMove) {
  const src = path.join(repoRoot, relPath);
  const dst = path.join(userDir, relPath);

  if (!fs.existsSync(src)) {
    console.log(`- Skipping ${relPath} (does not exist in repo root)`);
    skippedCount++;
    continue;
  }

  // Handle files that are git-tracked and we shouldn't delete/move or folders with specific files.
  // For writing-samples: if it's the directory, let's move everything inside it or the whole directory.
  // We can just move the whole directory or file.
  console.log(`- Moving ${relPath} -> users/${username}/${relPath}`);
  
  if (!dryRun) {
    // Ensure destination parent directory exists
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    
    // If destination already exists, delete it first to avoid collision
    if (fs.existsSync(dst)) {
      fs.rmSync(dst, { recursive: true, force: true });
    }
    
    fs.renameSync(src, dst);
  }
  movedCount++;
}

console.log('\nMigration Summary:');
console.log(`- Moved: ${movedCount} items`);
console.log(`- Skipped: ${skippedCount} items`);

if (!dryRun) {
  console.log(`\nSuccessfully migrated files to users/${username}/`);
  console.log('You can now log in using the web interface.');
}
