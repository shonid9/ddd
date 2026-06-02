/**
 * GLSL shaders for the liquid-eye avatar.
 *
 * The body is built from a LAVA-LAMP METABALL FIELD: a central molten core
 * (the eye lens) plus several blobs that slowly orbit and bob around it and
 * merge organically, exactly like wax in a lava lamp. Bright droplets detach
 * and drift outward. A realistic iris sits at the centre. Everything reacts to
 * `uAudio` so the liquid churns and the droplets fly while it is speaking.
 *
 * Rendered on a single full-screen quad; all of it is procedural.
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
  uniform vec2  uLook;    // eye gaze direction, roughly -1..1
  uniform float uBlink;   // 0 = open, 1 = closed
  uniform vec2  uCenter;  // offset of the eye centre in aspect-space
  uniform float uScale;   // overall size of the eye (1 = default)

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
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  const float PI = 3.14159265359;

  void main() {
    // Aspect-correct, centred coordinates. y in roughly [-0.5, 0.5].
    vec2 uv = vUv - 0.5;
    uv.x *= uResolution.x / uResolution.y;
    uv -= uCenter;
    uv /= max(uScale, 0.2);

    float t = uTime;
    float talk = clamp(uAudio, 0.0, 1.0);
    float breathe = 0.5 + 0.5 * sin(t * 0.55);

    float r0 = length(uv);

    // ============================================================ LAVA FIELD
    // Sum of inverse-square "charges" — the classic metaball field. The
    // surface is the iso-contour where the field crosses a threshold, so as
    // blobs approach each other they fuse with smooth liquid necks.
    float field = 0.0;

    // Central molten core = the eye body. Breathes and swells while speaking.
    float coreRad = 0.225 + talk * 0.022 + breathe * 0.010;
    field += (coreRad * coreRad) / (dot(uv, uv) + 0.0009);

    // Orbiting / bobbing blobs (the lava).
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float ph = fi * 1.04719755;                 // ~60° base spacing
      float spd = 0.16 + 0.06 * sin(fi * 1.7);     // each drifts at its own rate
      float dir = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0; // alternate orbit direction
      float orbit = 0.285 + 0.055 * sin(t * 0.4 + fi * 1.7) + talk * 0.06;
      vec2 c = vec2(cos(t * spd * dir + ph),
                    sin(t * spd * dir * 0.85 + ph * 1.3)) * orbit;
      c.y += 0.045 * sin(t * (0.55 + 0.2 * fi) + fi);   // vertical bob
      c *= 1.0 + talk * 0.10 * sin(t * 4.0 + fi);       // jitter while talking
      float rad = 0.085 + 0.03 * sin(t * 0.9 + fi * 2.1) + talk * 0.028;
      vec2 d = uv - c;
      field += (rad * rad) / (dot(d, d) + 0.0006);
    }

    // Body iso-surface (smooth metaball threshold).
    float body = smoothstep(0.95, 1.18, field);
    // Bright liquid rim where the field passes the surface.
    float rim = smoothstep(0.55, 0.0, abs(field - 1.06));

    // Detached droplets flung outward; far more of them while speaking.
    float drop = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float spd = 0.45 + 0.28 * fi;
      float ang = t * spd + fi * 2.4;
      float dist = 0.34 + 0.12 * hash(vec2(fi, 7.0)) + 0.08 * sin(t * 1.3 + fi) + talk * 0.07;
      vec2 c = vec2(cos(ang), sin(ang * 1.1)) * dist;
      float rad = 0.016 + 0.010 * (0.5 + 0.5 * sin(t * 2.0 + fi));
      drop += smoothstep(rad, rad * 0.35, length(uv - c)) * (0.20 + talk * 1.0);
    }

    // ============================================================ LIQUID CHROME
    // Molten metal shading inside the body: angular ripples + fbm churn, lit
    // from the top-left like the reference images.
    float churn = fbm(uv * 3.4 + vec2(t * 0.10, -t * 0.08));
    float ripple = sin(r0 * 40.0 - t * 1.6 + churn * 6.0)
                 + 0.5 * sin(r0 * 86.0 + t * 0.9);
    float chrome = 0.5 + 0.5 * ripple;

    vec3 deep = vec3(0.04, 0.08, 0.16);
    vec3 lite = vec3(0.55, 0.80, 0.98);
    vec3 chromeCol = mix(deep, lite, chrome * chrome);
    // Top-lit environment sheen (lava lamp glow from above).
    float topLight = smoothstep(-0.30, 0.40, uv.y + 0.10 * churn);
    chromeCol = mix(chromeCol, vec3(0.88, 0.96, 1.06), topLight * 0.45);
    // Cyan fresnel-like rim around every blob.
    chromeCol = mix(chromeCol, vec3(0.62, 0.92, 1.10), rim * 0.85);
    // Warmer molten tint deep inside, energised while speaking.
    chromeCol += vec3(0.10, 0.06, 0.02) * smoothstep(1.6, 3.2, field) * (0.4 + talk * 0.6);

    // ============================================================ IRIS / EYE
    vec2 look = uLook * 0.045;
    vec2 e = uv - look;
    float er = length(e);
    float ea = atan(e.y, e.x);

    float irisR = 0.150 + talk * 0.006 + breathe * 0.004;
    float pupilR = (0.048 + 0.010 * sin(t * 0.7)) * (1.0 + talk * 0.35);

    float fibers = fbm(vec2(ea * 7.0, er * 26.0) + vec2(noise(vec2(ea * 4.0, er * 9.0)), t * 0.05));
    float crypts = fbm(vec2(ea * 20.0, er * 5.0) - t * 0.03);

    float rr = clamp(er / irisR, 0.0, 1.0);
    vec3 cInner = vec3(0.16, 0.62, 0.55);   // teal-green centre
    vec3 cMid   = vec3(0.10, 0.52, 0.72);   // cyan
    vec3 cOuter = vec3(0.10, 0.34, 0.95);   // deep blue rim
    vec3 iris = mix(cInner, cMid, smoothstep(0.0, 0.55, rr));
    iris = mix(iris, cOuter, smoothstep(0.45, 1.0, rr));
    iris *= 0.5 + 0.85 * fibers;
    iris += crypts * 0.06;
    iris *= 1.0 - smoothstep(irisR * 0.80, irisR, er) * 0.65;   // dark limbal ring

    float pupil = smoothstep(pupilR, pupilR * 0.82, er);
    vec3 eyeCol = mix(iris, vec3(0.012, 0.016, 0.026), pupil);
    eyeCol += vec3(0.05, 0.16, 0.28) * smoothstep(pupilR * 1.4, pupilR, er) * 0.25;

    float sphere = clamp(1.0 - dot(normalize(vec2(-0.5, 0.6)), e / max(irisR, 0.001)) * 0.5, 0.0, 1.0);
    eyeCol *= 0.75 + 0.5 * sphere;

    float spec1 = smoothstep(0.05, 0.0, length(e - vec2(-0.045, 0.05)));
    float spec2 = smoothstep(0.022, 0.0, length(e - vec2(0.03, -0.02)));
    eyeCol += spec1 * 0.90 + spec2 * 0.45;

    // ============================================================ COMPOSITE
    vec3 col = vec3(0.0);

    // Soft outer halo so the body sits in a pool of light, not on hard black.
    float halo = smoothstep(0.75, 0.0, r0);
    col += vec3(0.05, 0.13, 0.26) * halo * (0.30 + talk * 0.45);

    // Chrome region = inside body but outside the iris disc.
    float chromeRegion = smoothstep(irisR, irisR + 0.018, er) * body;
    col = mix(col, chromeCol, chromeRegion);

    // Glassy sheen sweeping across the whole body.
    float sheen = smoothstep(0.55, 0.0, length(uv - vec2(-0.05, 0.06)));
    col += vec3(0.6, 0.8, 1.0) * sheen * 0.10 * body;

    // ------------------------------------------------ realistic eyelids
    // Upper lid descends fast, lower lid rises a little; they meet at centre.
    // uBlink: 0 = fully open, 1 = fully closed.
    float nyt = e.y / max(irisR * 1.15, 1e-3);             // +1 top .. -1 bottom
    float upperEdge = mix(1.25, -0.06, uBlink);            // upper lid edge
    float lowerEdge = mix(-1.25, -0.30, uBlink);           // lower lid (moves less)
    float coverUpper = smoothstep(upperEdge - 0.05, upperEdge + 0.05, nyt);
    float coverLower = 1.0 - smoothstep(lowerEdge - 0.05, lowerEdge + 0.05, nyt);
    float lidCover = clamp(max(coverUpper, coverLower), 0.0, 1.0);
    // Lids look like the liquid metal closing over the iris, with a bright
    // lash highlight along the moving upper edge.
    vec3 lidCol = chromeCol * 0.32 + vec3(0.02, 0.05, 0.09);
    float lash = smoothstep(0.07, 0.0, abs(nyt - upperEdge)) * step(0.02, uBlink);
    eyeCol = mix(eyeCol, lidCol, lidCover);
    eyeCol += vec3(0.55, 0.82, 1.05) * lash * 0.35;

    // The eye on top (only within the iris disc, which is always inside core).
    float eyeRegion = 1.0 - smoothstep(irisR - 0.004, irisR + 0.004, er);
    col = mix(col, eyeCol, eyeRegion);

    // Bright cool droplets.
    col += vec3(0.62, 0.88, 1.12) * drop;

    // Inner aura that swells while speaking.
    col += vec3(0.10, 0.35, 0.78) * body * (0.05 + talk * 0.20);
    col += vec3(0.30, 0.55, 0.95) * rim * (0.20 + talk * 0.30);

    // Subtle film grain to avoid banding on dark gradients.
    col += (hash(uv * uResolution.xy + t) - 0.5) * 0.015;

    // Vignette into pure black background.
    float vig = smoothstep(1.25, 0.2, length(vUv - 0.5));
    col *= mix(0.82, 1.0, vig);

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;
