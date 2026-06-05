import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { fragmentShader, vertexShader } from './shaders';

interface EyeAvatarProps {
  /** Returns the current audio loudness 0..1 (drives the "talking" motion). */
  getLevel: () => number;
}

/**
 * Full-screen WebGL canvas that renders the procedural liquid-eye.
 * Pure Three.js (no React-per-frame work) so it stays smooth on phones.
 */
export default function EyeAvatar({ getLevel }: EyeAvatarProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Keep the latest getLevel without re-creating the WebGL context.
  const getLevelRef = useRef(getLevel);
  getLevelRef.current = getLevel;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    // Cap DPR for battery/perf on mobile while staying crisp.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms: Record<string, THREE.IUniform> = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uAudio: { value: 0 },
      uLook: { value: new THREE.Vector2(0, 0) },
      uBlink: { value: 0 },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uScale: { value: 1 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      (uniforms.uResolution.value as THREE.Vector2).set(
        w * renderer.getPixelRatio(),
        h * renderer.getPixelRatio(),
      );
      // Position/size the eye so captions (bottom on phones, side on desktop)
      // never sit over it. On tall/portrait screens lift it up and shrink a
      // touch; on wide screens keep it centred.
      const aspect = w / h;
      const center = uniforms.uCenter.value as THREE.Vector2;
      // The screen is now just the eye, so centre it and let it fill more space.
      if (aspect < 0.85) {
        // Phone portrait: centred hero.
        center.set(0, 0.0);
        uniforms.uScale.value = 0.92;
      } else if (aspect < 1.25) {
        center.set(0, 0.0);
        uniforms.uScale.value = 1.0;
      } else {
        center.set(0, 0.0);
        uniforms.uScale.value = 1.05;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Gaze follows pointer / touch, gently.
    const look = new THREE.Vector2(0, 0);
    const targetLook = new THREE.Vector2(0, 0);
    let pointerActive = 0; // seconds remaining of pointer-driven gaze (else idle drift)
    const onPointer = (clientX: number, clientY: number) => {
      const x = (clientX / window.innerWidth) * 2 - 1;
      const y = -((clientY / window.innerHeight) * 2 - 1);
      targetLook.set(x, y);
      pointerActive = 2.5; // seconds of pointer-driven gaze before idle drift
    };
    const onMouse = (ev: MouseEvent) => onPointer(ev.clientX, ev.clientY);
    const onTouch = (ev: TouchEvent) => {
      if (ev.touches[0]) onPointer(ev.touches[0].clientX, ev.touches[0].clientY);
    };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });

    const smootherstep = (x: number) => {
      const t = Math.min(Math.max(x, 0), 1);
      return t * t * t * (t * (t * 6 - 15) + 10);
    };

    // Realistic blink kinematics (high-speed-camera / Disney-research derived):
    // fast asymmetric close, brief closed hold, slower open. Inter-blink
    // intervals follow an exponential distribution, with occasional doubles.
    const CLOSE = 0.09; // s — fast closing
    const HOLD = 0.045; // s — fully-closed hold
    const OPEN = 0.22; // s — slower opening
    const BLINK_TOTAL = CLOSE + HOLD + OPEN;
    const scheduleBlink = () => 1.0 + -Math.log(1 - Math.random()) * 3.2; // mean ~3.2s
    let nextBlink = scheduleBlink();
    let blinkT = -1; // -1 = not blinking
    let pendingDouble = false;

    // Micro-saccades: tiny, ever-present ocular jitter so the eye is never
    // perfectly still. Plus the occasional small autonomous gaze shift.
    const micro = new THREE.Vector2(0, 0);
    const microTarget = new THREE.Vector2(0, 0);
    let microTimer = 0;
    const idleGaze = new THREE.Vector2(0, 0);
    const idleTarget = new THREE.Vector2(0, 0);
    let idleTimer = 1 + Math.random() * 2;

    let smoothed = 0;
    const clock = new THREE.Clock();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const tt = clock.elapsedTime;

      const raw = Math.min(Math.max(getLevelRef.current(), 0), 1);
      smoothed += (raw - smoothed) * (raw > smoothed ? 0.35 : 0.08);
      uniforms.uTime.value = tt;
      uniforms.uAudio.value = smoothed;

      // --- gaze: pointer + autonomous idle saccades + micro-saccades ---
      pointerActive = Math.max(0, pointerActive - dt);
      microTimer -= dt;
      if (microTimer <= 0) {
        microTimer = 0.18 + Math.random() * 0.22;
        microTarget.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05);
      }
      micro.lerp(microTarget, 0.25);

      idleTimer -= dt;
      if (idleTimer <= 0) {
        idleTimer = 1.5 + Math.random() * 3.5;
        idleTarget.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4);
      }
      idleGaze.lerp(idleTarget, 0.04);

      // Blend pointer-driven gaze with idle drift, plus micro jitter.
      const base = pointerActive > 0 ? targetLook : idleGaze;
      look.lerp(base, pointerActive > 0 ? 0.12 : 0.05);
      (uniforms.uLook.value as THREE.Vector2).set(look.x + micro.x, look.y + micro.y);

      // --- blink driver ---
      if (blinkT < 0) {
        nextBlink -= dt;
        if (nextBlink <= 0) {
          blinkT = 0;
          nextBlink = scheduleBlink();
        }
      }
      if (blinkT >= 0) {
        blinkT += dt;
        let b: number;
        if (blinkT < CLOSE) {
          b = smootherstep(blinkT / CLOSE); // 0 -> 1 (fast)
        } else if (blinkT < CLOSE + HOLD) {
          b = 1;
        } else if (blinkT < BLINK_TOTAL) {
          b = 1 - smootherstep((blinkT - CLOSE - HOLD) / OPEN); // 1 -> 0 (slow)
        } else {
          b = 0;
          blinkT = -1;
          // Occasional natural double-blink.
          if (!pendingDouble && Math.random() < 0.18) {
            pendingDouble = true;
            nextBlink = 0.12;
          } else {
            pendingDouble = false;
          }
        }
        uniforms.uBlink.value = b;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchmove', onTouch);
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="avatar-canvas" aria-hidden="true" />;
}
