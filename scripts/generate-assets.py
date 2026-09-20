"""Regenerate every logo/icon asset from a single master image.

Run:  python scripts/generate-assets.py <path-to-master.png>
      python scripts/generate-assets.py            (uses the repo default)

Produces:
  client/public/logo.webp            - sidebar + auth pages (transparent)
  client/public/favicon.ico          - multi-size browser favicon
  client/public/apple-touch-icon.png - iOS home screen
  client/public/icons/*              - PWA + Apple manifest icons
  client/public/icons/apple-splash-* - iOS launch screens
  server/public/favicon.ico          - API host favicon
"""

from __future__ import annotations

import glob
import os
import sys
from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT_PUBLIC = os.path.join(REPO, 'client', 'public')
ICONS = os.path.join(CLIENT_PUBLIC, 'icons')
SERVER_PUBLIC = os.path.join(REPO, 'server', 'public')

SPLASH_BG = (59, 130, 246)
TRANSPARENT = (255, 255, 255, 0)


def load_master(path: str) -> Image.Image:
    """Load the master PNG, trimmed to its visible pixels.

    `Image.getbbox()` treats any non-zero alpha as content, so a stray,
    near-transparent speck at the canvas edge would defeat the crop and leave
    the artwork off-centre. Threshold the alpha channel instead.
    """
    img = Image.open(path).convert('RGBA')
    alpha = img.getchannel('A').point(lambda value: 255 if value > 8 else 0)
    bbox = alpha.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img


def fit_square(master: Image.Image, size: int, fill_ratio: float) -> Image.Image:
    """Scale the master to occupy `fill_ratio` of a transparent square canvas."""
    inner = max(1, int(size * fill_ratio))
    scaled = master.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), TRANSPARENT)
    canvas.paste(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2), scaled)
    return canvas


def write_png(img: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, 'PNG', optimize=True)
    print('  %-52s %s' % (os.path.relpath(path, REPO), img.size))


def write_favicon_ico(master: Image.Image, path: str) -> None:
    """Multi-resolution .ico — Windows picks the best size per context."""
    sizes = [16, 24, 32, 48, 64]
    frames = [fit_square(master, s, 0.92) for s in sizes]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    frames[-1].save(path, format='ICO', sizes=[(s, s) for s in sizes], append_images=frames[:-1])
    print('  %-52s %s' % (os.path.relpath(path, REPO), [(s, s) for s in sizes]))


def write_splash(master: Image.Image, path: str, width: int, height: int) -> None:
    """Blue launch screen with the logo centred, matching the previous styling."""
    canvas = Image.new('RGB', (width, height), SPLASH_BG)
    # Keep the logo at ~75% of the screen width like the old artwork.
    target_w = int(width * 0.45)
    target_h = int(height * 0.30)
    scaled = master.copy()
    scaled.thumbnail((target_w, target_h), Image.LANCZOS)
    canvas.paste(scaled, ((width - scaled.width) // 2, (height - scaled.height) // 2), scaled)
    canvas.save(path, 'JPEG', quality=88, optimize=True)


def main() -> int:
    default_master = r'C:\Users\RND1\Downloads\logotask.png'
    master_path = sys.argv[1] if len(sys.argv) > 1 else default_master
    if not os.path.isfile(master_path):
        print('Master image not found:', master_path)
        return 1

    master = load_master(master_path)
    print('Master: %s (%dx%d)' % (master_path, master.width, master.height))
    print()

    # --- Web logo (transparent, used by the sidebar and auth pages) ---
    # Square canvas: the sidebar renders it with equal height and width
    # (`h-8 w-8`), so a non-square image would be stretched.
    print('Web logo:')
    logo = fit_square(master, 512, 0.98)
    logo.save(os.path.join(CLIENT_PUBLIC, 'logo.webp'), 'WEBP', quality=92, method=6)
    print('  %-52s %s' % ('client/public/logo.webp', logo.size))

    # --- Favicons ---
    print('Favicons:')
    write_favicon_ico(master, os.path.join(CLIENT_PUBLIC, 'favicon.ico'))
    write_favicon_ico(master, os.path.join(SERVER_PUBLIC, 'favicon.ico'))
    write_png(fit_square(master, 196, 0.92), os.path.join(ICONS, 'favicon-196.png'))

    # --- Touch / PWA icons ---
    print('Touch + PWA icons:')
    write_png(fit_square(master, 180, 0.88), os.path.join(CLIENT_PUBLIC, 'apple-touch-icon.png'))
    write_png(fit_square(master, 180, 0.88), os.path.join(ICONS, 'apple-icon-180.png'))
    write_png(fit_square(master, 192, 0.88), os.path.join(ICONS, 'icon-192x192.png'))
    write_png(fit_square(master, 512, 0.88), os.path.join(ICONS, 'icon-512x512.png'))
    # Maskable icons must keep their content inside the safe zone (80%).
    write_png(fit_square(master, 192, 0.72), os.path.join(ICONS, 'manifest-icon-192.maskable.png'))
    write_png(fit_square(master, 512, 0.72), os.path.join(ICONS, 'manifest-icon-512.maskable.png'))
    write_png(fit_square(master, 512, 0.72), os.path.join(ICONS, 'icon-maskable-512x512.png'))
    write_png(fit_square(master, 192, 0.88), os.path.join(ICONS, 'shortcut-dashboard.png'))

    # --- Apple splash screens ---
    print('Apple splash screens:')
    splashes = sorted(glob.glob(os.path.join(ICONS, 'apple-splash-*.jpg')))
    for splash_path in splashes:
        name = os.path.basename(splash_path)
        parsed = name.replace('.jpg', '').rsplit('-', 2)
        try:
            width, height = int(parsed[-2]), int(parsed[-1])
        except (ValueError, IndexError):
            print('  skipped (unparsable name):', name)
            continue
        write_splash(master, splash_path, width, height)
    print('  %d splash screen(s) regenerated' % len(splashes))

    print()
    print('Done.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
