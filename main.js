import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { program } from 'commander';
import superagent from 'superagent';

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

try {
  await fs.mkdir(cacheDir, { recursive: true });
} catch (err) {
  console.error(`Помилка створення теки кешу: ${err.message}`);
  process.exit(1);
}

// Отримання двійкових даних з тіла запиту через проміс
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${options.host}:${port}`);
    const code = parsedUrl.pathname.slice(1);

    // Перевірка шляху: очікується тризначний HTTP-код
    if (!/^\d{3}$/.test(code)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Некоректний код стану в URL (очікується тризначне число)\n');
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Методи ще не реалізовано\n');
  } catch (serverErr) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Внутрішня помилка сервера: ${serverErr.message}\n`);
  }
});

server.listen(port, options.host, () => {
  console.log(`Проксі-сервер запущено на http://${options.host}:${port}`);
  console.log(`Тека кешу: ${cacheDir}`);
});