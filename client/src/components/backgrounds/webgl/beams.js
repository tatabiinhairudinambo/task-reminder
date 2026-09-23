/**
 * Light beams — additive vertical shafts rising from points in the skyline.
 *
 * Each beam is a plane whose shader fades out along its length and flickers.
 * Colour runs amber at the base into the brand blue at the tip, so the warm
 * accent stays where it is supposed to: at the city, not across the frame.
 */

import * as THREE from 'three';
import { BEAMS, COLORS, DEPTHS, SKYLINE } from './config.js';
import { NOISE_GLSL } from './shaders.js';
import { createRng, rngBetween, rngPick } from './utils.js';

const VERTEX = /* glsl */ `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAGMENT = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uTipColor;
    uniform float uTime;
    uniform float uSeed;
    uniform float uIntensity;
    uniform float uSpeed;

    varying vec2 vUv;

    ${NOISE_GLSL}

    void main() {
        float along = vUv.y;

        // Bright at the root, gone by the tip. Squared so the falloff hugs the
        // skyline instead of washing the whole upper frame.
        float lengthFade = pow(1.0 - along, 2.2);

        // A tight bright core inside a softer halo. A single wide falloff reads
        // as a smoke plume; two terms read as a light shaft.
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float halo = pow(clamp(across, 0.0, 1.0), 1.5);
        float core = pow(clamp(across, 0.0, 1.0), 7.0);

        // Two frequencies of noise, drifting upward, break the shaft into
        // something closer to atmospheric scatter than a painted stripe. Kept
        // shallow (mix floor near 1.0) so the shaft stays a shaft.
        float drift = uTime * uSpeed;
        float noiseA = fbm(vec2(vUv.x * 3.0 + uSeed, along * 4.0 - drift * 0.35));
        float noiseB = valueNoise(vec2(vUv.x * 9.0 - uSeed * 3.0, along * 11.0 - drift));
        float breakUp = mix(0.82, 1.0, noiseA) * mix(0.9, 1.0, noiseB);

        // Very slow flicker, anchored near 1.0 so it never blinks off.
        float flicker = 0.86 + 0.14 * sin(uTime * 0.5 + hash21(vec2(uSeed)) * 6.2831853);

        float profile = halo * 0.55 + core * 0.85;
        float alpha = lengthFade * profile * breakUp * flicker * uIntensity;
        if (alpha < 0.002) discard;

        vec3 color = mix(uBaseColor, uTipColor, smoothstep(0.0, 0.75, along));
        // The core runs hotter and whiter than the halo, the way a bright
        // source blooms out toward white at its centre.
        color = mix(color, vec3(1.0), core * 0.35);
        gl_FragColor = vec4(color, alpha);
    }
`;

const PLANE = new THREE.PlaneGeometry(1, 1);

export function createBeams(stage, skyline) {
    const group = new THREE.Group();
    stage.scene.add(group);

    const rng = createRng(0x6ea45f1a);
    const baseColor = new THREE.Color(COLORS.amber);
    const tipColor = new THREE.Color(COLORS.brandBlue);

    const meshes = [];

    /**
     * Anchor the group to the bottom edge of the frame, the same way the
     * skyline does. Without this the group sits at the frame centre and the
     * beams hang in mid-air instead of rising off the city.
     */
    function anchor() {
        const { height } = stage.view(DEPTHS.beams);
        group.position.y = -height / 2;
        group.position.z = DEPTHS.beams;
    }

    function clear() {
        meshes.forEach((entry) => {
            group.remove(entry.object);
            entry.material.dispose();
        });
        meshes.length = 0;
    }

    function build() {
        clear();

        const { width, height } = stage.view(DEPTHS.beams);
        const anchors = skyline.buildingAnchors;
        if (!anchors.length) return;

        const [minFx, maxFx] = BEAMS.anchorZone;
        // Measured at the beams' own depth so the shafts still meet the
        // skyline shoulder even though the two planes are a few units apart.
        const bandHeight = stage.spanH(DEPTHS.beams, SKYLINE.heightFraction);

        for (let i = 0; i < BEAMS.count; i += 1) {
            // Pick a real building to rise from, restricted to the anchor zone
            // so the calm left/centre of the frame stays clear.
            const candidates = anchors.filter((building) => {
                const fx = (building.x + width / 2) / width;
                return fx >= minFx && fx <= maxFx;
            });
            if (!candidates.length) continue;

            const building = rngPick(rng, candidates);
            const beamWidth = width * rngBetween(rng, BEAMS.width);
            const beamHeight = height * rngBetween(rng, BEAMS.height);

            const material = new THREE.ShaderMaterial({
                uniforms: {
                    uBaseColor: { value: baseColor },
                    uTipColor: { value: tipColor },
                    uTime: { value: 0 },
                    uSeed: { value: rng() * 20 },
                    uIntensity: { value: rngBetween(rng, [0.28, 0.62]) },
                    uSpeed: { value: rngBetween(rng, BEAMS.flickerSpeed) },
                },
                vertexShader: VERTEX,
                fragmentShader: FRAGMENT,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(PLANE, material);
            mesh.scale.set(beamWidth, beamHeight, 1);
            // Local to the group, whose origin is the bottom edge of the frame:
            // start at the skyline shoulder and rise from there.
            mesh.position.set(
                building.x,
                bandHeight * 0.45 + beamHeight / 2,
                rngBetween(rng, [-1.5, 1.5])
            );
            mesh.frustumCulled = false;

            group.add(mesh);
            meshes.push({ object: mesh, material });
        }
    }

    anchor();
    build();
    // The skyline is built before this, so its anchors already exist; a resize
    // rebuilds both in that order (see index.js).

    return {
        object: group,
        layout(compact) {
            // Below the breakpoint the login form takes the full width and sits
            // over the city, so the beams are dropped entirely — bright vertical
            // streaks behind body text are the one thing that cannot be dimmed
            // enough to stay readable.
            if (compact) {
                clear();
                return;
            }
            anchor();
            build();
        },
        update(elapsed) {
            meshes.forEach((entry) => {
                entry.material.uniforms.uTime.value = elapsed;
            });
        },
        dispose() {
            stage.scene.remove(group);
            meshes.forEach((entry) => entry.material.dispose());
            meshes.length = 0;
        },
    };
}
