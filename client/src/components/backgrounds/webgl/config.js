/**
 * Palette and composition tunables for the login background.
 *
 * Every measurement is expressed as a fraction of the *full* frame, with the
 * origin at the bottom-left (fx 0..1 left→right, fy 0..1 bottom→top). `stage`
 * converts those to world units at each element's depth, so nothing here has
 * to know about the camera or how wide the viewport currently is.
 */

export const COLORS = {
    // The page shell. Doubles as the renderer's clear colour, so any area the
    // scene does not cover still reads as intentional.
    base: 0x05070d,

    // Brand accent. Carries the planet rim, the skyline rim-light and the
    // upper half of every light beam.
    brandBlue: 0x3fa9f5,
    deepBlue: 0x1d4ed8,
    violet: 0x6d5bd0,

    // Warm accent. Deliberately confined to the root of the city beams so it
    // reads as city glow against the blue, never as a second theme colour.
    amber: 0xffb457,

    star: 0xffffff,
    starBlue: 0x9fc8ff,
};

/**
 * The camera sits at the origin looking down -Z. `depth` is the reference
 * plane screen-space measurements are taken at, so layout code can work in
 * "fraction of the visible frame" while the camera stays untouched.
 */
export const CAMERA = {
    fov: 45,
    near: 0.5,
    far: 4000,
    depth: 100,
};

/** Depth each element plane sits at. Back to front. */
export const DEPTHS = {
    nebula: -320,
    starFar: -460,
    starMid: -240,
    starNear: -90,
    planet: -150,
    skyline: -100,
    beams: -94,
};

export const STARFIELD = {
    // Three parallax layers: many tiny far stars, fewer larger near ones.
    // `size` is in device pixels (multiplied by the DPR uniform), so these
    // stay stable no matter how far away the layer sits.
    layers: [
        { count: 2400, size: [1.0, 1.7], parallax: 0.18, twinkle: 0.30, z: [-430, -270] },
        { count: 1400, size: [1.2, 2.2], parallax: 0.42, twinkle: 0.45, z: [-250, -140] },
        { count: 380, size: [1.6, 2.8], parallax: 0.85, twinkle: 0.60, z: [-130, -72] },
    ],
    // The hero copy and the sign-in form both live over the left and centre of
    // the frame, so stars there are thinned and dimmed rather than removed —
    // a hard-edged empty rectangle would read as a mistake.
    calmZone: { x: [0.06, 0.62], y: [0.16, 0.92], keep: 0.3, dim: 0.5 },
    /** How far the pointer can push the layers, in world units at their depth. */
    pointerTravel: 5.5,
};

export const PLANET = {
    /*
     * Placement is in frame fractions; `radius` is a fraction of the frame
     * *height*, never the width — a width-relative radius balloons on wide
     * monitors, which is exactly the bug that turned this planet into a
     * full-screen wash the first time round.
     *
     * Landscape: centre past the two-thirds mark so the disc is cropped by the
     * right edge, with the top of the sphere well inside the frame. The left
     * and centre then stay open for the copy and the form.
     */
    desktop: { fx: 0.95, fy: 1.08, radius: 0.15, spin: 0.014 },
    // Narrow viewports get a smaller planet pushed into the corner so it never
    // competes with the form.
    compact: { fx: 0.97, fy: 1.10, radius: 0.10, spin: 0.010 },
    segments: 96,
    /** Atmosphere shell, as a multiple of the planet radius. */
    atmosphereScale: 1.06,
    /**
     * Sun direction in planet-local space. The Z component is deliberately
     * negative: the camera looks down -Z, so a sun with +Z would light the
     * hemisphere facing us and render a flat bright disc. Pointing it slightly
     * away instead turns the visible face into the night side, which is where
     * the city lights live — so the planet reads as a dark body with a lit
     * limb and scattered lights, exactly like the reference mood.
     */
    lightDirection: [-0.88, -0.10, -0.42],
    /**
     * Overall surface gain. Most of the visible face is night side, so this can
     * sit high without the planet becoming a bright panel.
     */
    surfaceGain: 0.85,
    atmosphereIntensity: 0.4,
    cityIntensity: 1.4,
    /** Cloud cover, 0..1. Low, so the continents and city lights stay legible. */
    cloudAmount: 0.26,
};

export const SKYLINE = {
    /** Silhouette band height, as a fraction of the frame height. */
    heightFraction: 0.155,
    /** Tallest buildings, as a fraction of that band. */
    maxHeightFraction: 0.86,
    /** How many blocks to lay down per unit of frame width. */
    density: 0.34,
    minBuildings: 26,
    maxBuildings: 64,
    /** Depth of the silhouette, so it reads as mass and not as a cut-out. */
    depthRange: [1.4, 4.6],
    /** Window-grid scale, in cells per world unit. */
    windowScale: [3.4, 2.4],
    /** Fraction of the cells that are lit. */
    windowLit: 0.07,
    /** Rim light along each roofline, so the silhouette is not a black gap. */
    rimStrength: 0.85,
    /**
     * The left/centre of the frame carries the hero copy, so the lit parts of
     * the skyline there (windows and roof rims) are dimmed rather than removed.
     * The dark silhouette still spans the full width — a skyline that stopped
     * halfway would look broken — but nothing bright competes with the text.
     * `calmEndX` is the frame fraction where the city is back to full
     * brightness, reached over `calmRamp` of easing.
     */
    calmEndX: 0.64,
    calmRamp: 0.12,
    calmDim: 0.12,
};

export const BEAMS = {
    count: 6,
    /** Beam width as a fraction of the frame width. */
    width: [0.004, 0.014],
    /**
     * Beam height as a fraction of the frame height. Deliberately short: the
     * beams are a bottom-anchored city feature, not columns reaching into the
     * area the hero copy and the form occupy.
     */
    height: [0.18, 0.52],
    flickerSpeed: [0.16, 0.5],
    /**
     * Beams rise only from the right of the skyline, so the left and centre of
     * the frame — where the copy sits — carry no bright vertical streaks.
     */
    anchorZone: [0.56, 0.99],
};

export const NEBULA = {
    layers: [
        { fx: 0.70, fy: 0.80, size: [1.15, 0.72], color: 'brandBlue', opacity: 0.20, drift: 0.006, seed: 3.1 },
        { fx: 0.30, fy: 0.94, size: [0.95, 0.55], color: 'violet', opacity: 0.14, drift: 0.009, seed: 8.4 },
        { fx: 0.90, fy: 0.42, size: [0.70, 0.42], color: 'brandBlue', opacity: 0.10, drift: 0.013, seed: 15.9 },
    ],
    /** Kept low so the upper-left stays readable for the headline. */
    falloff: 2.4,
};

/** Bloom is deliberately subtle — just enough to bleed the bright cores. */
export const BLOOM = {
    strength: 0.58,
    radius: 0.6,
    threshold: 0.8,
};

/**
 * Below this width the scene switches to its compact composition: smaller
 * planet, shallower skyline, no beams. Not a different page — just a
 * treatment that keeps the form the loudest thing on screen.
 */
export const COMPACT_BREAKPOINT = 900;

export const MAX_PIXEL_RATIO = 2;
