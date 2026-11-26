// Stages the Shop App Android APK for the web app's Settings > Downloads panel,
// like prepare-folder-helper.cjs does for the Windows helper.
//
//   pnpm prepare:android_app   copy the latest release APK (run by build:server)
//   pnpm build:android_app     build the release APK with Gradle first, then copy it
//
// The Android project lives on Windows (SHOP_APP_ANDROID_DIR, default
// /mnt/c/Applications/Coding/shop-app-android). From WSL the Gradle build runs
// through cmd.exe with Android Studio's bundled JDK (ANDROID_JAVA_HOME to override).

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoDir = path.resolve(__dirname, '..');
const androidDir =
  process.env.SHOP_APP_ANDROID_DIR || '/mnt/c/Applications/Coding/shop-app-android';
const releaseDir = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
const stagedDownloadDir = path.join(
  repoDir,
  'apps',
  'server',
  'public',
  'downloads',
  'android_app',
);
const stagedApkName = 'shop-app.apk';
const shouldBuild = process.argv.includes('--build');
// JDK for Gradle and apksigner; from WSL, Android Studio's bundled one on Windows.
const javaHome = process.env.ANDROID_JAVA_HOME || '/mnt/c/Program Files/Android/Android Studio/jbr';

// Without keystore.properties Gradle signs with the PC's debug key, and phones with
// the release-signed app refuse that APK as an update, so don't publish it.
if (!fs.existsSync(path.join(androidDir, 'keystore.properties'))) {
  skip(
    `No keystore.properties in ${androidDir}, so the APK would be signed with the debug key. See keystore.properties.example there.`,
  );
}

if (shouldBuild) {
  buildReleaseApk();
}

const metadataPath = path.join(releaseDir, 'output-metadata.json');
if (!fs.existsSync(metadataPath)) {
  skip(`No Android release build found in ${releaseDir}. Run "pnpm build:android_app" first.`);
}

const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
const output = metadata.elements?.find((element) => element.type === 'SINGLE');
if (!output?.outputFile) {
  skip(`Could not find the APK in ${metadataPath}.`);
}
if (output.outputFile.includes('unsigned')) {
  skip(
    `${output.outputFile} is unsigned, so phones can't install it. Check the release signingConfig in app/build.gradle.kts.`,
  );
}

const apkPath = path.join(releaseDir, output.outputFile);
if (!fs.existsSync(apkPath)) {
  skip(`Missing APK: ${apkPath}`);
}

// keystore.properties existing doesn't prove this APK was built with it (it may be
// an older build), so check the certificate actually in the APK.
const signer = readApkSigner(apkPath);
if (signer === null) {
  console.warn('Could not check the APK signature (apksigner not found); staging it anyway.');
} else if (/CN=Android Debug/.test(signer)) {
  skip(
    `${output.outputFile} is signed with the debug key (${signer}). Rebuild it with "pnpm build:android_app" once keystore.properties is filled in.`,
  );
} else {
  console.log(`APK signed by: ${signer}`);
}

fs.mkdirSync(stagedDownloadDir, { recursive: true });

let changed = copyIfChanged(apkPath, path.join(stagedDownloadDir, stagedApkName));

const manifest = {
  name: 'android_app',
  applicationId: metadata.applicationId,
  version: output.versionName,
  versionCode: output.versionCode,
  minSdk: metadata.minSdkVersionForDexing ?? null,
  builtAt: fs.statSync(apkPath).mtime.toISOString(),
  files: {
    apk: `/downloads/android_app/${stagedApkName}`,
  },
};

changed =
  writeIfChanged(path.join(stagedDownloadDir, 'latest.json'), JSON.stringify(manifest, null, 2)) ||
  changed;

console.log(
  changed
    ? `Staged Shop App ${manifest.version} (${manifest.versionCode}) to ${stagedDownloadDir}`
    : `Shop App ${manifest.version} already staged in ${stagedDownloadDir}`,
);

function buildReleaseApk() {
  if (!fs.existsSync(path.join(androidDir, 'gradlew'))) {
    throw new Error(`No Android project at ${androidDir}. Set SHOP_APP_ANDROID_DIR.`);
  }

  console.log(`Building the Android release APK in ${androidDir}`);

  if (process.env.WSL_DISTRO_NAME) {
    // Windows Gradle via cmd.exe; WSLENV hands JAVA_HOME over as a Windows path.
    // cmd.exe doesn't reliably start in the Linux cwd, so pass full Windows paths
    // and point Gradle at the project with -p.
    const windowsDir = execFileSync('wslpath', ['-w', androidDir], { encoding: 'utf8' }).trim();
    execFileSync(
      'cmd.exe',
      ['/c', `${windowsDir}\\gradlew.bat`, '-p', windowsDir, 'assembleRelease'],
      {
        cwd: androidDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          JAVA_HOME: javaHome,
          WSLENV: [process.env.WSLENV, 'JAVA_HOME/p'].filter(Boolean).join(':'),
        },
      },
    );
    return;
  }

  execFileSync('./gradlew', ['assembleRelease'], { cwd: androidDir, stdio: 'inherit' });
}

/**
 * Returns the APK's first signer certificate DN using the SDK's apksigner (SDK path
 * from the project's local.properties), or null when the tools can't be found.
 */
function readApkSigner(apk) {
  try {
    const localProperties = fs.readFileSync(path.join(androidDir, 'local.properties'), 'utf8');
    const sdkLine = localProperties.split(/\r?\n/).find((line) => line.startsWith('sdk.dir='));
    if (!sdkLine) return null;

    const isWsl = Boolean(process.env.WSL_DISTRO_NAME);
    const sdkDirRaw = sdkLine.slice('sdk.dir='.length).replace(/\\:/g, ':').replace(/\\\\/g, '\\');
    const sdkDir = isWsl
      ? execFileSync('wslpath', ['-u', sdkDirRaw], { encoding: 'utf8' }).trim()
      : sdkDirRaw;

    const buildToolsDir = path.join(sdkDir, 'build-tools');
    const apksignerJar = fs
      .readdirSync(buildToolsDir)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .reverse()
      .map((version) => path.join(buildToolsDir, version, 'lib', 'apksigner.jar'))
      .find((jar) => fs.existsSync(jar));
    if (!apksignerJar) return null;

    const toWindows = (file) =>
      isWsl ? execFileSync('wslpath', ['-w', file], { encoding: 'utf8' }).trim() : file;
    const java = isWsl ? path.join(javaHome, 'bin', 'java.exe') : 'java';

    const out = execFileSync(
      java,
      ['-jar', toWindows(apksignerJar), 'verify', '--print-certs', toWindows(apk)],
      // stderr only carries JDK native-access warnings from apksigner's crypto library.
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out.match(/Signer #1 certificate DN: (.+)/)?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

// A missing build only skips staging, so build:server still works on a machine
// without the Android project; any APK staged earlier stays in place.
function skip(message) {
  if (shouldBuild) throw new Error(message);
  console.warn(`Skipping Android app staging: ${message}`);
  process.exit(0);
}

// Skips the write (and the mtime bump) when the destination already has this
// exact content, so an unchanged APK doesn't bust the Docker build's COPY cache.
function copyIfChanged(sourcePath, destPath) {
  if (fs.existsSync(destPath) && fs.readFileSync(sourcePath).equals(fs.readFileSync(destPath))) {
    return false;
  }

  fs.copyFileSync(sourcePath, destPath);
  // Files copied off the Windows drive arrive as 777.
  fs.chmodSync(destPath, 0o644);
  return true;
}

function writeIfChanged(destPath, content) {
  if (fs.existsSync(destPath) && fs.readFileSync(destPath, 'utf8') === content) {
    return false;
  }

  fs.writeFileSync(destPath, content);
  return true;
}
