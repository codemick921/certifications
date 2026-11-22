#!/usr/bin/env node
/**
 * Zero-dependency static server for local preview.
 * Usage: npm run dev  (or: node scripts/dev.mjs --port 3000)
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = Number(portArg !== -1 ? args[portArg + 1] : process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

async function resolveTarget(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const safe = normalize(clean).replace(/^(\.\.[/\\])+/, '');
  let target = join(ROOT, safe);

  if (!target.startsWith(ROOT)) return { error: 403 };

  try {
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, 'index.html');
  } catch {
    // Not found as-is; fall through to try .html
  }

  try {
    const info = await stat(target);
    if (info.isFile()) return { file: target };
  } catch {
    try {
      const withHtml = `${target}.html`;
      const info = await stat(withHtml);
      if (info.isFile()) return { file: withHtml };
    } catch {
      return { error: 404 };
    }
  }
  return { error: 404 };
}

const server = createServer(async (req, res) => {
  const result = await resolveTarget(req.url || '/');

  if (result.error) {
    const notFound = join(ROOT, '404.html');
    try {
      const body = await readFile(notFound);
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      res.end('<h1>404</h1>');
    }
    return;
  }

  try {
    const body = await readFile(result.file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(result.file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Read error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Portfolio preview → http://127.0.0.1:${PORT}\n  Serving ${ROOT}\n  Ctrl+C to stop.\n`);
});
