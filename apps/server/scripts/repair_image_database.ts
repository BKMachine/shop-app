import fs from 'node:fs/promises';
import path from 'node:path';
import { SERVER_DEVICE_ID } from '@repo/utilities/constants';
import { connect, disconnect } from '../src/database/index.js';
import CustomerService from '../src/database/lib/customer/customer_service.js';
import ImageService from '../src/database/lib/image/image_service.js';
import PartService from '../src/database/lib/part/part_service.js';
import SupplierService from '../src/database/lib/supplier/supplier_service.js';
import ToolService from '../src/database/lib/tool/tool_service.js';
import VendorService from '../src/database/lib/vendor/vendor_service.js';
import { imageDir } from '../src/directories.js';
import logger from '../src/logger.js';

const orphanedImageDir = path.join(imageDir, 'orphaned');

type EntityType = 'customer' | 'supplier' | 'tool' | 'vendor';

type RepairableEntity = {
  _id: string | { toString(): string };
  description?: string | null;
  img?: string | null;
  imageIds?: Array<string | { toString(): string }>;
  item?: string | null;
  logo?: string | null;
  name?: string | null;
  part?: string | null;
};

interface CliOptions {
  apply: boolean;
}

interface RepairStats {
  checked: number;
  cleared: number;
  emptyField: number;
  errors: number;
  found: number;
  invalidPath: number;
  missing: number;
  replaced: number;
  ambiguous: number;
}

interface PartRepairStats {
  checked: number;
  imageDocRepointed: number;
  imageIdsRebuilt: number;
  mainImageUpdated: number;
  missingFiles: number;
  orphanFiles: number;
  orphanFilesMoved: number;
  partsUpdated: number;
  skippedAmbiguousRepoint: number;
  errors: number;
}

interface EntityConfig<TDoc extends RepairableEntity> {
  type: EntityType;
  folderName: string;
  list: () => Promise<TDoc[]>;
  update: (doc: TDoc) => Promise<unknown>;
  getImageUrl: (doc: TDoc) => string;
  setImageUrl: (doc: TDoc, value: string) => void;
  describe: (doc: TDoc) => string;
}

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.tif',
  '.tiff',
  '.webp',
]);

const entityConfigs: EntityConfig<RepairableEntity>[] = [
  {
    type: 'tool',
    folderName: 'tools',
    list: () => ToolService.list() as Promise<RepairableEntity[]>,
    update: (doc) => ToolService.update(doc as ToolDoc, SERVER_DEVICE_ID),
    getImageUrl: (doc) => doc.img?.trim() ?? '',
    setImageUrl: (doc, value) => {
      doc.img = value;
    },
    describe: (doc) => doc.item?.trim() || doc.description?.trim() || getEntityId(doc),
  },
  {
    type: 'customer',
    folderName: 'customers',
    list: () => CustomerService.list() as Promise<RepairableEntity[]>,
    update: (doc) => CustomerService.update(doc as CustomerDoc, SERVER_DEVICE_ID),
    getImageUrl: (doc) => doc.logo?.trim() ?? '',
    setImageUrl: (doc, value) => {
      doc.logo = value;
    },
    describe: (doc) => doc.name?.trim() || getEntityId(doc),
  },
  {
    type: 'supplier',
    folderName: 'suppliers',
    list: () => SupplierService.list() as Promise<RepairableEntity[]>,
    update: (doc) => SupplierService.update(doc as SupplierDoc, SERVER_DEVICE_ID),
    getImageUrl: (doc) => doc.logo?.trim() ?? '',
    setImageUrl: (doc, value) => {
      doc.logo = value;
    },
    describe: (doc) => doc.name?.trim() || getEntityId(doc),
  },
  {
    type: 'vendor',
    folderName: 'vendors',
    list: () => VendorService.list() as Promise<RepairableEntity[]>,
    update: (doc) => VendorService.update(doc as VendorDoc, SERVER_DEVICE_ID),
    getImageUrl: (doc) => doc.logo?.trim() ?? '',
    setImageUrl: (doc, value) => {
      doc.logo = value;
    },
    describe: (doc) => doc.name?.trim() || getEntityId(doc),
  },
];

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  logger.info(`Starting image repair scan in ${imageDir} (${options.apply ? 'apply' : 'dry-run'})`);

  await connect();

  try {
    const singleStats = createEmptyStats();
    const partStats = createEmptyPartStats();

    for (const config of entityConfigs) {
      await repairEntityType(config, options, singleStats);
    }

    await repairPartImages(options, partStats);

    printSingleSummary(singleStats, options);
    printPartSummary(partStats, options);
  } finally {
    await disconnect();
  }
}

function parseArgs(args: string[]): CliOptions {
  let apply = false;

  for (const arg of args) {
    if (arg === '--apply') {
      apply = true;
      continue;
    }

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { apply };
}

function printHelp(): void {
  console.log(
    'Usage: pnpm repair:images [--apply]\n\nScans tool, customer, supplier, vendor, and part image data. By default it performs a dry run and only reports the changes it would make.',
  );
}

function createEmptyStats(): RepairStats {
  return {
    checked: 0,
    cleared: 0,
    emptyField: 0,
    errors: 0,
    found: 0,
    invalidPath: 0,
    missing: 0,
    replaced: 0,
    ambiguous: 0,
  };
}

function createEmptyPartStats(): PartRepairStats {
  return {
    checked: 0,
    imageDocRepointed: 0,
    imageIdsRebuilt: 0,
    mainImageUpdated: 0,
    missingFiles: 0,
    orphanFiles: 0,
    orphanFilesMoved: 0,
    partsUpdated: 0,
    skippedAmbiguousRepoint: 0,
    errors: 0,
  };
}

async function repairEntityType<TDoc extends RepairableEntity>(
  config: EntityConfig<TDoc>,
  options: CliOptions,
  stats: RepairStats,
): Promise<void> {
  const docs = await config.list();
  logger.info(`Scanning ${docs.length} ${config.type} records`);

  for (const doc of docs) {
    const entityId = getEntityId(doc);
    const label = `${config.type}:${config.describe(doc)} (${entityId})`;
    const storedImageUrl = config.getImageUrl(doc);

    if (!storedImageUrl) {
      stats.emptyField += 1;
      continue;
    }

    stats.checked += 1;
    const relPath = toImageRelativePath(storedImageUrl);

    if (!relPath) {
      stats.invalidPath += 1;
      logger.warn(`${label} has an unsupported image path: ${storedImageUrl}`);
      continue;
    }

    const currentFilePath = path.join(imageDir, relPath);
    if (await pathExists(currentFilePath)) {
      stats.found += 1;
      continue;
    }

    stats.missing += 1;
    const entityDir = path.join(imageDir, config.folderName, entityId);
    const replacement = await findSingleReplacementImage(entityDir);

    if (replacement === 'ambiguous') {
      stats.ambiguous += 1;
      logger.warn(
        `${label} is missing ${storedImageUrl} and has multiple replacement candidates in ${entityDir}`,
      );
      continue;
    }

    try {
      if (replacement) {
        const nextUrl = `/images/${replacement}`;
        await persistImageUrl(config, doc, nextUrl, options.apply);
        stats.replaced += 1;
        logRepairAction(options.apply, `${label} -> updated image to ${nextUrl}`);
        continue;
      }

      await persistImageUrl(config, doc, '', options.apply);
      stats.cleared += 1;
      logRepairAction(options.apply, `${label} -> cleared missing image ${storedImageUrl}`);
    } catch (error) {
      stats.errors += 1;
      logger.error(`${label} failed to update: ${getErrorMessage(error)}`);
    }
  }
}

async function persistImageUrl<TDoc extends RepairableEntity>(
  config: EntityConfig<TDoc>,
  doc: TDoc,
  nextUrl: string,
  apply: boolean,
): Promise<void> {
  config.setImageUrl(doc, nextUrl);
  if (!apply) return;
  await config.update(doc);
}

async function repairPartImages(options: CliOptions, stats: PartRepairStats): Promise<void> {
  const parts = await PartService.list();
  logger.info(`Scanning ${parts.length} part records`);

  for (const part of parts) {
    stats.checked += 1;

    const partId = getEntityId(part);
    const label = `part:${part.part?.trim() || part.description?.trim() || partId} (${partId})`;
    const partDir = path.join(imageDir, 'parts', partId);

    try {
      const attachedImages = await ImageService.listByEntity('part', partId);
      const folderImages = await listImageFiles(partDir);
      const partResult = await buildPartRepairPlan(
        part,
        attachedImages,
        folderImages,
        label,
        stats,
      );

      if (partResult.repointedImage) {
        stats.imageDocRepointed += 1;
        logRepairAction(
          options.apply,
          `${label} -> repointed image doc ${partResult.repointedImage.id} to /images/${partResult.repointedImage.relPath}`,
        );

        if (options.apply) {
          partResult.repointedImage.doc.relPath = partResult.repointedImage.relPath;
          await ImageService.update(partResult.repointedImage.doc, SERVER_DEVICE_ID);
        }
      }

      for (const orphanRelPath of partResult.orphanRelPathsToMove) {
        const destinationRelPath = buildOrphanedRelativePath(orphanRelPath);
        logRepairAction(
          options.apply,
          `${label} -> moved orphaned file /images/${orphanRelPath} to /images/${destinationRelPath}`,
        );

        if (options.apply) {
          await moveImageFile(orphanRelPath, destinationRelPath);
        }

        stats.orphanFilesMoved += 1;
      }

      let partChanged = false;

      if (partResult.imageIdsChanged) {
        stats.imageIdsRebuilt += 1;
        partChanged = true;
        logRepairAction(
          options.apply,
          `${label} -> rebuilt imageIds [${partResult.nextImageIds.join(', ')}]`,
        );
      }

      if (partResult.mainImageChanged) {
        stats.mainImageUpdated += 1;
        partChanged = true;
        logRepairAction(
          options.apply,
          `${label} -> updated main image to ${partResult.nextMainImageUrl || '<empty>'}`,
        );
      }

      if (partChanged) {
        stats.partsUpdated += 1;
        if (options.apply) {
          part.imageIds = partResult.nextImageIds;
          part.img = partResult.nextMainImageUrl;
          await PartService.update(part as PartDoc, SERVER_DEVICE_ID);
        }
      }
    } catch (error) {
      stats.errors += 1;
      logger.error(`${label} failed to repair: ${getErrorMessage(error)}`);
    }
  }
}

async function buildPartRepairPlan(
  part: RepairableEntity,
  attachedImages: ImageDoc[],
  folderImages: string[],
  label: string,
  stats: PartRepairStats,
): Promise<{
  imageIdsChanged: boolean;
  mainImageChanged: boolean;
  nextImageIds: string[];
  nextMainImageUrl: string;
  orphanRelPathsToMove: string[];
  repointedImage: { doc: ImageDoc; id: string; relPath: string } | null;
}> {
  const validImages: ImageDoc[] = [];
  const missingImages: ImageDoc[] = [];

  for (const image of attachedImages) {
    if (await pathExists(path.join(imageDir, image.relPath))) {
      validImages.push(image);
      continue;
    }

    missingImages.push(image);
  }

  stats.missingFiles += missingImages.length;

  const claimedRelPaths = new Set(validImages.map((image) => image.relPath));
  const orphanRelPaths = folderImages.filter((relPath) => !claimedRelPaths.has(relPath));
  stats.orphanFiles += orphanRelPaths.length;

  let repointedImage: { doc: ImageDoc; id: string; relPath: string } | null = null;
  let orphanRelPathsToMove: string[] = [];

  if (missingImages.length === 1 && orphanRelPaths.length === 1) {
    const image = missingImages[0];
    const relPath = orphanRelPaths[0];
    if (image && relPath) {
      image.relPath = relPath;
      validImages.push(image);
      repointedImage = { doc: image, id: image._id.toString(), relPath };
    }
  } else if (missingImages.length === 0) {
    orphanRelPathsToMove = orphanRelPaths;
  } else if (missingImages.length > 0 && orphanRelPaths.length > 0) {
    stats.skippedAmbiguousRepoint += 1;
    logger.warn(
      `${label} has ${missingImages.length} missing image docs and ${orphanRelPaths.length} unclaimed files; skipping relPath repair`,
    );
  }

  const validImageMap = new Map(validImages.map((image) => [image._id.toString(), image]));
  const currentImageIds = normalizeIdArray(part.imageIds);

  const nextImageIds = currentImageIds.filter((imageId) => validImageMap.has(imageId));
  const appendedImages = [...validImages].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );

  for (const image of appendedImages) {
    const imageId = image._id.toString();
    if (!nextImageIds.includes(imageId)) {
      nextImageIds.push(imageId);
    }
  }

  const currentMainRelPath = part.img ? toImageRelativePath(part.img) : null;
  const matchingMainImage = currentMainRelPath
    ? validImages.find((image) => image.relPath === currentMainRelPath) || null
    : null;
  const nextMainId = matchingMainImage?._id.toString() || nextImageIds[0] || '';

  if (nextMainId) {
    const remainingIds = nextImageIds.filter((imageId) => imageId !== nextMainId);
    nextImageIds.splice(0, nextImageIds.length, nextMainId, ...remainingIds);
  }

  const nextMainImage = nextMainId ? validImageMap.get(nextMainId) || null : null;
  const nextMainImageUrl = nextMainImage ? `/images/${nextMainImage.relPath}` : '';

  return {
    imageIdsChanged: !areStringArraysEqual(currentImageIds, nextImageIds),
    mainImageChanged: (part.img?.trim() ?? '') !== nextMainImageUrl,
    nextImageIds,
    nextMainImageUrl,
    orphanRelPathsToMove,
    repointedImage,
  };
}

async function findSingleReplacementImage(entityDir: string): Promise<string | null | 'ambiguous'> {
  const candidateRelPaths = await listImageFiles(entityDir);

  if (candidateRelPaths.length === 0) return null;
  if (candidateRelPaths.length > 1) return 'ambiguous';

  return candidateRelPaths[0] || null;
}

async function listImageFiles(entityDir: string): Promise<string[]> {
  let entries: { isFile: () => boolean; name: string }[];

  try {
    entries = await fs.readdir(entityDir, { withFileTypes: true, encoding: 'utf8' });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && isImageFilename(entry.name))
    .map((entry) => path.relative(imageDir, path.join(entityDir, entry.name)).replace(/\\/g, '/'))
    .sort((left, right) => left.localeCompare(right));
}

function buildOrphanedRelativePath(relPath: string): string {
  return path.join('orphaned', relPath).replace(/\\/g, '/');
}

async function moveImageFile(sourceRelPath: string, destinationRelPath: string): Promise<void> {
  const sourcePath = path.join(imageDir, sourceRelPath);
  const destinationPath = await buildUniqueDestinationPath(destinationRelPath);

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });

  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EXDEV') throw error;

    await fs.copyFile(sourcePath, destinationPath);
    await fs.unlink(sourcePath);
  }
}

async function buildUniqueDestinationPath(destinationRelPath: string): Promise<string> {
  const parsed = path.parse(destinationRelPath);
  let candidatePath = path.join(imageDir, destinationRelPath);
  let counter = 1;

  while (await pathExists(candidatePath)) {
    const fileName = `${parsed.name}-${counter}${parsed.ext}`;
    candidatePath = path.join(orphanedImageDir, parsed.dir.replace(/^orphaned\//, ''), fileName);
    counter += 1;
  }

  return candidatePath;
}

function isImageFilename(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function toImageRelativePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/images/')) {
    return trimmed.slice('/images/'.length);
  }

  if (trimmed.startsWith('images/')) {
    return trimmed.slice('images/'.length);
  }

  if (path.isAbsolute(trimmed)) {
    const relativePath = path.relative(imageDir, trimmed).replace(/\\/g, '/');
    if (!relativePath.startsWith('../') && relativePath !== '..') return relativePath;
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.startsWith('/images/')) {
      return decodeURIComponent(parsed.pathname.slice('/images/'.length));
    }
    return null;
  } catch {
    return trimmed.replace(/^\/+/, '');
  }
}

function getEntityId(doc: RepairableEntity): string {
  return typeof doc._id === 'string' ? doc._id : doc._id.toString();
}

function normalizeIdArray(values: Array<string | { toString(): string }> | undefined): string[] {
  if (!values?.length) return [];

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const id = typeof value === 'string' ? value : value.toString();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  return normalized;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function logRepairAction(apply: boolean, message: string): void {
  if (apply) {
    logger.info(message);
    return;
  }

  logger.info(`[dry-run] ${message}`);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function printSingleSummary(stats: RepairStats, options: CliOptions): void {
  logger.info(
    [
      `Single-image repair ${options.apply ? 'completed' : 'dry-run completed'}`,
      `checked=${stats.checked}`,
      `found=${stats.found}`,
      `missing=${stats.missing}`,
      `replaced=${stats.replaced}`,
      `cleared=${stats.cleared}`,
      `ambiguous=${stats.ambiguous}`,
      `invalidPath=${stats.invalidPath}`,
      `emptyField=${stats.emptyField}`,
      `errors=${stats.errors}`,
    ].join(' | '),
  );
}

function printPartSummary(stats: PartRepairStats, options: CliOptions): void {
  logger.info(
    [
      `Part-image repair ${options.apply ? 'completed' : 'dry-run completed'}`,
      `checked=${stats.checked}`,
      `partsUpdated=${stats.partsUpdated}`,
      `imageDocRepointed=${stats.imageDocRepointed}`,
      `imageIdsRebuilt=${stats.imageIdsRebuilt}`,
      `mainImageUpdated=${stats.mainImageUpdated}`,
      `missingFiles=${stats.missingFiles}`,
      `orphanFiles=${stats.orphanFiles}`,
      `orphanFilesMoved=${stats.orphanFilesMoved}`,
      `skippedAmbiguousRepoint=${stats.skippedAmbiguousRepoint}`,
      `errors=${stats.errors}`,
    ].join(' | '),
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'Unknown error';
}

main().catch((error) => {
  logger.error(`Image repair failed: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
