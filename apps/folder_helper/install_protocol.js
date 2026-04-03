const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const PROTOCOL_NAME = 'shop-folder';
const defaultExecutable = path.resolve(__dirname, 'release', 'folder_helper.exe');
const executablePath = path.resolve(process.argv[2] || defaultExecutable);

if (process.platform !== 'win32') {
  throw new Error('Protocol registration is only supported on Windows.');
}

if (!existsSync(executablePath)) {
  throw new Error(`Helper executable not found: ${executablePath}`);
}

const registryKey = `HKCU\\Software\\Classes\\${PROTOCOL_NAME}`;

runRegAdd([registryKey, '/ve', '/d', 'URL:Shop Folder Protocol', '/f']);
runRegAdd([registryKey, '/v', 'URL Protocol', '/d', '', '/f']);
runRegAdd([`${registryKey}\\DefaultIcon`, '/ve', '/d', `${executablePath},0`, '/f']);
runRegAdd([`${registryKey}\\shell\\open\\command`, '/ve', '/d', `"${executablePath}" "%1"`, '/f']);

console.log(`Registered ${PROTOCOL_NAME}:// to ${executablePath}`);

function runRegAdd(args) {
  execFileSync('reg', ['add', ...args], { stdio: 'inherit' });
}
