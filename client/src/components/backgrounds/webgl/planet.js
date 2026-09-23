/**
 * Planet — a procedural sphere plus its atmosphere shell.
 *
 * The surface is generated entirely in the fragment shader (fbm continents,
 * latitude-banded clouds, a night side with city lights) so the scene ships
 * with no image assets. The atmosphere is a second, slightly larger sphere
 * rendered back-faces-only, which gives the rim its falloff for free.
 */

import * as THREE from 'three';
import { COLORS, DEPTHS, PLANET } from './config.js';
import { NOISE_GLSL } from './shaders.js';
import { damp, lerp } from './utils.js';

const SURFACE_VERTEX = /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldNormal;
    varying vec3 vViewPosition;

    void main() {
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        // World-space normal, used for the sun term. The sun has to stay put in
        // world space while the surface spins underneath it — computing the
        // terminator from an object-space normal would drag the day/night line
        // around with the rotation.
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const SURFACE_FRAGMENT = /* glsl */ `
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uLandColor;
    uniform vec3 uIceColor;
    uniform vec3 uCityColor;
    uniform vec3 uLightDirection;
    uniform float uTime;
    uniform float uCityIntensity;
    uniform float uGain;
    uniform float uCloudAmount;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec3 vWorldNormal;
    varying vec3 vViewPosition;

    ${NOISE_GLSL}

    void main() {
        // Three different spaces, each for one job:
        //   vNormal      — view space, for the rim (angle to the eye).
        //   vWorldNormal — world space, for the sun (a fixed world direction).
        //   vPosition    — object space, for the surface texture, so the
        //                  continents and city lights spin with the planet.
        vec3 normal = normalize(vNormal);
        vec3 worldNormal = normalize(vWorldNormal);
        vec3 viewDirection = normalize(vViewPosition);

        // Domain-warped fbm gives continents with believable coastlines —
        // plain fbm reads as camouflage.
        vec3 samplePoint = normalize(vPosition);
        vec2 sphereUv = vec2(
            atan(samplePoint.z, samplePoint.x) / 6.2831853,
            asin(clamp(samplePoint.y, -1.0, 1.0)) / 3.1415926
        );

        vec2 warp = vec2(
            fbm(sphereUv * 3.1 + 11.3),
            fbm(sphereUv * 3.1 - 27.9)
        );
        float continents = fbm(sphereUv * 4.2 + warp * 0.65);

        // Bias by latitude so the poles gather more land/ice.
        float latitude = abs(samplePoint.y);
        float elevation = continents - 0.34 + latitude * 0.10;

        float landMask = smoothstep(0.02, 0.14, elevation);
        float iceMask = smoothstep(0.74, 0.94, latitude + continents * 0.10);

        vec3 ocean = mix(uDeepColor, uShallowColor,
            smoothstep(-0.30, 0.05, elevation));
        vec3 land = mix(uLandColor, uLandColor * 0.62,
            smoothstep(0.10, 0.34, elevation));

        vec3 surface = mix(ocean, land, landMask);
        surface = mix(surface, uIceColor, iceMask * 0.72);

        // Drifting cloud deck.
        float clouds = fbm(sphereUv * 6.5 + vec2(uTime * 0.010, uTime * 0.004));
        clouds = smoothstep(0.52, 0.86, clouds);
        surface = mix(surface, vec3(0.86, 0.90, 0.96), clouds * uCloudAmount);

        // Day/night terminator. The sun sits almost on the limb, so the sphere
        // renders as a crescent: mostly dark with one bright edge. A front-lit
        // sphere would be a flat bright disc competing with the login form.
        vec3 lightDirection = normalize(uLightDirection);
        float lambert = dot(worldNormal, lightDirection);
        float daylight = smoothstep(-0.05, 0.55, lambert);

        // City lights: only on the night side, only on land, and clustered
        // rather than dusted evenly.
        float night = 1.0 - daylight;
        float clusters = fbm(sphereUv * 17.0 + 4.7);
        float cityLights = smoothstep(0.58, 0.86, clusters)
            * smoothstep(0.45, 0.95, landMask)
            * night
            * uCityIntensity;

        // Ambient floor keeps the dark side from going pure black, so the
        // sphere still reads as a body and not as a hole in the starfield.
        vec3 color = surface * (0.055 + daylight * 1.0);
        color += uCityColor * cityLights;

        // Rim: a thin bright edge where the sphere turns away from the eye, so
        // the silhouette separates from the black sky.
        float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.2);
        color += uShallowColor * rim * (0.10 + daylight * 0.5);

        // Final gain so the whole body recedes behind the UI instead of
        // competing with it.
        gl_FragColor = vec4(color * uGain, 1.0);
    }
`;

const ATMOSPHERE_VERTEX = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldNormal;
    varying vec3 vViewPosition;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
    uniform vec3 uColor;
    uniform vec3 uLightDirection;
    uniform float uIntensity;

    varying vec3 vNormal;
    varying vec3 vWorldNormal;
    varying vec3 vViewPosition;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = normalize(vViewPosition);

        // Back-face shell: the fresnel peaks exactly where the shell's rim
        // sits over the planet's limb, giving a soft halo with no blur pass.
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 2.6);

        float daylight = smoothstep(-0.35, 0.5, dot(normalize(vWorldNormal), normalize(uLightDirection)));

        float alpha = fresnel * uIntensity * (0.22 + daylight * 0.95);
        gl_FragColor = vec4(uColor, alpha);
    }
`;

export function createPlanet(stage) {
    const group = new THREE.Group();
    stage.scene.add(group);

    const surfaceGeometry = new THREE.SphereGeometry(1, PLANET.segments, PLANET.segments / 2);
    const surfaceMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uDeepColor: { value: new THREE.Color(0x071633) },
            uShallowColor: { value: new THREE.Color(COLORS.brandBlue) },
            uLandColor: { value: new THREE.Color(0x0d2145) },
            uIceColor: { value: new THREE.Color(0x9fb6d4) },
            uCityColor: { value: new THREE.Color(COLORS.amber) },
            uLightDirection: { value: new THREE.Vector3(...PLANET.lightDirection).normalize() },
            uTime: { value: 0 },
            uCityIntensity: { value: PLANET.cityIntensity },
            uGain: { value: PLANET.surfaceGain },
            uCloudAmount: { value: PLANET.cloudAmount },
        },
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
    });
    const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);

    const atmosphereGeometry = new THREE.SphereGeometry(1, PLANET.segments / 2, PLANET.segments / 4);
    const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(COLORS.brandBlue) },
            uLightDirection: { value: new THREE.Vector3(...PLANET.lightDirection).normalize() },
            uIntensity: { value: PLANET.atmosphereIntensity },
        },
        vertexShader: ATMOSPHERE_VERTEX,
        fragmentShader: ATMOSPHERE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);

    group.add(surface, atmosphere);

    // Live placement, recomputed on resize so the planet keeps its
    // fraction-of-frame position at every aspect ratio.
    const target = { x: 0, y: 0, radius: 1 };
    let spin = 0;

    function place(compact) {
        const preset = compact ? PLANET.compact : PLANET.desktop;
        const { x, y, height } = stage.at(DEPTHS.planet, preset.fx, preset.fy);
        target.x = x;
        target.y = y;
        // Radius comes off the frame *height*, not the width: a width-relative
        // radius grows without bound as the monitor gets wider and swallows
        // the frame, while height-relative keeps the disc the same visual size
        // at every aspect ratio.
        target.radius = height * preset.radius;
        spin = preset.spin;
    }

    place(false);
    group.position.set(target.x, target.y, DEPTHS.planet);
    surface.scale.setScalar(target.radius);
    atmosphere.scale.setScalar(target.radius * PLANET.atmosphereScale);

    function layout(compact, immediate = false) {
        place(compact);
        if (immediate) {
            group.position.set(target.x, target.y, DEPTHS.planet);
            surface.scale.setScalar(target.radius);
            atmosphere.scale.setScalar(target.radius * PLANET.atmosphereScale);
        }
    }

    return {
        object: group,
        layout,
        update(elapsed, dt) {
            // Ease toward the placement so a resize glides instead of snapping.
            group.position.x = damp(group.position.x, target.x, 3.5, dt);
            group.position.y = damp(group.position.y, target.y, 3.5, dt);
            const radius = damp(surface.scale.x, target.radius, 3.5, dt);
            surface.scale.setScalar(radius);
            atmosphere.scale.setScalar(radius * PLANET.atmosphereScale);

            surfaceMaterial.uniforms.uTime.value = elapsed;
            surface.rotation.y += spin * dt;
            // A near-imperceptible axial tilt keeps the terminator from
            // looking like a printed line.
            surface.rotation.z = lerp(surface.rotation.z, -0.22, 0.02);
        },
        dispose() {
            stage.scene.remove(group);
            surfaceGeometry.dispose();
            surfaceMaterial.dispose();
            atmosphereGeometry.dispose();
            atmosphereMaterial.dispose();
        },
    };
}
