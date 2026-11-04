// What the app weighs: big image, audio and video files, and packages known to be heavy.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles } from '../lib/files.mjs';
import { ConfigError } from '../lib/findings.mjs';
import { row } from './row.mjs';

const ASSET = /\.(png|jpe?g|gif|webp|heic|mp4|mov|m4v|mp3|wav|aac|ttf|otf)$/i;

/** Files over `maxAssetKb`. Looks at every size: the shared file walker skips files over 1 MB unless told otherwise. */
export function findLargeAssets(root, { assetRoots, ignore, maxAssetKb }) {
  if (!(maxAssetKb > 0)) throw new ConfigError('speed.maxAssetKb must be a number above 0.');
  return listFiles(root, assetRoots, { ignore, match: ASSET, maxBytes: Infinity })
    .map((file) => ({ file, kb: Math.round(statSync(join(root, file)).size / 1024) }))
    .filter(({ kb }) => kb > maxAssetKb)
    .map(({ file, kb }) =>
      row({
        file,
        where: file,
        what: `${kb} KB, over the ${maxAssetKb} KB limit. It adds its full size to the download, and an image takes memory for its pixels, not its file size.`,
        fix: 'Resize an image to the largest size it is shown at (twice that for sharp screens) and compress it; shorten or stream audio and video.',
      }),
    );
}

/** Packages in `dependencies` that `heavy` (name: reason) lists. */
export function findHeavy(root, heavy) {
  const file = 'package.json';
  if (!existsSync(join(root, file))) return [];
  let deps;
  try {
    deps = JSON.parse(readFileSync(join(root, file), 'utf8')).dependencies ?? {};
  } catch (e) {
    throw new ConfigError(`${file} is not valid JSON: ${e.message}`);
  }
  return Object.entries(heavy)
    .filter(([name]) => deps[name])
    .map(([name, why]) => row({ file, where: `${file}:${name}`, what: `${name} is a dependency. ${why}`, fix: `Replace ${name}, or import only the part you use. Check how much of it the app really calls.`, effort: 'medium' }));
}
