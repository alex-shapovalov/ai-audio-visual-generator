import type { SceneId } from "@/lib/types"

export const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`

export const SCENE_INDEX: Record<SceneId, number> = {
  portal: 0,
  grid: 1,
  strobe: 2,
  rift: 3,
  media: 4,
}

export const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uTravel;
uniform vec4 uAudio;
uniform vec4 uPulse;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uWarp;
uniform float uKaleido;
uniform float uMediaMix;
uniform float uHasMedia;
uniform float uMediaAspect;
uniform sampler2D uMedia;

out vec4 outColor;

float hash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

vec3 ramp(float t) {
  float k = clamp(t, 0.0, 1.0);
  return k < 0.5 ? mix(uC, uB, k * 2.0) : mix(uB, uA, (k - 0.5) * 2.0);
}

vec3 portal(vec2 p) {
  float kick = uPulse.x;
  float open = uPulse.y;
  float flash = uPulse.z;
  float angle = atan(p.y, p.x);
  float r = length(p) + sin(angle * 5.0 + uTravel * 0.6) * 0.03 * (uAudio.x + uWarp * 0.5);
  r = max(r, 0.0008);

  float depth = 0.25 / r;
  float density = mix(3.0, 1.6, open);
  float rings = abs(fract(depth * density * 0.5 + uTravel * 0.5) - 0.5) * 2.0;
  float ringLine = smoothstep(0.82 - kick * 0.1, 1.0, rings);
  float spokes = abs(fract((angle / 6.28318 + uTravel * 0.02) * 12.0) - 0.5) * 2.0;
  float spokeLine = smoothstep(0.92, 1.0, spokes) * 0.6;
  float line = max(ringLine, spokeLine) * smoothstep(0.02, 0.35, r);

  vec3 col = uC * 0.6 * (1.0 - smoothstep(0.0, 0.5, r));
  col += ramp(depth * 0.15 + uTravel * 0.05 + uAudio.z * 0.3) * line * (0.6 + uAudio.y * 0.8);
  col += uA * exp(-r * (5.0 - open * 3.0)) * (0.25 + kick * 0.9 + flash * 0.8);
  return col;
}

vec3 grid(vec2 p) {
  float kick = uPulse.x;
  float h = abs(p.y) + 0.0001;
  float z = 0.35 / h;
  float x = p.x * z;
  float width = 0.04 + kick * 0.05 + uAudio.w * 0.03;
  float lineX = 1.0 - smoothstep(0.0, width, abs(fract(x * 0.5) - 0.5));
  float lineZ = 1.0 - smoothstep(0.0, width, abs(fract(z * 0.35 + uTravel * 0.35) - 0.5));
  float line = max(lineX, lineZ) * smoothstep(0.0, 0.18, h);

  vec3 lineColor = mix(uB, uA, clamp(uAudio.w * 1.4 + kick * 0.5, 0.0, 1.0));
  vec3 col = uC * 0.5 * smoothstep(0.6, 0.0, h);
  col += lineColor * line * (0.7 + uAudio.y);
  col += uB * exp(-h * 9.0) * (0.35 + kick * 0.6 + uPulse.z * 0.5);
  return col;
}

vec3 strobe(vec2 p) {
  float kick = uPulse.x;
  float armed = uPulse.w;
  float k = pow(kick, 1.5);
  float d = max(abs(p.x), abs(p.y));
  float ring = abs(fract(d * 3.0 - uTravel * 0.4) - 0.5) * 2.0;
  float shape = smoothstep(0.55, 0.95, ring);

  vec3 col = uC * 0.4;
  col += mix(uB, uA, ring) * shape * (0.25 + k * 1.1);
  float bars = step(0.5, fract(p.x * 5.0 + floor(uTravel * 0.5) * 0.37));
  col += mix(uA, uB, bars) * pow(kick, 3.0) * 0.9 * armed;
  return col;
}

vec3 rift(vec2 p) {
  float kick = uPulse.x;
  float rows = 28.0;
  float rowPos = (p.y * 0.9 + 0.5) * rows;
  float row = floor(rowPos);
  float rnd = hash(row + floor(uTime * 8.0 * (0.2 + uAudio.x)) * 13.0);
  float shift = (rnd - 0.5) * (uAudio.x * 0.9 + kick * 0.6 + uPulse.z * 0.6) * (0.4 + uWarp);
  float x = p.x + shift;

  float band = sin(x * 9.0 + uTravel) * 0.5 + 0.5;
  float bars = smoothstep(0.45, 0.55, sin(x * 14.0 + row * 0.4 + uTravel * 0.6) * 0.5 + 0.5);
  float gap = smoothstep(0.0, 0.06, fract(rowPos)) * smoothstep(1.0, 0.94, fract(rowPos));

  vec3 col = ramp(band * 0.5 + rnd * 0.5) * bars * (0.5 + uAudio.y * 0.7);
  col += uC * 0.4;
  col *= gap;
  col += uA * kick * 0.12 * rnd;
  return col;
}

vec3 backdrop(vec2 p) {
  return uC * (0.25 + 0.2 * uPulse.x) * (1.0 - length(p));
}

vec3 mediaLayer(vec2 p) {
  vec2 q = p;
  if (uKaleido > 0.5) {
    float segment = 6.2831853 / 6.0;
    float angle = atan(q.y, q.x) + uTravel * 0.05;
    angle = abs(mod(angle, segment) - segment * 0.5);
    q = vec2(cos(angle), sin(angle)) * length(q);
  }
  q /= 1.0 + uPulse.x * 0.05;
  q += vec2(sin(q.y * 8.0 + uTravel * 0.8), cos(q.x * 8.0 + uTravel * 0.7)) * uWarp * (0.01 + uAudio.x * 0.04);

  float aspect = uRes.x / uRes.y;
  vec2 scale = aspect > uMediaAspect
    ? vec2(1.0 / aspect, uMediaAspect / aspect)
    : vec2(1.0 / uMediaAspect, 1.0);
  vec2 uv = q * scale + 0.5;
  uv = 1.0 - abs(1.0 - mod(uv, 2.0));

  float split = 0.002 + uAudio.w * 0.01;
  vec3 col = vec3(
    texture(uMedia, uv + vec2(split, 0.0)).r,
    texture(uMedia, uv).g,
    texture(uMedia, uv - vec2(split, 0.0)).b
  );
  return col * (1.0 + uPulse.x * 0.25);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 col;
#if SCENE == 0
  col = portal(p);
#elif SCENE == 1
  col = grid(p);
#elif SCENE == 2
  col = strobe(p);
#elif SCENE == 3
  col = rift(p);
#else
  col = backdrop(p);
#endif
  if (uHasMedia > 0.5) {
    vec3 layer = mediaLayer(p);
    col = 1.0 - (1.0 - col) * (1.0 - layer * uMediaMix);
  }
  col *= 1.0 - 0.35 * dot(p, p);
  outColor = vec4(col, 1.0);
}
`
