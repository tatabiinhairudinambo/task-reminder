// Copies the SPA .htaccess into the build output.
//
// This lives in a file instead of an inline `node -e` command because the
// arrow function used previously contained a `>` character, which Windows
// shells interpret as a redirection and made `pnpm build` exit non-zero.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public/.htaccess');
const target = resolve(root, 'dist/.htaccess');

if (!existsSync(source)) {
    console.warn(`[copy-htaccess] skipped: ${source} not found`);
    process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log('[copy-htaccess] dist/.htaccess written');
