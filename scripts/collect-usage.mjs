// Node 编排：本地 python3 聚合 + 各远端 ssh 喂脚本聚合 => 合并写 usage.json。
// 远端不可达/无 python3 时打印警告并降级为只采本地，不中断。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeUsage } from './merge.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const aggScript = join(__dirname, 'aggregate-usage.py');
const machinesPath = join(__dirname, 'machines.json');
const usagePath = join(repoRoot, 'src', 'data', 'usage.json');
const MAX = 1024 * 1024 * 128;

function runLocal() {
  const out = execFileSync('python3', [aggScript], { encoding: 'utf8', maxBuffer: MAX });
  return JSON.parse(out);
}
function runRemote(host) {
  const script = readFileSync(aggScript, 'utf8');
  const out = execFileSync('ssh', [host, 'python3 -'], { input: script, encoding: 'utf8', maxBuffer: MAX });
  return JSON.parse(out);
}

const machines = JSON.parse(readFileSync(machinesPath, 'utf8'));
const perMachine = {};

try {
  perMachine[machines.local.id] = runLocal();
  console.log(`[ok] local ${machines.local.id}: ${Object.keys(perMachine[machines.local.id]).length} days`);
} catch (e) {
  console.warn(`[warn] 本地聚合失败: ${e.message}`);
}

for (const r of machines.remotes || []) {
  try {
    perMachine[r.id] = runRemote(r.ssh);
    console.log(`[ok] remote ${r.id} via ${r.ssh}: ${Object.keys(perMachine[r.id]).length} days`);
  } catch (e) {
    console.warn(`[warn] 远端 ${r.id} (${r.ssh}) 不可达，降级跳过: ${e.message}`);
  }
}

const existing = existsSync(usagePath)
  ? JSON.parse(readFileSync(usagePath, 'utf8'))
  : { meta: {}, byDay: {} };
const merged = mergeUsage(existing, perMachine, new Date().toISOString());
writeFileSync(usagePath, JSON.stringify(merged, null, 2) + '\n');
console.log(`[done] 写入 ${usagePath}，共 ${Object.keys(merged.byDay).length} 天`);
