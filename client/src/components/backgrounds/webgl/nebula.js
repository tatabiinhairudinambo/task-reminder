/**
 * Nebula — a few large, very soft additive sheets in the upper frame.
 *
 * These exist purely for depth: they give the planet and the beams something
 * to sit in front of, and they carry the violet/blue haze across the top. They
 * are kept faint and off the copy side so the headline stays readable without
 * any extra scrim.
 */

import * as THREE from 'three';
import { COLORS, NEBULA } from './config.js';
import { NOISE_GLSL } from './shaders.js';

const VERTEX = /* glsl */ `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const FRAGMENT = /* glsl */ `
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uSeed;
    uniform float uOpacity;
    uniform float uDrift;
    uniform float uFalloff;

    varying vec2 vUv;

    ${NOISE_GLSL}

    void main() {
        // Elliptical mask, so the sheet fades to nothing on every side.
        vec2 centred = vUv - vec2(0.5);
        float radius = length(centred * vec2(1.0, 1.35));
        float mask = pow(clamp(1.0 - radius * 2.0, 0.0, 1.0), uFalloff);
        if (mask < 0.004) discard;

        // Two octaves drifting against each other give the cloud structure.
        vec2 drift = vec2(uTime * uDrift, uTime * uDrift * 0.35);
        float cloudA = fbm(vUv * 3.2 + uSeed + drift);
        float cloudB = fbm(vUv * 6.4 - uSeed * 1.7 - drift * 1.4);
        float density = mix(0.5, 1.25, cloudA) * mix(0.6, 1.15, cloudB);

        float alpha = mask * density * uOpacity;
        if (alpha < 0.002) discard;

        gl_FragColor = vec4(uColor, alpha);
    }
`;

const PLANE = new THREE.PlaneGeometry(1, 1);

export function createNebula(stage) {
    const group = new THREE.Group();
    stage.scene.add(group);

    const layers = NEBULA.layers.map((layer) => {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(COLORS[layer.color]) },
                uTime: { value: 0 },
                uSeed: { value: layer.seed },
                uOpacity: { value: layer.opacity },
                uDrift: { value: layer.drift },
                uFalloff: { value: NEBULA.falloff },
            },
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        const mesh = new THREE.Mesh(PLANE, material);
        mesh.frustumCulled = false;
        group.add(mesh);

        return { mesh, material, layer };
    });

    function layout(compact = false) {
        layers.forEach(({ mesh, material, layer }) => {
            const { x, y, width, height } = stage.at(layer.depth, layer.fx, layer.fy);
            mesh.position.set(x, y, layer.depth);
            mesh.scale.set(width * layer.size[0], height * layer.size[1], 1);

            // Below the breakpoint the form covers the whole frame, so the
            // haze is thinned out rather than left to sit under the inputs.
            material.uniforms.uOpacity.value = compact ? layer.opacity * 0.6 : layer.opacity;
        });
    }

    layout(false);

    return {
        object: group,
        layout,
        update(elapsed) {
            layers.forEach(({ material }) => {
                material.uniforms.uTime.value = elapsed;
            });
        },
        dispose() {
            stage.scene.remove(group);
            layers.forEach(({ material }) => material.dispose());
        },
    };
}
