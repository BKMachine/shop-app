# folder_helper

Windows helper for opening UNC part folders from the Shop App UI.

## What it does

The helper accepts either a raw UNC path or a custom protocol URL and launches `explorer.exe` with that folder.

Example target folder:

```text
\\loki\machine-files\Widgets\Widget Rev B
```

Example custom link for the UI:

```text
shop-folder://open?path=%5C%5Cloki%5Cmachine-files%5CWidgets%5CWidget%20Rev%20B
```

## Build

```bash
pnpm --filter folder_helper build
pnpm --filter folder_helper build:pkg
pnpm --filter folder_helper build:installer
```

The packaged executable is written to `apps/folder_helper/release/folder_helper.exe`.
The NSIS installer is written to `apps/folder_helper/release/folder_helper-setup.exe`.

`build:installer` performs the protocol registration as part of the Windows install process, and removes it again on uninstall.

## Installer requirements

`build:installer` requires NSIS and the `makensis` CLI to be installed on the machine that builds the installer.

## Register the protocol on Windows

```bash
pnpm --filter folder_helper protocol:install
```

If the executable is somewhere else:

```bash
node ./install_protocol.js C:\shop-app\folder_helper\folder_helper.exe
```

To remove the protocol registration:

```bash
pnpm --filter folder_helper protocol:uninstall
```

## Stage for server download

To copy the built helper into the server's static download folder:

```bash
pnpm --filter folder_helper stage:server
```

Or build the installer and stage everything in one step:

```bash
pnpm --filter folder_helper release:server
```

This stages files into `apps/server/public/downloads/folder_helper/`.
When the server is running, they are available from:

```text
/downloads/folder_helper/folder_helper-setup.exe
/downloads/folder_helper/folder_helper.exe
/downloads/folder_helper/latest.json
```

## UI usage

From the web app, generate the link with `encodeURIComponent` and navigate to it.

```ts
const uncPath = '\\\\loki\\machine-files\\Widgets\\Widget Rev B';
const href = `shop-folder://open?path=${encodeURIComponent(uncPath)}`;
window.location.href = href;
```