import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import electron from 'electron';

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [resolve('scripts/verify-ui.cjs'), ...process.argv.slice(2)], { env: environment, windowsHide: true, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
