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
clearDirectory(serverDownloadDir);

const stagedHelperExe = path.join(serverDownloadDir, 'folder_helper.exe');
fs.copyFileSync(helperExe, stagedHelperExe);

const manifest = {
  name: 'folder_helper',
  version: packageJson.version,
  protocol: 'shop-folder',
  files: {
    portable: '/downloads/folder_helper/folder_helper.exe',
    installer: null,
  },
};

if (fs.existsSync(installerExe)) {
  const stagedInstallerExe = path.join(serverDownloadDir, 'folder_helper-setup.exe');
  fs.copyFileSync(installerExe, stagedInstallerExe);
  manifest.files.installer = '/downloads/folder_helper/folder_helper-setup.exe';
}

fs.writeFileSync(path.join(serverDownloadDir, 'latest.json'), JSON.stringify(manifest, null, 2));

console.log(`Staged folder_helper release assets to ${serverDownloadDir}`);

function clearDirectory(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    fs.rmSync(path.join(dirPath, entry.name), { recursive: true, force: true });
  }
}
