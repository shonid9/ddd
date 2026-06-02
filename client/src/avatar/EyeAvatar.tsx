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
      uPulse: { value: 0 },
      uLook: { value: new THREE.Vector2(0, 0) },
      uBlink: { value: 0 },
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
    };
    resize();
    window.addEventListener('resize', resize);

    // Gaze follows pointer / touch, gently.
    const look = new THREE.Vector2(0, 0);
    const targetLook = new THREE.Vector2(0, 0);
    const onPointer = (clientX: number, clientY: number) => {
      const x = (clientX / window.innerWidth) * 2 - 1;
      const y = -((clientY / window.innerHeight) * 2 - 1);
      targetLook.set(x, y);
    };
    const onMouse = (ev: MouseEvent) => onPointer(ev.clientX, ev.clientY);
    const onTouch = (ev: TouchEvent) => {
      if (ev.touches[0]) onPointer(ev.touches[0].clientX, ev.touches[0].clientY);
    };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch, { passive: true });

    // Smoothed audio level + autonomous blinking.
    let smoothed = 0;
    let nextBlink = 1.5 + Math.random() * 4;
    let blinkPhase = -1; // -1 = idle
    const clock = new THREE.Clock();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const tt = clock.elapsedTime;

      // Ease audio level for organic motion.
      const raw = Math.min(Math.max(getLevelRef.current(), 0), 1);
      smoothed += (raw - smoothed) * (raw > smoothed ? 0.35 : 0.08);
      uniforms.uTime.value = tt;
      uniforms.uAudio.value = smoothed;

      look.lerp(targetLook, 0.05);
      (uniforms.uLook.value as THREE.Vector2).copy(look);

      // Blink scheduling.
      nextBlink -= dt;
      if (blinkPhase < 0 && nextBlink <= 0) {
        blinkPhase = 0;
        nextBlink = 2.5 + Math.random() * 5;
      }
      if (blinkPhase >= 0) {
        blinkPhase += dt * 7;
        // 0..1 close, 1..2 open
        const b = blinkPhase < 1 ? blinkPhase : Math.max(0, 2 - blinkPhase);
        uniforms.uBlink.value = b;
        if (blinkPhase >= 2) {
          blinkPhase = -1;
          uniforms.uBlink.value = 0;
        }
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
