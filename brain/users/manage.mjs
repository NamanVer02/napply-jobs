#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, 'registry.yml');

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return { users: [] };
  }
  try {
    const doc = yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    if (doc && typeof doc === 'object' && Array.isArray(doc.users)) {
      return doc;
    }
  } catch (e) {
    console.error('Error reading registry.yml:', e.message);
  }
  return { users: [] };
}

function saveRegistry(registry) {
  try {
    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    fs.writeFileSync(REGISTRY_PATH, yaml.dump(registry, { lineWidth: 100, noRefs: true }), 'utf8');
  } catch (e) {
    console.error('Error writing registry.yml:', e.message);
    process.exit(1);
  }
}

function askPassword(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    if (!process.stdin.isTTY) {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    process.stdout.write(query);
    process.stdin.setRawMode(true);
    let password = '';

    const onKeypress = (char, key) => {
      if (key && key.name === 'return' || key && key.name === 'enter') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKeypress);
        process.stdout.write('\n');
        rl.close();
        resolve(password);
      } else if (key && key.name === 'backspace') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (key && key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKeypress);
        process.stdout.write('\n');
        rl.close();
        process.exit(1);
      } else if (char && char.length === 1 && char >= ' ' && char <= '~') {
        password += char;
        process.stdout.write('*');
      }
    };

    readline.emitKeypressEvents(process.stdin);
    process.stdin.on('keypress', onKeypress);
  });
}

async function handleAdd(username) {
  if (!username) {
    console.error('Error: Username required. Usage: node manage.mjs add <username>');
    process.exit(1);
  }
  const registry = loadRegistry();
  const exists = registry.users.some(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    console.error(`Error: User '${username}' already exists.`);
    process.exit(1);
  }

  const pwd1 = await askPassword('Enter password: ');
  if (!pwd1) {
    console.error('Error: Password cannot be empty.');
    process.exit(1);
  }
  const pwd2 = await askPassword('Confirm password: ');
  if (pwd1 !== pwd2) {
    console.error('Error: Passwords do not match.');
    process.exit(1);
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(pwd1, salt);

  registry.users.push({
    username: username,
    password_hash: hash
  });

  saveRegistry(registry);
  console.log(`Successfully added user '${username}'.`);
}

async function handleReset(username) {
  if (!username) {
    console.error('Error: Username required. Usage: node manage.mjs reset <username>');
    process.exit(1);
  }
  const registry = loadRegistry();
  const user = registry.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    console.error(`Error: User '${username}' not found.`);
    process.exit(1);
  }

  const pwd1 = await askPassword('Enter new password: ');
  if (!pwd1) {
    console.error('Error: Password cannot be empty.');
    process.exit(1);
  }
  const pwd2 = await askPassword('Confirm password: ');
  if (pwd1 !== pwd2) {
    console.error('Error: Passwords do not match.');
    process.exit(1);
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(pwd1, salt);
  user.password_hash = hash;

  saveRegistry(registry);
  console.log(`Successfully updated password for user '${username}'.`);
}

function handleDelete(username) {
  if (!username) {
    console.error('Error: Username required. Usage: node manage.mjs delete <username>');
    process.exit(1);
  }
  const registry = loadRegistry();
  const initialCount = registry.users.length;
  registry.users = registry.users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
  if (registry.users.length === initialCount) {
    console.error(`Error: User '${username}' not found.`);
    process.exit(1);
  }

  saveRegistry(registry);
  console.log(`Successfully deleted user '${username}'.`);
}

function handleList() {
  const registry = loadRegistry();
  if (registry.users.length === 0) {
    console.log('No users registered (auth is disabled).');
    return;
  }
  console.log('Registered users (auth is active):');
  for (const u of registry.users) {
    console.log(`- ${u.username}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];

  switch (command) {
    case 'add':
      await handleAdd(param);
      break;
    case 'reset':
      await handleReset(param);
      break;
    case 'delete':
      handleDelete(param);
      break;
    case 'list':
      handleList();
      break;
    default:
      console.log('career-ops User Management CLI');
      console.log('==============================');
      console.log('Usage:');
      console.log('  node manage.mjs add <username>     Create a new user');
      console.log('  node manage.mjs reset <username>   Reset a user\'s password');
      console.log('  node manage.mjs delete <username>  Delete a user');
      console.log('  node manage.mjs list               List all registered users');
      break;
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
