/**
 * Skyline — a procedural silhouette of low-poly blocks along the bottom edge.
 *
 * Buildings are plain boxes with a tiny window-grid shader (one draw call for
 * the whole city). The band is built to fill the frame width exactly, so any
 * aspect ratio from ultrawide to narrow gets a continuous skyline rather than
 * one that stops short of the edge.
 */

import * as THREE from 'three';
import { COLORS, DEPTHS, SKYLINE } from './config.js';
import { NOISE_GLSL } from './shaders.js';
import { createRng, rngBetween } from './utils.js';

const VERTEX = /* glsl */ `
    uniform float uCalmEnd;
    uniform float uCalmRamp;

    varying vec3 vLocalPosition;
    varying vec3 vNormal;
    varying float vHeight;
    varying vec2 vFaceUv;
    varying float vRimWidth;
    varying float vCalm;

    void main() {
        vLocalPosition = position;
        vNormal = normalize(normalMatrix * normal);
        // Local box space: x/y/z all run -0.5..0.5, so the top face is the
        // only one that needs to be treated as a roof.
        vHeight = position.y;

        // Recover this instance's world size from its matrix. The box is a
        // shared unit cube, so the window grid drawn from local coordinates
        // would be identical on every building — one 2x2 grid stretched over a
        // skyscraper and a hut alike. Multiplying by the instance scale puts
        // the grid back into world units, so a tall tower genuinely gets more
        // rows of windows than a low one.
        vec3 instanceScale = vec3(
            length(instanceMatrix[0].xyz),
            length(instanceMatrix[1].xyz),
            length(instanceMatrix[2].xyz)
        );

        // The lit roof edge has to be a constant thickness in WORLD units. In
        // local box space it would be 4% of the building, so a landmark tower
        // would get a fat coloured cap while a hut got a hairline. Converting a
        // fixed world height back into local space keeps it even everywhere.
        vRimWidth = clamp(0.10 / max(instanceScale.y, 0.001), 0.002, 0.5);

        // Frame position of this instance, so the fragment stage can dim the
        // lit details where the hero copy sits. Computed from the instance
        // matrix rather than the world matrix, because on an InstancedMesh the
        // model matrix is the parent group's, which is shared by every block.
        mat4 worldMatrix = modelMatrix * instanceMatrix;
        vec4 worldPosition = worldMatrix * vec4(position, 1.0);
        vec4 clipPosition = projectionMatrix * viewMatrix * worldPosition;
        float frameX = clipPosition.x / clipPosition.w * 0.5 + 0.5;
        // 0 = fully dimmed (under the copy), 1 = full brightness (city).
        vCalm = smoothstep(uCalmEnd - uCalmRamp, uCalmEnd, frameX);

        vec3 normal = normalize(vNormal);
        if (abs(normal.x) > 0.5) {
            vFaceUv = vec2(position.z * instanceScale.z, position.y * instanceScale.y);
        } else if (abs(normal.z) > 0.5) {
            vFaceUv = vec2(position.x * instanceScale.x, position.y * instanceScale.y);
        } else {
            vFaceUv = vec2(position.x * instanceScale.x, position.z * instanceScale.z);
        }

        gl_Position = clipPosition;
    }
`;

const FRAGMENT = /* glsl */ `
    uniform vec3 uBodyColor;
    uniform vec3 uWindowColor;
    uniform vec3 uRimColor;
    uniform float uWindowLit;
    uniform float uRimStrength;
    uniform vec2 uWindowScale;
    uniform float uTime;
    uniform float uSeed;
    uniform float uCalmEnd;
    uniform float uCalmRamp;
    uniform float uCalmDim;

    varying vec3 vLocalPosition;
    varying vec3 vNormal;
    varying float vHeight;
    varying vec2 vFaceUv;
    varying float vRimWidth;
    varying float vCalm;

    ${NOISE_GLSL}

    void main() {
        // Fade the windows out toward the top of each block and near the base,
        // so the grid never runs edge to edge like a texture.
        float heightFade = smoothstep(-0.5, -0.42, vLocalPosition.y)
            * (1.0 - smoothstep(0.40, 0.5, vLocalPosition.y));

        vec2 cell = floor(vFaceUv * uWindowScale + uSeed);
        float lit = hash21(cell + uSeed * 7.3);
        float on = step(1.0 - uWindowLit, lit);

        // A slow global shimmer reads as windows being switched on and off
        // without animating every cell individually.
        float shimmer = 0.82 + 0.18 * sin(uTime * 0.35 + hash21(cell) * 6.2831853);

        float isRoof = step(0.5, vHeight);
        float windows = on * heightFade * (1.0 - isRoof);

        // Ease the lit details down under the hero copy. The silhouette body
        // stays fully opaque, so the skyline still spans the frame; only the
        // bright parts retreat.
        float calm = mix(uCalmDim, 1.0, vCalm);

        vec3 color = uBodyColor;
        color += uWindowColor * windows * shimmer * calm;

        // Rim-light along the roof line: a constant-thickness lit edge in world
        // units (see vRimWidth), applied only to the side faces so the roof
        // plane itself does not glow.
        float topEdge = smoothstep(0.5 - vRimWidth, 0.5, vHeight);
        float sideFacing = 1.0 - abs(vNormal.y);
        color += uRimColor * topEdge * sideFacing * uRimStrength * calm;

        gl_FragColor = vec4(color, 1.0);
    }
`;

export function createSkyline(stage) {
    const group = new THREE.Group();
    stage.scene.add(group);

    const rng = createRng(0xc17a5eed);

    const bodyColor = new THREE.Color(0x02040a);
    const windowColor = new THREE.Color(COLORS.amber).lerp(new THREE.Color(COLORS.brandBlue), 0.4);
    const rimColor = new THREE.Color(COLORS.brandBlue);

    // One shared unit box, one shared material: every building is then just a
    // transform on an InstancedMesh, so the whole city is a single draw call.
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uBodyColor: { value: bodyColor },
            uWindowColor: { value: windowColor },
            uRimColor: { value: rimColor },
            uWindowLit: { value: SKYLINE.windowLit },
            uRimStrength: { value: SKYLINE.rimStrength },
            uWindowScale: { value: new THREE.Vector2(...SKYLINE.windowScale) },
            uTime: { value: 0 },
            uSeed: { value: 0.37 },
            uCalmEnd: { value: SKYLINE.calmEndX },
            uCalmRamp: { value: SKYLINE.calmRamp },
            uCalmDim: { value: SKYLINE.calmDim },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
    });

    let mesh = null;
    /** Layout data per building, kept so a resize can re-span the band. */
    let buildings = [];

    /** Build the randomised skyline for the current frame width. */
    function generate(width, compact) {
        const count = Math.round(
            Math.min(SKYLINE.maxBuildings, Math.max(SKYLINE.minBuildings, width * SKYLINE.density))
        );

        // Below the breakpoint the form owns the full width, so the band is
        // shortened to keep the silhouette low in the frame.
        const bandHeight = stage.spanH(DEPTHS.skyline, SKYLINE.heightFraction) * (compact ? 0.7 : 1);
        // Buildings overlap slightly so the silhouette has no gaps between
        // neighbours, the way a real skyline merges into one mass.
        const slot = width / count;

        buildings = [];
        for (let i = 0; i < count; i += 1) {
            // Bias toward shorter towers so a few landmarks can stand out.
            const shaped = Math.pow(rng(), 2.1);
            const height = bandHeight * (0.18 + shaped * SKYLINE.maxHeightFraction);
            const depth = rngBetween(rng, SKYLINE.depthRange);

            buildings.push({
                x: (i + 0.5) * slot - width / 2,
                y: 0,
                z: rngBetween(rng, [-depth * 0.35, depth * 0.35]),
                width: slot * rngBetween(rng, [0.72, 1.16]),
                height,
                depth,
                tint: rngBetween(rng, [0.82, 1.08]),
            });
        }

        if (mesh) {
            group.remove(mesh);
            mesh.dispose();
        }

        mesh = new THREE.InstancedMesh(geometry, material, buildings.length);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        buildings.forEach((building, index) => {
            position.set(building.x, building.y + building.height / 2, building.z);
            scale.set(building.width, building.height, building.depth);
            matrix.compose(position, quaternion, scale);
            mesh.setMatrixAt(index, matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;

        group.add(mesh);
    }

    function rebuild(compact) {
        const { width } = stage.view(DEPTHS.skyline);
        generate(width, compact);
    }

    function anchor(compact) {
        // Sits on the bottom edge, a touch lower in the compact composition so
        // more of the frame stays open above it.
        const { height } = stage.view(DEPTHS.skyline);
        group.position.y = -height / 2 + (compact ? -0.5 : 0);
        group.position.z = DEPTHS.skyline;
    }

    anchor(false);
    rebuild(false);

    return {
        object: group,
        /** A beam picks an x from here so it rises out of an actual block. */
        get buildingAnchors() {
            return buildings;
        },
        layout(compact) {
            anchor(compact);
            rebuild(compact);
        },
        update(elapsed) {
            material.uniforms.uTime.value = elapsed;
        },
        dispose() {
            stage.scene.remove(group);
            mesh?.dispose();
            geometry.dispose();
            material.dispose();
        },
    };
}
