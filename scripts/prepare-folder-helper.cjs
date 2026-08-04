const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoDir = path.resolve(__dirname, '..');
const helperProjectDir = path.join(repoDir, 'apps', 'folder_helper');
const releaseDir = path.join(helperProjectDir, 'release');
const helperExe = path.join(releaseDir, 'folder_helper.exe');
const stagedDownloadDir = path.join(
  repoDir,
  'apps',
  'server',
  'public',
  'downloads',
  'folder_helper',
);

if (!fs.existsSync(helperExe)) {
  console.log(`Missing local folder_helper exe. Building it once at ${helperExe}`);
  execFileSync('pnpm', ['--filter', 'folder_helper', 'run', 'build:pkg'], {
    cwd: repoDir,
    stdio: 'inherit',
  });
}

execFileSync('node', [path.join(helperProjectDir, 'scripts', 'stage_release.cjs')], {
  cwd: helperProjectDir,
  stdio: 'inherit',
});

console.log(`Prepared folder_helper assets in ${stagedDownloadDir}`);
