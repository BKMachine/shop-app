const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(projectDir, '..', '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectDir, 'package.json'), { encoding: 'utf8' }),
);

const releaseDir = path.join(projectDir, 'release');
const serverDownloadDir = path.join(
  repoDir,
  'apps',
  'server',
  'public',
  'downloads',
  'folder_helper',
);

const helperExe = path.join(releaseDir, 'folder_helper.exe');
const installerExe = path.join(releaseDir, 'folder_helper-setup.exe');

if (!fs.existsSync(helperExe)) {
  throw new Error(`Missing packaged helper executable: ${helperExe}`);
}

fs.mkdirSync(serverDownloadDir, { recursive: true });

const stagedHelperExe = path.join(serverDownloadDir, 'folder_helper.exe');
let changed = copyIfChanged(helperExe, stagedHelperExe);

const manifest = {
  name: 'folder_helper',
  version: packageJson.version,
  protocol: 'shop-folder',
  files: {
    portable: '/downloads/folder_helper/folder_helper.exe',
    installer: null,
  },
};

const stagedInstallerExe = path.join(serverDownloadDir, 'folder_helper-setup.exe');
if (fs.existsSync(installerExe)) {
  changed = copyIfChanged(installerExe, stagedInstallerExe) || changed;
  manifest.files.installer = '/downloads/folder_helper/folder_helper-setup.exe';
} else if (fs.existsSync(stagedInstallerExe)) {
  fs.rmSync(stagedInstallerExe);
  changed = true;
}

changed =
  writeIfChanged(
    path.join(serverDownloadDir, 'latest.json'),
    JSON.stringify(manifest, null, 2),
  ) || changed;

console.log(
  changed
    ? `Staged folder_helper release assets to ${serverDownloadDir}`
    : `folder_helper release assets already up to date in ${serverDownloadDir}`,
);

// Skips the write (and the mtime bump) when the destination already has this
// exact content, so an unchanged exe doesn't bust the Docker build's COPY
// cache on every build:server run.
function copyIfChanged(sourcePath, destPath) {
  if (fs.existsSync(destPath) && fs.readFileSync(sourcePath).equals(fs.readFileSync(destPath))) {
    return false;
  }

  fs.copyFileSync(sourcePath, destPath);
  return true;
}

function writeIfChanged(destPath, content) {
  if (fs.existsSync(destPath) && fs.readFileSync(destPath, 'utf8') === content) {
    return false;
  }

  fs.writeFileSync(destPath, content);
  return true;
}
