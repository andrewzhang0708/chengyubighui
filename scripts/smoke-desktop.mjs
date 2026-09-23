import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const executable = resolve(process.argv[2] || 'desktop-release/ChengyuDahui-1.0.0-Windows-x64.exe');
mkdirSync('desktop-release', { recursive: true });
const report = resolve(`desktop-release/smoke-${Date.now()}.json`);
if (!existsSync(executable)) throw new Error(`Executable not found: ${executable}`);
const environment = { ...process.env, CHENGYU_SMOKE_REPORT: report };
// Editors built on Electron may export this; the game must run as an app.
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, ['--smoke-test'], {
  env: environment, windowsHide: true, stdio: 'ignore',
});
const timeout = setTimeout(() => {
  child.kill();
  console.error('Desktop smoke test timed out');
  process.exitCode = 1;
}, 60000);
child.on('error', error => { clearTimeout(timeout); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timeout);
  if (!existsSync(report)) { console.error(`Desktop exited without a report (exit ${code})`); process.exitCode = 1; return; }
  const result = JSON.parse(readFileSync(report, 'utf8'));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = code === 0 && result.ok ? 0 : 1;
});
