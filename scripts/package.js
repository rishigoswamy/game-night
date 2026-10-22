#!/usr/bin/env node
// Package stage (npm run package): the release zip, then a smoke test of that zip.
// The zip holds what's needed to run Game Night (the game, the server, the starter, the docs), not the tests or CI files.
// The smoke test unpacks it somewhere new, installs its one package, starts the server and loads the main pages.
//   npm run package                  dist/game-night-dev-<commit>.zip
//   npm run package -- v1.2.0        dist/game-night-v1.2.0.zip (the pipeline passes the release tag)
//   npm run package -- v1.2.0 --no-smoke
// It packs the last commit (git archive), so commit first: uncommitted changes are not in the zip.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONTENTS = ['public', 'server', 'Start Game Night.command', 'scripts/serve.sh', 'package.json', 'package-lock.json', 'README.md', 'docs'];
const SMOKE_PORT = 8092;                         // a test port: never the real game night's 8080
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
const fail = msg => { console.error(`✗ package: ${msg}`); process.exit(1); };

const args = process.argv.slice(2);
const version = args.find(a => !a.startsWith('--')) || `dev-${git('rev-parse', '--short', 'HEAD').stdout.trim()}`;
if (!/^[\w.-]+$/.test(version)) fail(`"${version}" is not a usable version name (letters, digits, . _ - only)`);
if (git('status', '--porcelain', '--untracked-files=no').stdout.trim()) console.log('note: you have uncommitted changes; the zip has the last commit only');

// 1. The zip, straight from the last commit
const name = `game-night-${version}`, dist = path.join(ROOT, 'dist'), zip = path.join(dist, `${name}.zip`);
fs.mkdirSync(dist, { recursive: true });
const arch = git('archive', '--format=zip', `--prefix=${name}/`, '-o', zip, 'HEAD', '--', ...CONTENTS);
if (arch.status !== 0) fail(`git archive failed: ${arch.stderr.trim()}`);
const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
fs.writeFileSync(`${zip}.sha256`, `${sha}  ${name}.zip\n`);
const list = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
console.log(`${path.relative(ROOT, zip)}: ${list.filter(f => !f.endsWith('/')).length} files, ${(fs.statSync(zip).size / 1024).toFixed(0)} KB, sha256 ${sha.slice(0, 16)}…`);
const unwanted = list.filter(f => /\/(test|\.github|node_modules|coverage|dist)\//.test(f));
if (unwanted.length) fail(`the zip holds files that don't belong in a release: ${unwanted.slice(0, 3).join(', ')}`);
for (const must of ['public/index.html', 'server/server.js', 'Start Game Night.command', 'package-lock.json']) if (!list.includes(`${name}/${must}`)) fail(`the zip is missing ${must}`);

if (args.includes('--no-smoke')) { console.log('✓ packaged (smoke test skipped)'); process.exit(0); }

// 2. Smoke test: does the zip run on its own?
const get = p => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: SMOKE_PORT, path: p }, r => {
  let body = ''; r.on('data', d => { body += d; }); r.on('end', () => res({ status: r.statusCode, body }));
}).on('error', rej));
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gn-package-'));
  let server = null;
  try {
    if (spawnSync('unzip', ['-q', zip, '-d', tmp]).status !== 0) throw new Error('could not unzip it');
    const dir = path.join(tmp, name);
    const install = spawnSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' });
    if (install.status !== 0) throw new Error(`npm ci failed in the unpacked zip:\n${install.stderr.trim().split('\n').slice(-5).join('\n')}`);
    if (!(fs.statSync(path.join(dir, 'Start Game Night.command')).mode & 0o111)) throw new Error('"Start Game Night.command" lost its run permission');
    server = spawn(process.execPath, ['server/server.js', String(SMOKE_PORT)], { cwd: dir, env: { ...process.env, DC_LOOPBACK_ONLY: '1' }, stdio: 'ignore' });
    let up = false;
    for (let k = 0; k < 50 && !up; k++) { await new Promise(r => setTimeout(r, 200)); up = await get('/api/info').then(r => r.status === 200, () => false); }
    if (!up) throw new Error(`the server didn't start on port ${SMOKE_PORT}`);
    const checks = [['/', /Game Night/], ['/party.html', /Party/], ['/casino.html', /Casino/i], ['/games/party/tambola.js', /PARTY_GAME/], ['/sw.js', /gamenight-v\d+/]];
    for (const [p, expect] of checks) {
      const r = await get(p);
      if (r.status !== 200 || !expect.test(r.body)) throw new Error(`GET ${p} → ${r.status}${r.status === 200 ? ' (unexpected content)' : ''}`);
    }
    console.log(`smoke test: unpacked, installed, server started, ${checks.length} pages loaded (${checks.map(c => c[0]).join(' ')})`);
    console.log(`✓ packaged ${name}`);
  } catch (e) {
    process.exitCode = 1;
    console.error(`✗ package: smoke test: ${e.message}`);
  } finally {
    server?.kill();                              // clean up first, whatever happened
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})();
