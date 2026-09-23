/**
 * Starfield — three parallax layers of THREE.Points.
 *
 * Stars are placed across a band wider and taller than the frame so pointer
 * parallax never exposes an edge, and the layers drift slowly on their own so
 * the sky is alive even with the cursor still.
 */

import * as THREE from 'three';
import { COLORS, DEPTHS, STARFIELD } from './config.js';
import { createRng, rngBetween } from './utils.js';

const VERTEX = /* glsl */ `
    uniform float uTime;
    uniform float uSize;
    uniform float uDpr;
    uniform float uTwinkle;
    uniform float uOpacity;

    attribute float aSize;
    attribute float aPhase;
    attribute float aSpeed;
    attribute vec3 aColor;

    varying vec3 vColor;
    varying float vTwinkle;

    void main() {
        vColor = aColor;

        // Slow per-star breathing. The phase offset keeps the field from
        // pulsing in unison, which would read as a flicker of the whole sky.
        float twinkle = 0.72 + 0.28 * sin(uTime * aSpeed + aPhase);
        vTwinkle = mix(1.0, twinkle, uTwinkle);

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Size is deliberately NOT perspective-attenuated. The layers span a
        // huge depth range (z -430 to -72), so inverse-depth falloff would make
        // the far layer sub-pixel and the near layer huge blobs. Each layer's
        // own size range already encodes how near it is, which is easier to
        // tune and stable at any resolution.
        gl_PointSize = uSize * aSize * uDpr;
    }
`;

const FRAGMENT = /* glsl */ `
    uniform float uOpacity;

    varying vec3 vColor;
    varying float vTwinkle;

    void main() {
        // Round the square point sprite off, with a tight core and a small
        // halo. The core has to stay near-solid: a purely smooth falloff makes
        // a 1-2px star effectively invisible.
        vec2 offset = gl_PointCoord - vec2(0.5);
        float distance = length(offset);
        if (distance > 0.5) discard;

        float core = smoothstep(0.5, 0.16, distance);
        float alpha = core * vTwinkle * uOpacity;

        gl_FragColor = vec4(vColor, alpha);
    }
`;

function buildLayer(stage, layer, rng) {
    const { count, size, z } = layer;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);

    // Overscan so parallax shifts and aspect changes do not reveal a boundary.
    const overscan = 1.35;

    const white = new THREE.Color(COLORS.star);
    const blue = new THREE.Color(COLORS.starBlue);
    const tint = new THREE.Color();

    const zone = STARFIELD.calmZone;
    const [zoneMinX, zoneMaxX] = zone.x;
    const [zoneMinY, zoneMaxY] = zone.y;

    // Stars are generated as frame fractions and converted to world positions
    // by `project()`. Storing the fractions — not the world positions — is what
    // lets `layout()` re-span the field when the frame aspect changes: a field
    // projected once at the creation aspect would leave the left and right
    // edges empty on a wide monitor.
    const layoutData = new Float32Array(count * 3);

    let written = 0;
    for (let i = 0; i < count; i += 1) {
        const fx = rng();
        const fy = rng();

        // Thin the field over the copy/form area rather than clearing it. A
        // hard-edged hole would look like a bug; a sparser, dimmer region
        // reads as depth.
        const inCalm = fx >= zoneMinX && fx <= zoneMaxX && fy >= zoneMinY && fy <= zoneMaxY;
        let brightness = 1;
        if (inCalm) {
            if (rng() > zone.keep) continue;
            brightness = zone.dim;
        }

        const depth = rngBetween(rng, z);

        const index = written * 3;
        layoutData[index] = fx;
        layoutData[index + 1] = fy;
        layoutData[index + 2] = depth;

        // Mostly white, with a minority of cool blue stars for variety.
        tint.copy(rng() < 0.22 ? blue : white);
        tint.multiplyScalar(brightness * rngBetween(rng, [0.65, 1]));
        colors[index] = tint.r;
        colors[index + 1] = tint.g;
        colors[index + 2] = tint.b;

        sizes[written] = rngBetween(rng, size);
        phases[written] = rng() * Math.PI * 2;
        speeds[written] = rngBetween(rng, [0.35, 1.15]);

        written += 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, written * 3), 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors.subarray(0, written * 3), 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes.subarray(0, written), 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases.subarray(0, written), 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds.subarray(0, written), 1));

    /** Project the stored frame fractions into world units at this aspect. */
    function project() {
        for (let i = 0; i < written; i += 1) {
            const index = i * 3;
            const fx = layoutData[index];
            const fy = layoutData[index + 1];
            const depth = layoutData[index + 2];
            const view = stage.view(depth);

            positions[index] = (fx - 0.5) * view.width * overscan;
            positions[index + 1] = (fy - 0.5) * view.height * overscan;
            positions[index + 2] = depth;
        }
        geometry.attributes.position.needsUpdate = true;

        // Points can read as an off-screen sprite; the frustum test would then
        // cull the whole layer as soon as the origin leaves the view. The
        // radius is just an upper bound for culling, which is disabled anyway.
        const reference = stage.view(DEPTHS.starMid);
        geometry.boundingSphere = new THREE.Sphere(
            new THREE.Vector3(),
            Math.hypot(reference.width, reference.height) * overscan,
        );
    }

    project();

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSize: { value: 1 },
            uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) },
            uTwinkle: { value: layer.twinkle },
            uOpacity: { value: 1 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;

    return {
        object: points,
        parallax: layer.parallax,
        drift: layer.drift,
        baseZ: 0,
        // Signature matches every other element: (elapsed, dt, pointer).
        update(elapsed, dt, pointer) {
            material.uniforms.uTime.value = elapsed;
            points.rotation.z = elapsed * (layer.drift ?? 0) * 0.01;
            points.position.x = pointer.x * STARFIELD.pointerTravel * layer.parallax;
            points.position.y = pointer.y * STARFIELD.pointerTravel * layer.parallax * 0.6;
        },
        layout() {
            project();
        },
        setDpr(dpr) {
            material.uniforms.uDpr.value = dpr;
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        },
    };
}

export function createStarfield(stage) {
    const rng = createRng(0x51a7c0de);
    const layers = STARFIELD.layers.map((layer) => {
        const built = buildLayer(stage, layer, rng);
        stage.scene.add(built.object);
        return built;
    });

    return {
        update(elapsed, dt, pointer) {
            layers.forEach((layer) => layer.update(elapsed, dt, pointer));
        },
        layout() {
            layers.forEach((layer) => layer.layout());
        },
        setPixelRatio(dpr) {
            layers.forEach((layer) => layer.setDpr(dpr));
        },
        dispose() {
            layers.forEach((layer) => {
                stage.scene.remove(layer.object);
                layer.dispose();
            });
        },
    };
}
