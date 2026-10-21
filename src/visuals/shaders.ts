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
  bars: 5,
  aurora: 6,
  warp: 7,
  lasers: 8,
  bloom: 9,
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

float spectrum(float t) {
  float levels[4] = float[4](uAudio.x, uAudio.y, uAudio.z, uAudio.w);
  float x = clamp(t, 0.0, 1.0) * 3.0;
  int i = int(min(floor(x), 2.0));
  return mix(levels[i], levels[i + 1], smoothstep(0.0, 1.0, x - float(i)));
}

vec3 bars(vec2 p) {
  float kick = uPulse.x;
  float aspect = uRes.x / uRes.y;
  float u = p.x / aspect + 0.5 + sin(p.y * 7.0 + uTravel) * uWarp * uAudio.x * 0.015;
  float columns = 40.0;
  float cell = floor(u * columns);
  float local = fract(u * columns);
  float t = abs((cell + 0.5) / columns - 0.5) * 2.0;
  float flutter = 0.7 + 0.3 * sin(uTime * (2.0 + hash(cell) * 4.0) + cell * 1.7);
  float height = 0.04 + spectrum(t) * 0.38 * flutter + kick * 0.05;
  float d = abs(p.y);
  float body = smoothstep(height, height - 0.012, d);
  float gap = smoothstep(0.0, 0.14, local) * smoothstep(1.0, 0.86, local);
  vec3 tint = mix(uA, uB, clamp(d / max(height, 0.001), 0.0, 1.0));

  vec3 col = uC * 0.5;
  col += tint * body * gap * (0.7 + kick * 0.5 + uPulse.z * 0.3);
  col += uB * exp(-max(d - height, 0.0) * 18.0) * gap * 0.22 * (0.4 + kick);
  col += uA * exp(-d * 30.0) * 0.12;
  return col;
}

vec3 aurora(vec2 p) {
  float kick = uPulse.x;
  float open = uPulse.y;
  float t = uTravel * 0.18;
  float sway = 0.2 + uWarp * uAudio.x * 0.3;
  float glow = 0.55 + uAudio.z * 0.6 + kick * 0.35 + open * 0.25;

  vec3 col = uC * (0.55 + 0.6 * (p.y + 0.5));
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x = p.x * (1.0 + fi * 0.3) + sin(p.y * (2.0 + fi * 0.8) + t * (1.0 + fi * 0.35) + fi * 2.1) * sway;
    float ribbon = exp(-abs(sin(x * 3.2 + fi * 1.3 + t * 0.6)) * (4.5 + fi * 1.2));
    float rays = 0.6 + 0.4 * sin(x * 34.0 + t * 2.0 + fi * 3.0);
    float lift = smoothstep(-0.6, 0.1, p.y) * smoothstep(0.8, 0.05, p.y + fi * 0.06);
    col += ramp(0.3 + fi * 0.22 + uAudio.w * 0.15) * ribbon * rays * lift * glow;
  }
  col += uB * exp(-pow(p.y + 0.5, 2.0) * 10.0) * (0.1 + kick * 0.1);
  return col;
}

vec3 warp(vec2 p) {
  float kick = uPulse.x;
  float radius = length(p);
  float angle = atan(p.y, p.x) + uWarp * uAudio.x * 1.2 * radius;

  vec3 col = uC * (0.6 - radius * 0.5);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sectors = 36.0 + fi * 22.0;
    float slice = 6.2831853 / sectors;
    float sector = floor(angle / slice);
    float across = fract(angle / slice) - 0.5;
    float seed = sector * 1.37 + fi * 17.1;
    float jitter = (hash(seed) - 0.5) * 0.7;
    float z = fract(hash(seed + 3.3) + uTravel * (0.22 + fi * 0.1));
    float head = z * z * 0.9;
    float trailLength = (0.03 + z * 0.22) * (1.0 + kick * 1.2 + uAudio.x * 0.8);
    float trail = (head - radius) / trailLength;
    float inTrail = step(0.0, trail) * step(trail, 1.0) * (1.0 - trail);
    float width = 0.0015 + z * 0.004;
    float dist = abs(across - jitter) * slice * max(radius, 0.001);
    float beam = smoothstep(width, 0.0, dist) * inTrail;
    col += mix(uB, uA, z) * beam * (0.5 + z * 1.6);
  }
  col += uA * exp(-radius * 5.0) * (0.12 + kick * 0.5);
  return col;
}

vec3 lasers(vec2 p) {
  float kick = uPulse.x;
  float spread = 0.1 + uAudio.w * 0.04 + kick * 0.03;
  float sweep = 0.35 + uWarp * uAudio.x * 0.5;

  vec3 col = uC * (0.6 - 0.5 * length(p));
  for (int s = 0; s < 2; s++) {
    float side = 1.0 - 2.0 * float(s);
    vec2 rel = p - vec2(0.0, 0.62 * side);
    float angle = atan(rel.x, -rel.y * side);
    float fade = exp(-length(rel) * 0.65);
    for (int k = 0; k < 9; k++) {
      float fk = float(k) - 4.0;
      float aim = fk * spread + sin(uTravel * 0.45 + fk * 0.8 + float(s) * 2.0) * sweep;
      float off = abs(angle - aim);
      float core = smoothstep(0.014, 0.0, off);
      float halo = exp(-off * 14.0) * 0.22;
      col += ramp(0.5 + fk * 0.1 + float(s) * 0.2) * (core * 1.5 + halo) * fade * (0.55 + kick * 1.0 + uAudio.y * 0.4);
    }
  }
  return col;
}

vec3 bloom(vec2 p) {
  float kick = uPulse.x;
  float radius = length(p);
  float angle = atan(p.y, p.x);

  vec3 col = uC * (0.8 - radius * 0.8);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float petals = 5.0 + fi * 2.0;
    float direction = 1.0 - 2.0 * mod(fi, 2.0);
    float lobe = 0.5 + 0.5 * cos(petals * angle + uTravel * (0.14 + fi * 0.05) * direction + fi);
    float wobble = uWarp * uAudio.x * 0.08 * sin(angle * 3.0 + uTravel);
    float ringRadius = (0.09 + fi * 0.1) * (0.55 + 0.45 * lobe + uAudio.z * 0.18) * (1.0 + kick * 0.1) + wobble;
    float shine = exp(-abs(radius - ringRadius) * (70.0 - fi * 8.0));
    col += ramp(fi / 4.0 + uAudio.y * 0.25) * shine * (0.45 + uAudio.y * 0.6 + kick * 0.5);
  }
  col += uA * exp(-radius * 8.0) * (0.18 + kick * 0.7);
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
#elif SCENE == 5
  col = bars(p);
#elif SCENE == 6
  col = aurora(p);
#elif SCENE == 7
  col = warp(p);
#elif SCENE == 8
  col = lasers(p);
#elif SCENE == 9
  col = bloom(p);
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
