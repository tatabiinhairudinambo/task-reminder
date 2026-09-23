/**
 * Renderer, camera, scene graph root and post-processing chain.
 *
 * Owns everything that is not a scene element: sizing, screen↔world
 * conversion, the bloom chain, and disposal. Elements are handed this object
 * and use `view()` / `at()` to place themselves without knowing the aspect.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BLOOM, CAMERA, COLORS, MAX_PIXEL_RATIO } from './config.js';

export function createStage(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
    });

    renderer.setClearColor(COLORS.base, 1);
    // Tone mapping and colour-space conversion both happen in `OutputPass`, at
    // the end of the chain — see below.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
    // The camera sits at the origin looking straight down -Z: elements are
    // placed by depth alone, which keeps `view()` a closed-form calculation.
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    const size = { width: 1, height: 1, aspect: 1, pixelRatio: 1 };

    /** Visible frame extent at a given depth, in world units. */
    function view(depth = CAMERA.depth) {
        const distance = Math.abs(depth) || CAMERA.depth;
        const height = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA.fov) / 2) * distance;
        return { width: height * size.aspect, height };
    }

    /**
     * Frame fractions → world position at a depth. `fx`/`fy` run 0..1 from the
     * bottom-left of the visible frame, so layout reads the same at any aspect.
     */
    function at(depth, fx, fy) {
        const { width, height } = view(depth);
        return { x: (fx - 0.5) * width, y: (fy - 0.5) * height, width, height };
    }

    /**
     * Fraction of the frame width, in world units at a depth. Lets elements
     * size themselves relative to the frame instead of in raw world units.
     */
    function spanW(depth, fraction) {
        return view(depth).width * fraction;
    }

    function spanH(depth, fraction) {
        return view(depth).height * fraction;
    }

    let composer = null;
    let bloomPass = null;

    function buildComposer() {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        const resolution = new THREE.Vector2(size.width, size.height);
        bloomPass = new UnrealBloomPass(resolution, BLOOM.strength, BLOOM.radius, BLOOM.threshold);
        composer.addPass(bloomPass);

        // Applies the renderer's tone mapping + output colour space. Without
        // it the bloom chain would leave the frame in linear space.
        composer.addPass(new OutputPass());
    }

    buildComposer();

    function resize(width, height) {
        size.width = Math.max(1, Math.floor(width));
        size.height = Math.max(1, Math.floor(height));
        size.aspect = size.width / size.height;
        size.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

        renderer.setPixelRatio(size.pixelRatio);
        renderer.setSize(size.width, size.height, false);

        camera.aspect = size.aspect;
        camera.updateProjectionMatrix();

        composer.setPixelRatio(size.pixelRatio);
        composer.setSize(size.width, size.height);
    }

    function render() {
        composer.render();
    }

    function dispose() {
        composer.dispose();
        bloomPass?.dispose?.();
        renderer.dispose();
    }

    return {
        renderer,
        scene,
        camera,
        size,
        view,
        at,
        spanW,
        spanH,
        resize,
        render,
        dispose,
    };
}
