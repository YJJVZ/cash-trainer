#!/usr/bin/env node
// Range pack tooling. Runs the app's own TypeScript validators through Vite (no extra dependency).
//   npm run ranges -- check <pack.json>
//   npm run ranges -- merge <pack.json> <spotId>=<file.csv> [...] --out <new.json>
//   npm run ranges -- diff <old.json> <new.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const [cmd, ...args] = process.argv.slice(2);
const usage = () => {
  console.log('Usage:\n  npm run ranges -- check <pack.json>\n  npm run ranges -- merge <pack.json> <spotId>=<file.csv> [...] --out <new.json>\n  npm run ranges -- diff <old.json> <new.json>');
  process.exit(2);
};
if (!cmd) usage();

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const server = await createServer({ configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
let code = 0;
try {
  const tools = await server.ssrLoadModule('/src/ranges/packTools.ts');
  if (cmd === 'check') {
    if (!args[0]) usage();
    const r = tools.formatCheck(readJson(args[0]));
    console.log(r.text);
    code = r.ok ? 0 : 1;
  } else if (cmd === 'merge') {
    const outIdx = args.indexOf('--out');
    const out = outIdx >= 0 ? args[outIdx + 1] : null;
    const [packPath, ...pairs] = args.filter((_, i) => i !== outIdx && i !== outIdx + 1);
    if (!packPath || !out || pairs.length === 0) usage();
    const tables = Object.fromEntries(pairs.map((p) => {
      const [id, file] = p.split('=');
      return [id, readFileSync(file, 'utf8')];
    }));
    const { pack, errors } = tools.mergeCsvIntoPack(readJson(packPath), tables);
    for (const e of errors) console.log(`ERROR   ${e.path}: ${e.message}`);
    if (errors.length) code = 1;
    else {
      writeFileSync(out, JSON.stringify(pack, null, 2) + '\n');
      console.log(`Wrote ${out}\n`);
      const r = tools.formatCheck(pack);
      console.log(r.text);
      code = r.ok ? 0 : 1;
    }
  } else if (cmd === 'diff') {
    if (args.length < 2) usage();
    const changes = tools.diffPacks(readJson(args[0]), readJson(args[1]));
    for (const c of changes) console.log(`${c.spotId} ${c.hand}: ${c.before} → ${c.after}`);
    console.log(`${changes.length} hand(s) changed`);
  } else usage();
} finally {
  await server.close();
}
process.exit(code);
