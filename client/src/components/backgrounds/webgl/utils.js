/** Small deterministic helpers shared by the scene modules. */

/**
 * mulberry32. The scene is random in appearance but seeded, so a reload gives
 * the same skyline and the same star layout instead of a fresh dice roll.
 */
export function createRng(seed = 0x9e3779b9) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent easing toward a target. */
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const rngBetween = (rng, [min, max]) => lerp(min, max, rng());

/** Randomised pick used for per-building and per-star variation. */
export const rngPick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
