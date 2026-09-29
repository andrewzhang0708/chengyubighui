import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const cacheDirectory = resolve('work/idiom-sources');
const repositories = [
  { id: 'xinhua', repository: 'pwxcoo/chinese-xinhua', branch: 'master', path: 'data/idiom.json' },
  { id: 'phrases', repository: 'jaaack-wang/Chinese-fixed-phrases-idioms', branch: 'main', path: '成语及俗语词典.json' },
  { id: 'li1fan', repository: 'Li1Fan/chinese-idiom', branch: 'main', path: 'data/idiom.json' },
  { id: 'moe', repository: 'doggy8088/dict-idioms-2020', branch: 'main', path: 'dict_idioms_2020_20260324.json' },
  { id: 'by-syk', repository: 'by-syk/chinese-idiom-db', branch: 'master', path: 'chinese-idioms-12976.txt' },
  { id: 'xinhua-words', repository: 'pwxcoo/chinese-xinhua', branch: 'master', path: 'data/ci.json' },
  { id: 'moedict', repository: 'g0v/moedict-data', branch: 'main', path: 'dict-revised_bkup.json' },
];

async function request(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'ChengyuDahui-data-import' }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

await mkdir(cacheDirectory, { recursive: true });
const refresh = process.argv.includes('--refresh');
let manifest = {};
try { manifest = JSON.parse(await readFile(resolve(cacheDirectory, 'manifest.json'), 'utf8')); }
catch {
  try { manifest = JSON.parse(await readFile('data/idiom-sources.json', 'utf8')); }
  catch { /* First download: resolve source revisions once. */ }
}
const failures = [];
for (const source of repositories) {
  const extension = source.path.endsWith('.txt') ? 'txt' : 'json';
  const destination = resolve(cacheDirectory, `${source.id}.${extension}`);
  if (!refresh && manifest[source.id]) {
    try {
      const bytes = await readFile(destination);
      if (createHash('sha256').update(bytes).digest('hex') === manifest[source.id].sha256) {
        console.log(`${source.id}: using cached ${manifest[source.id].revision}`);
        continue;
      }
    } catch { /* Missing cache, download again. */ }
  }
  try {
    const revision = !refresh && manifest[source.id]?.revision ||
      (await (await request(`https://api.github.com/repos/${source.repository}/commits/${source.branch}`)).json()).sha;
    if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid repository revision');
    const url = `https://raw.githubusercontent.com/${source.repository}/${revision}/${source.path.split('/').map(encodeURIComponent).join('/')}`;
    const bytes = Buffer.from(await (await request(url)).arrayBuffer());
    if (extension === 'json') JSON.parse(bytes.toString('utf8'));
    await writeFile(destination, bytes);
    manifest[source.id] = { ...source, revision, url, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
    await writeFile(resolve(cacheDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`${source.id}: downloaded ${bytes.length} bytes at ${revision}`);
  } catch (error) {
    failures.push(source.id);
    console.error(`${source.id}: ${error.message}`);
  }
}
if (failures.length) process.exitCode = 1;
