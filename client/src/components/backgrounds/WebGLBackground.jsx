import { useEffect, useRef } from 'react';
import { createBackground } from '@/components/backgrounds/webgl';

/**
 * Full-viewport WebGL backdrop for the auth pages.
 *
 * Renders a single fixed canvas at the very bottom of the stacking order and
 * owns no DOM beyond it. `pointer-events: none` is load-bearing: every mouse
 * event has to reach the form rendered above this.
 *
 * The scene is imperative (Three.js owns the loop), so React only starts and
 * destroys it. Under StrictMode the effect runs twice; `createBackground`
 * returns a `destroy()` that fully tears down the WebGL context, and the
 * cleanup below is what keeps that from leaking a second canvas.
 */
export const WebGLBackground = ({ className = '' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        // No WebGL (old browser, blocked context): leave the CSS background
        // colour in place rather than throwing over the login page.
        const background = createBackground(canvas);
        return () => background.destroy();
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 -z-10 h-full w-full ${className}`}
        />
    );
};

export default WebGLBackground;
