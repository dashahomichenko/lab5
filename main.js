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

    if (!/^\d{3}$/.test(code)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Некоректний код стану в URL (очікується тризначне число)\n');
      return;
    }

    const filePath = path.join(cacheDir, `${code}.jpg`);

    if (req.method === 'GET') {
      try {
        const cachedImage = await fs.readFile(filePath);
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'X-Cache': 'HIT'
        });
        res.end(cachedImage);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
        try {
          const response = await superagent
            .get(`https://http.cat/${code}`)
            .responseType('blob');

          const imageBuffer = Buffer.from(response.body);
          await fs.writeFile(filePath, imageBuffer);

          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'X-Cache': 'MISS'
          });
          res.end(imageBuffer);
        } catch (fetchErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Картинку не знайдено ні в кеші, ні на http.cat\n');
        }
      }
    } else if (req.method === 'PUT') {
      const bodyBuffer = await getRequestBody(req);
      if (bodyBuffer.length === 0) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Тіло PUT-запиту порожнє\n');
        return;
      }
      await fs.writeFile(filePath, bodyBuffer);
      res.writeHead(201, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Картинку успішно збережено в кеш\n');
    } else if (req.method === 'DELETE') {
      try {
        await fs.unlink(filePath);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Картинку успішно видалено з кешу\n');
      } catch (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Картинку для видалення не знайдено в кеші\n');
        } else {
          throw err;
        }
      }
    } else {
      res.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Allow': 'GET, PUT, DELETE'
      });
      res.end(`Метод ${req.method} не дозволений\n`);
    }
  } catch (serverErr) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Внутрішня помилка сервера: ${serverErr.message}\n`);
  }
});

server.listen(port, options.host, () => {
  console.log(`Проксі-сервер запущено на http://${options.host}:${port}`);
  console.log(`Тека кешу: ${cacheDir}`);
});