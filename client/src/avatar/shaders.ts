/**
 * GLSL shaders for the liquid-eye avatar, kept as TS string modules so Vite
 * bundles them with zero extra config. A single full-screen quad is rendered;
 * everything (the iris, the chrome liquid, the splash droplets, the motion)
 * is computed procedurally in the fragment shader and driven by uniforms.
 */

export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform vec2  uResolution;
  uniform float uTime;
  uniform float uAudio;   // smoothed loudness 0..1 (how much it is "speaking")
  uniform float uPulse;   // slow breathing pulse 0..1
  uniform vec2  uLook;    // eye gaze direction, roughly -1..1
  uniform float uBlink;   // 0 = open, 1 = closed

  // ---------------------------------------------------------------- noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  const float PI = 3.14159265359;

  void main() {
    // Aspect-correct, centered coordinates. y in [-0.5, 0.5].
    vec2 uv = vUv - 0.5;
    uv.x *= uResolution.x / uResolution.y;

    float t = uTime;
    float talk = clamp(uAudio, 0.0, 1.0);
    float breathe = 0.5 + 0.5 * sin(t * 0.6);

    // Global organic domain-warp: the whole liquid body subtly churns and
    // churns harder while speaking — this is the "alive / talking" motion.
    float warpAmp = 0.018 + talk * 0.10 + breathe * 0.006;
    vec2 wcoord = uv * 3.2 + vec2(t * 0.12, -t * 0.09);
    float warp = fbm(wcoord);
    vec2 wuv = uv + (vec2(fbm(wcoord + 7.0), fbm(wcoord - 3.0)) - 0.5) * warpAmp;

    float r = length(wuv);
    float ang = atan(wuv.y, wuv.x);

    // ---------------------------------------------------------------- liquid body
    // Wobbly outer silhouette of the splash, perturbed more by audio.
    float edge = 0.34 + 0.20 * uResolution.y / max(uResolution.x, uResolution.y) * 0.0; // base
    float bodyR = 0.30
      + 0.045 * fbm(vec2(ang * 1.5 + t * 0.25, t * 0.2))
      + talk * 0.07 * fbm(vec2(ang * 3.0 - t * 0.8, t * 1.3))
      + breathe * 0.01;
    float body = smoothstep(bodyR, bodyR - 0.025, r); // 1 inside the blob

    // Splash tendrils / droplets flung outward, stronger while speaking.
    float splash = 0.0;
    {
      float sN = fbm(vec2(ang * 5.0, r * 6.0 - t * 1.2));
      float ring = smoothstep(bodyR + 0.16, bodyR, r) * (1.0 - body);
      splash = ring * smoothstep(0.55, 0.85, sN) * (0.4 + talk * 1.2);
    }

    // ---------------------------------------------------------------- chrome shell
    // Concentric liquid-metal ripples between the iris and the outer edge.
    float ripple = sin(r * 55.0 - t * 2.2 + warp * 7.0)
                 + 0.5 * sin(r * 110.0 + t * 1.3);
    float chrome = 0.5 + 0.5 * ripple;
    vec3 chromeCol = mix(vec3(0.18, 0.22, 0.28), vec3(0.92, 0.96, 1.0), chrome * chrome);
    // Cool bluish rim near the outer edge, like the splash highlights.
    float rim = smoothstep(bodyR - 0.05, bodyR, r);
    chromeCol = mix(chromeCol, vec3(0.55, 0.85, 1.05), rim * 0.8);

    // ---------------------------------------------------------------- iris + eye
    vec2 look = uLook * 0.035;
    vec2 e = uv - look;          // eye uses (mostly) unwarped space so it stays crisp
    float er = length(e);
    float ea = atan(e.y, e.x);

    float irisR = 0.165 + talk * 0.006 + breathe * 0.003;
    float pupilR = (0.050 + 0.010 * sin(t * 0.7)) * (1.0 + talk * 0.30);

    // Iris fibers: high-frequency angular streaks fading outward.
    float fibers = fbm(vec2(ea * 7.0, er * 26.0) + vec2(noise(vec2(ea * 4.0, er * 9.0)), t * 0.05));
    float crypts = fbm(vec2(ea * 20.0, er * 5.0) - t * 0.03);

    float rr = clamp(er / irisR, 0.0, 1.0);
    vec3 cInner = vec3(0.80, 0.62, 0.16);   // warm amber center
    vec3 cMid   = vec3(0.10, 0.52, 0.42);   // teal
    vec3 cOuter = vec3(0.12, 0.42, 0.95);   // blue rim
    vec3 iris = mix(cInner, cMid, smoothstep(0.0, 0.55, rr));
    iris = mix(iris, cOuter, smoothstep(0.45, 1.0, rr));
    iris *= 0.5 + 0.85 * fibers;
    iris += crypts * 0.07;

    // Dark limbal ring at the iris border for depth.
    iris *= 1.0 - smoothstep(irisR * 0.80, irisR, er) * 0.65;

    // Pupil (with faint inner glow).
    float pupil = smoothstep(pupilR, pupilR * 0.82, er);
    vec3 eyeCol = mix(iris, vec3(0.015, 0.02, 0.03), pupil);
    eyeCol += vec3(0.05, 0.15, 0.25) * smoothstep(pupilR * 1.4, pupilR, er) * 0.25;

    // Wet sphere shading over the eye: bright top-left, darker bottom-right.
    float sphere = clamp(1.0 - dot(normalize(vec2(-0.5, 0.6)), e / max(irisR, 0.001)) * 0.5, 0.0, 1.0);
    eyeCol *= 0.75 + 0.5 * sphere;

    // Specular catchlights.
    float spec1 = smoothstep(0.05, 0.0, length(e - vec2(-0.045, 0.05)));
    float spec2 = smoothstep(0.022, 0.0, length(e - vec2(0.03, -0.02)));
    eyeCol += spec1 * 0.85 + spec2 * 0.4;

    // ---------------------------------------------------------------- composite
    vec3 col = vec3(0.0);

    // Chrome region = inside body but outside the iris.
    float chromeRegion = smoothstep(irisR, irisR + 0.02, er) * body;
    col = chromeCol * chromeRegion;

    // Glass sphere sheen across the whole body.
    float sheen = smoothstep(bodyR, 0.0, length(wuv - vec2(-0.06, 0.07)));
    col += vec3(0.6, 0.8, 1.0) * sheen * 0.12 * body;

    // The eye on top.
    float eyeRegion = 1.0 - smoothstep(irisR - 0.004, irisR + 0.004, er);
    col = mix(col, eyeCol, eyeRegion);

    // Splash droplets (cool, bright).
    col += vec3(0.6, 0.85, 1.1) * splash;

    // Inner aura / glow that swells while speaking.
    col += vec3(0.10, 0.35, 0.75) * body * (0.05 + talk * 0.18);

    // Blink: a soft horizontal lid sweeping closed.
    float lid = smoothstep(0.0, 0.5, uBlink);
    float lidMask = smoothstep(uBlink * 0.5, uBlink * 0.5 - 0.08, abs(e.y));
    col *= 1.0 - lid * lidMask * step(er, irisR + 0.02);

    // Subtle film grain to avoid banding on dark gradients.
    col += (hash(uv * uResolution.xy + t) - 0.5) * 0.015;

    // Vignette into pure black background.
    float vig = smoothstep(1.1, 0.2, length(uv));
    col *= mix(0.85, 1.0, vig);

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;
