const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectDir, 'package.json'), { encoding: 'utf8' }),
);

const releaseDir = path.join(projectDir, 'release');
const appExe = path.join(releaseDir, 'folder_helper.exe');
const outputFile = path.join(releaseDir, 'folder_helper-setup.exe');
const installerScript = path.join(projectDir, 'installer', 'folder_helper.nsi');

if (!fs.existsSync(appExe)) {
  throw new Error(`Missing packaged helper executable: ${appExe}`);
}

if (!fs.existsSync(installerScript)) {
  throw new Error(`Missing NSIS installer script: ${installerScript}`);
}

const makensis = findMakensis();
const defineFlag = process.platform === 'win32' ? '/D' : '-D';

execFileSync(
  makensis,
  [
    `${defineFlag}APP_VERSION=${packageJson.version}`,
    `${defineFlag}APP_EXE=${appExe}`,
    `${defineFlag}OUTPUT_FILE=${outputFile}`,
    installerScript,
  ],
  {
    cwd: projectDir,
    stdio: 'inherit',
  },
);

console.log(`Created installer: ${outputFile}`);

function findMakensis() {
  for (const candidate of ['makensis', 'makensis.exe']) {
    try {
      execFileSync(candidate, ['-VERSION'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Try the next binary name.
    }
  }

  throw new Error(
    'NSIS is required to build the installer. Install makensis and re-run pnpm --filter folder_helper build:installer.',
  );
}
