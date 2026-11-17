import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { program } from 'commander';
import superagent from 'superagent';

// Звільняємо короткий прапорець -h для опції --host
program.helpOption('--help', 'Вивести довідку');

program
  .requiredOption('-h, --host <address>', 'адреса, на якій працює сервер')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до теки, у якій зберігаються кешовані картинки');

program.configureOutput({
  outputError: (str, write) => {
    write(`Помилка параметрів командного рядка: ${str}`);
  }
});

program.parse(process.argv);
const options = program.opts();

const port = Number(options.port);
if (Number.isNaN(port) || port < 1 || port > 65535) {
  console.error('Помилка: Порт має бути числом від 1 до 65535.');
  process.exit(1);
}

const cacheDir = path.resolve(options.cache);

// Створення теки кешу під час запуску, до початку приймання запитів
try {
  await fs.mkdir(cacheDir, { recursive: true });
} catch (err) {
  console.error(`Помилка створення теки кешу: ${err.message}`);
  process.exit(1);
}