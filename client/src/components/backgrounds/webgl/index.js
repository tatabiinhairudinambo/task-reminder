/**
 * Login background orchestration.
 *
 * Wires the stage to the scene elements, owns the animation loop, and is the
 * only place that knows about the compact breakpoint, pointer parallax and
 * `prefers-reduced-motion`. Elements stay unaware of all three.
 *
 * Usage:
 *   const background = createBackground(canvas);
 *   // ...later
 *   background.destroy();
 */

import { COMPACT_BREAKPOINT, DEPTHS, MAX_PIXEL_RATIO } from './config.js';
import { createStage } from './scene.js';
import { createStarfield } from './starfield.js';
import { createPlanet } from './planet.js';
import { createNebula } from './nebula.js';
import { createSkyline } from './skyline.js';
import { createBeams } from './beams.js';
import { clamp, damp } from './utils.js';

export function createBackground(canvas) {
    const stage = createStage(canvas);

    // Built back-to-front. The skyline must exist before the beams, because
    // beams pick their anchor points out of the generated buildings.
    const elements = [];
    const nebula = createNebula(stage);
    const starfield = createStarfield(stage);
    const planet = createPlanet(stage);
    const skyline = createSkyline(stage);
    const beams = createBeams(stage, skyline);
    elements.push(nebula, starfield, planet, skyline, beams);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = motionQuery.matches;

    const pointerTarget = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    let pointerAttached = false;

    const elapsed = { value: 0 };
    let frameId = null;
    let lastTime = 0;
    let visible = true;
    let destroyed = false;

    function isCompact() {
        return stage.size.width < COMPACT_BREAKPOINT;
    }

    /** Re-place every element for the current frame size. */
    function layout() {
        const compact = isCompact();
        nebula.layout(compact);
        starfield.layout();
        planet.layout(compact);
        skyline.layout(compact);
        beams.layout(compact);
    }

    function resize() {
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;

        stage.resize(width, height);
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        starfield.setPixelRatio(dpr);
        layout();

        // A reduced-motion visitor gets one correctly composed still.
        if (reduceMotion) renderOnce();
    }

    function renderOnce() {
        stage.render();
    }

    function onPointerMove(event) {
        const width = stage.size.width || 1;
        const height = stage.size.height || 1;
        pointerTarget.x = clamp((event.clientX / width) * 2 - 1, -1, 1);
        pointerTarget.y = clamp(-((event.clientY / height) * 2 - 1), -1, 1);
    }

    function tick(time) {
        if (destroyed) return;
        frameId = window.requestAnimationFrame(tick);

        // Seconds since init, so `elapsed` stays continuous across pauses.
        const now = time * 0.001;
        const dt = lastTime === 0 ? 0.016 : Math.min(0.05, now - lastTime);
        lastTime = now;

        if (!visible) return;

        elapsed.value += dt;
        // Ease the pointer so parallax lags the cursor slightly — instant
        // tracking reads as jitter.
        pointer.x = damp(pointer.x, pointerTarget.x, 4.5, dt);
        pointer.y = damp(pointer.y, pointerTarget.y, 4.5, dt);

        elements.forEach((element) => element.update?.(elapsed.value, dt, pointer));
        renderOnce();
    }

    function start() {
        if (frameId === null) {
            lastTime = 0;
            frameId = window.requestAnimationFrame(tick);
        }
    }

    function stop() {
        if (frameId !== null) {
            window.cancelAnimationFrame(frameId);
            frameId = null;
        }
    }

    function onVisibilityChange() {
        visible = !document.hidden;
        // Restarting resets the delta baseline, so a tab that was hidden for a
        // minute does not resume with one enormous frame step.
        if (visible && !reduceMotion) {
            stop();
            start();
        }
    }

    function onMotionPreferenceChange(event) {
        reduceMotion = event.matches;
        if (reduceMotion) {
            stop();
            renderOnce();
        } else {
            start();
        }
    }

    // Reduced motion renders a single static frame: no loop, no pointer
    // parallax, no twinkle.
    if (!reduceMotion) {
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        pointerAttached = true;
        start();
    }

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionQuery.addEventListener('change', onMotionPreferenceChange);

    resize();
    if (reduceMotion) renderOnce();

    return {
        resize,
        destroy() {
            destroyed = true;
            stop();
            window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            motionQuery.removeEventListener('change', onMotionPreferenceChange);
            if (pointerAttached) window.removeEventListener('pointermove', onPointerMove);
            elements.forEach((element) => element.dispose?.());
            stage.dispose();
        },
        /** Exposed for debugging; not used by the React wrapper. */
        stage,
        depth: DEPTHS,
    };
}
