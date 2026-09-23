/**
 * GLSL shared by the procedural materials.
 *
 * `NOISE_GLSL` is prepended to any fragment shader that needs it — all of the
 * scene's texture is generated from it, so there are no image assets to load.
 */

export const NOISE_GLSL = /* glsl */ `
    float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
        float sum = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
            sum += amplitude * valueNoise(p);
            p = p * 2.03 + vec2(17.1, 9.7);
            amplitude *= 0.5;
        }
        return sum;
    }
`;

/**
 * Per-vertex output every element's fragment stage can lean on: world-space
 * position and a view vector, so shaders can do fresnel / rim work without
 * each one re-deriving it.
 */
export const VIEW_VERTEX_GLSL = /* glsl */ `
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection;
    varying vec3 vNormalView;
`;
