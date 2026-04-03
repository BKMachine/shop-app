const { execFileSync } = require('node:child_process');

const PROTOCOL_NAME = 'shop-folder';

if (process.platform !== 'win32') {
  throw new Error('Protocol registration is only supported on Windows.');
}

execFileSync('reg', ['delete', `HKCU\\Software\\Classes\\${PROTOCOL_NAME}`, '/f'], {
  stdio: 'inherit',
});

console.log(`Removed ${PROTOCOL_NAME}:// protocol registration.`);
