import { spawn } from 'node:child_process';

const PROTOCOL_NAME = 'shop-folder';
const HELP_TEXT = [
  'folder_helper',
  '',
  'Usage:',
  '  folder_helper "\\\\server\\share\\folder"',
  '  folder_helper "Z:\\shared\\folder"',
  `  folder_helper "${PROTOCOL_NAME}://open?path=%5C%5Cserver%5Cshare%5Cfolder"`,
  '',
  'Accepted inputs:',
  '  --path <folder path>',
  `  ${PROTOCOL_NAME}://open?path=<url-encoded folder path>`,
  `  ${PROTOCOL_NAME}://ping`,
  '  Raw UNC path starting with \\\\',
  '  Raw mapped drive path like Z:\\shared\\folder',
].join('\n');

type HelperCommand =
  | {
      action: 'open';
      folderPath: string;
    }
  | {
      action: 'ping';
    };

function main(argv: string[]): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    return 0;
  }

  const command = parseInput(argv);
  if (!command) {
    console.error('No supported folder path was provided.');
    console.error(HELP_TEXT);
    return 1;
  }

  if (command.action === 'ping') {
    return 0;
  }

  if (process.platform !== 'win32') {
    console.error('folder_helper only supports Windows at runtime.');
    return 1;
  }

  const child = spawn('explorer.exe', [command.folderPath], {
    detached: true,
    stdio: 'ignore',
  });

  child.on('error', (error) => {
    console.error(`Failed to launch explorer.exe: ${error.message}`);
    process.exitCode = 1;
  });

  child.unref();
  return 0;
}

function parseInput(argv: string[]): HelperCommand | null {
  const args = argv.slice(2).filter(Boolean);
  const [firstRawArg] = args;

  if (!firstRawArg) {
    return null;
  }

  if (firstRawArg === '--path') {
    const folderPath = normalizeFolderPath(args[1]);
    return folderPath ? { action: 'open', folderPath } : null;
  }

  const firstArg = stripWrappingQuotes(firstRawArg);
  if (firstArg.startsWith(`${PROTOCOL_NAME}://`) || firstArg.startsWith(`${PROTOCOL_NAME}:`)) {
    return parseProtocolUrl(firstArg);
  }

  const folderPath = normalizeFolderPath(firstArg);
  return folderPath ? { action: 'open', folderPath } : null;
}

function parseProtocolUrl(rawValue: string): HelperCommand | null {
  try {
    const url = new URL(rawValue);
    const action = [url.hostname, url.pathname.replace(/^\/+/, '')].find(Boolean);
    if (action === 'ping') {
      return { action: 'ping' };
    }

    if (action && action !== 'open') {
      return null;
    }

    const rawPath = url.searchParams.get('path');
    const folderPath = normalizeFolderPath(rawPath);
    return folderPath ? { action: 'open', folderPath } : null;
  } catch {
    return null;
  }
}

function normalizeFolderPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = stripWrappingQuotes(value.trim());
  const normalizedSlashes = trimmed.replaceAll('/', '\\');
  if (normalizedSlashes.startsWith('\\\\')) {
    return normalizedSlashes;
  }

  if (/^[A-Za-z]:\\/.test(normalizedSlashes)) {
    return normalizedSlashes;
  }

  return null;
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

process.exitCode = main(process.argv);
