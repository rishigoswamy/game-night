#!/usr/bin/env node
// Build check (npm run check). There's nothing to compile, so "build" means everything a browser or the server loads is
// sound: every JS file parses, every file a page links exists, the offline cache lists every file, the party games are
// registered everywhere they must be, and the cache version was bumped when anything players load changed.
//   npm run check                    all checks on the files on disk
//   npm run check -- --base <commit> also: if public/ changed since <commit>, sw.js's VERSION must have changed too
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const B = require('./banner');

const ROOT = path.resolve(__dirname, '..');
const started = Date.now();
B.banner('BUILD', 'Build check', 'files parse, links, offline cache, games registered, cache version');
const PUBLIC = path.join(ROOT, 'public');
const problems = [];
const bad = msg => problems.push(msg);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); e.isDirectory() ? (e.name !== 'node_modules' && walk(p, out)) : out.push(p); } return out; };
const rel = p => path.relative(ROOT, p);

// 1. Every JavaScript file parses
const jsFiles = ['public', 'server', 'scripts', 'test'].flatMap(d => walk(path.join(ROOT, d))).filter(f => f.endsWith('.js'));
for (const f of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) bad(`${rel(f)} does not parse:\n${(r.stderr || '').trim().split('\n').slice(0, 5).join('\n')}`);
}

// 2. Every local file a page links (scripts, styles, icons, other pages) exists
const pages = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));
for (const page of pages) {
  const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(https?:|data:|mailto:|tel:|javascript:|#)/.test(url) || url.includes('${')) continue;
    const file = url.split(/[?#]/)[0];
    if (file && !fs.existsSync(path.join(PUBLIC, file))) bad(`public/${page} links ${url}, which does not exist`);
  }
}

// 3. The offline cache (sw.js) lists every file players load, and nothing that doesn't exist
const sw = read('public/sw.js');
const cached = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean));
const served = walk(PUBLIC).map(f => path.relative(PUBLIC, f)).filter(f => f !== 'sw.js' && !f.endsWith('.DS_Store'));
for (const f of served) if (!cached.has(f)) bad(`public/${f} is not in the offline cache list (public/sw.js FILES)`);
for (const f of cached) if (!fs.existsSync(path.join(PUBLIC, f))) bad(`public/sw.js caches ${f}, which does not exist`);

// 4. Every party game is registered everywhere (see docs/ARCHITECTURE.md, "Adding a game")
const games = fs.readdirSync(path.join(PUBLIC, 'games/party')).filter(f => f.endsWith('.js') && f !== 'common.js').map(f => f.slice(0, -3)).sort();
const idsIn = (file, re) => { const m = read(file).match(re); return m ? [...m[1].matchAll(/(\w+):/g)].map(x => x[1]).sort() : null; };
for (const page of ['public/party-table.html', 'public/party-remote.html']) {
  const ids = idsIn(page, /window\.PARTY_IDS = \{([^}]*)\}/);
  if (JSON.stringify(ids) !== JSON.stringify(games)) bad(`${page} PARTY_IDS lists ${ids}, but the party games are ${games}`);
}
const lb = idsIn('public/js/lib/leaderboard.js', /const PARTY = \{([^}]*)\}/);
if (JSON.stringify(lb) !== JSON.stringify(games)) bad(`public/js/lib/leaderboard.js PARTY lists ${lb}, but the party games are ${games}`);
for (const page of ['remote.js', 'table-remote.js', 'bj-remote.js']) {
  const m = read(`public/js/pages/${page}`).match(/\[([^\]]*)\]\.includes\(g\)/);
  const ids = m ? [...m[1].matchAll(/'(\w+)'/g)].map(x => x[1]).sort() : null;
  if (JSON.stringify(ids) !== JSON.stringify(games)) bad(`public/js/pages/${page} sends phones of ${ids} to the party page, but the party games are ${games}`);
}
const lobby = read('public/party.html');
for (const g of games) if (!lobby.includes(`party-table.html?g=${g}"`)) bad(`public/party.html has no card for the party game ${g}`);

// 5. The cache version changed whenever something in public/ changed (otherwise players keep the old offline copy)
const i = process.argv.indexOf('--base');
const base = i > 0 ? process.argv[i + 1] : '';
const git = (...a) => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' });
if (base && !/^0+$/.test(base)) {
  if (git('cat-file', '-e', `${base}^{commit}`).status !== 0) console.log(`(cache version check skipped: ${base} is not a commit here)`);
  else {
    const changed = git('diff', '--name-only', base, '--', 'public').stdout.trim().split('\n').filter(Boolean);
    const version = s => (s.match(/const VERSION = '([^']+)'/) || [])[1];
    const before = version(git('show', `${base}:public/sw.js`).stdout || ''), now = version(sw);
    if (changed.length && before === now) bad(`public/ changed since ${base.slice(0, 7)} (${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ', …' : ''}) but public/sw.js VERSION is still '${now}': bump it so players get the update`);
    else console.log(`cache version: ${changed.length ? `${before} → ${now}` : 'no changes in public/'}`);
  }
}

console.log(`build check: ${jsFiles.length} JS files, ${pages.length} pages, ${cached.size} cached files, ${games.length} party games (${games.join(', ')})`);
B.record('build', !problems.length, problems.length ? `${problems.length} problem${problems.length === 1 ? '' : 's'}` : `${jsFiles.length} files`, Date.now() - started);
if (problems.length) { B.fail(`Build check failed: ${problems.length} problem${problems.length === 1 ? '' : 's'}  (${B.secs(Date.now() - started)})`); console.error(`- ${problems.join('\n- ')}`); process.exit(1); }
B.ok(`Build check passed  (${B.secs(Date.now() - started)})`);
