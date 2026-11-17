"use client";

import { useMemo } from "react";
import { ShaderCanvas } from "./shader-canvas";

/**
 * 星河背景：多层视差星空，缓慢旋转并向观察者推进，星星会闪烁，
 * 亮星带十字星芒；指针附近的星星被轻轻推开。
 */
const FRAGMENT = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uDensity;
uniform float uGlow;
uniform float uHue;
uniform float uSaturation;
uniform float uTwinkle;
uniform float uRepulsion;
uniform float uBrightness;

const float LAYERS = 4.0;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return vec2(n, hash21(p + n));
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

// 单颗星：发光核心 + 亮星的十字星芒
float star(vec2 p, float flare) {
  float d = length(p);
  float core = 0.018 * uGlow / max(d, 0.001);
  float rays = max(0.0, 1.0 - abs(p.x * p.y * 900.0));
  core += rays * flare;
  p *= rot(0.785398);
  rays = max(0.0, 1.0 - abs(p.x * p.y * 900.0));
  core += rays * 0.35 * flare;
  return core * smoothstep(0.5, 0.05, d);
}

vec3 starLayer(vec2 uv, float layerSeed) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offs = vec2(float(x), float(y));
      vec2 cell = id + offs;
      float seed = hash21(cell + layerSeed);
      // 稀疏化：只有一部分格子有星
      if (seed > uDensity) {
        continue;
      }
      vec2 jitter = hash22(cell * 1.7 + layerSeed) - 0.5;
      float size = fract(seed * 345.32);
      float flare = smoothstep(0.85, 1.0, size) * 0.6;
      float twinkle = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (1.2 + seed * 3.0) + seed * 40.0));
      float s = star(gv - offs - jitter * 0.8, flare) * twinkle;
      float hue = fract(uHue + seed * 0.18 - 0.09);
      vec3 tint = hsv2rgb(vec3(hue, uSaturation * (0.4 + 0.6 * fract(seed * 91.7)), 1.0));
      col += s * mix(vec3(1.0), tint, 0.85) * (0.4 + size);
    }
  }
  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;
  vec2 mouse = (uMouse * uResolution - 0.5 * uResolution) / uResolution.y;

  // 指针附近的星向外推开
  vec2 toMouse = uv - mouse;
  float md = length(toMouse);
  uv += normalize(toMouse + 1e-5) * uRepulsion * uMouseActive * exp(-md * 6.0) * 0.08;

  // 整体缓慢旋转 + 随指针轻微视差
  uv *= rot(uTime * 0.012);
  vec3 col = vec3(0.0);
  for (float i = 0.0; i < 1.0; i += 1.0 / LAYERS) {
    float depth = fract(i + uTime * 0.012);
    float scale = mix(18.0, 0.8, depth);
    float fade = depth * smoothstep(1.0, 0.85, depth);
    vec2 par = (uMouse - 0.5) * (0.04 + depth * 0.08);
    col += starLayer(uv * scale + i * 453.2 + par * scale, i * 17.0) * fade;
  }

  col *= uBrightness;
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(alpha)), alpha);
}
`;

type GalaxyProps = {
  className?: string;
  /** 星星密度 0~1 */
  density?: number;
  /** 发光强度 */
  glow?: number;
  /** 主色调 0~1（0.62 偏蓝紫） */
  hue?: number;
  saturation?: number;
  /** 闪烁强度 0~1 */
  twinkle?: number;
  /** 指针排斥强度 */
  repulsion?: number;
  brightness?: number;
  speed?: number;
  onUnsupported?: () => void;
};

export function Galaxy({
  className,
  density = 0.55,
  glow = 1,
  hue = 0.66,
  saturation = 0.55,
  twinkle = 0.6,
  repulsion = 1.5,
  brightness = 1,
  speed = 1,
  onUnsupported,
}: GalaxyProps) {
  const uniforms = useMemo(
    () => ({
      uBrightness: brightness,
      uDensity: density,
      uGlow: glow,
      uHue: hue,
      uRepulsion: repulsion,
      uSaturation: saturation,
      uTwinkle: twinkle,
    }),
    [brightness, density, glow, hue, repulsion, saturation, twinkle]
  );
  return (
    <ShaderCanvas
      className={className}
      fragment={FRAGMENT}
      onUnsupported={onUnsupported}
      speed={speed}
      uniforms={uniforms}
    />
  );
}
