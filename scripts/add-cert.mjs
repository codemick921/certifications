#!/usr/bin/env node
/**
 * Add a certification to data/certs.json without hand-editing JSON.
 *
 *   npm run add-cert
 *   npm run add-cert -- --remove-placeholders
 *
 * Zero dependencies.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CERTS = resolve(ROOT, 'data/certs.json');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, fallback = '') => rl.question(fallback ? `${q} [${fallback}]: ` : `${q}: `).then(v => v.trim() || fallback);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  const raw = await readFile(CERTS, 'utf8');
  const data = JSON.parse(raw);

  if (process.argv.includes('--remove-placeholders')) {
    const before = data.certificates.length;
    data.certificates = data.certificates.filter(c => !c.placeholder);
    await writeFile(CERTS, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nRemoved ${before - data.certificates.length} placeholder entr${before - data.certificates.length === 1 ? 'y' : 'ies'}.`);
    rl.close();
    return;
  }

  console.log('\nNew certification\n-----------------');

  const issuer = await ask('Issuer (e.g. Canva, HubSpot Academy, Google Skillshop)');
  if (!issuer) { console.error('Issuer is required.'); rl.close(); process.exit(1); }

  const title = await ask('Certificate title');
  if (!title) { console.error('Title is required.'); rl.close(); process.exit(1); }

  const status = await ask('Status: completed | in-progress | planned', 'completed');
  const date = status === 'completed' ? await ask('Date completed (YYYY-MM)', monthNow()) : '';
  const category = await ask('Category (e.g. Analytics, Paid media, Design)', '');
  const verifyUrl = await ask('Verification URL (leave blank if none)', '');
  const credentialId = await ask('Credential ID (leave blank if none)', '');
  const skillsRaw = await ask('Skills, comma separated', '');

  console.log('\nEmbed options: none (typographic mark) | image | pdf | iframe');
  const embedType = await ask('Embed type', 'none');
  let embedSrc = '';
  if (embedType === 'image' || embedType === 'pdf') {
    embedSrc = await ask('Path from site root (e.g. /certs/my-cert.pdf)', '');
  } else if (embedType === 'iframe') {
    embedSrc = await ask('Embed URL from the issuer (e.g. Credly badge URL)', '');
  }

  const id = slug(`${issuer}-${title}`) + '-' + Math.random().toString(36).slice(2, 5);

  const entry = {
    id,
    title,
    issuer,
    ...(category ? { category } : {}),
    ...(date ? { date } : {}),
    status,
    credentialId,
    verifyUrl,
    embed: embedSrc ? { type: embedType, src: embedSrc } : { type: 'none' },
    skills: skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : []
  };

  const existing = data.certificates.findIndex(c => c.issuer === issuer && c.title === title);
  if (existing !== -1) {
    const replace = await ask('That title already exists for this issuer. Replace it? (y/n)', 'n');
    if (replace.toLowerCase() === 'y') data.certificates.splice(existing, 1);
  }

  data.certificates.unshift(entry);
  data.updated = new Date().toISOString().slice(0, 10);

  await writeFile(CERTS, JSON.stringify(data, null, 2) + '\n');
  rl.close();

  console.log(`\nAdded: ${title} — ${issuer}`);
  console.log(`Refresh http://127.0.0.1:4173 to see it.\n`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
