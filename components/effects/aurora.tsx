"use client";

import { useMemo } from "react";
import { ShaderCanvas } from "./shader-canvas";

/**
 * 极光背景：三层随噪声起伏的光幕，下缘清晰、上缘柔和，带竖向光柱纹理。
 * 颜色沿横向在三个色标之间渐变。
 */
const FRAGMENT = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uIntensity;
uniform float uHeight;

// 2D simplex noise，来自 Ashima Arts（MIT 许可）
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 ramp(float t) {
  return t < 0.5 ? mix(uColorA, uColorB, t * 2.0) : mix(uColorB, uColorC, t * 2.0 - 1.0);
}

float curtain(vec2 uv, float k) {
  float t = uTime;
  // 光幕下缘高度随噪声起伏
  float wave = snoise(vec2(uv.x * 1.3 + t * 0.045 * (1.0 + k), t * 0.11 + k * 7.0)) * 0.11
             + snoise(vec2(uv.x * 3.1 - t * 0.07, k * 3.0)) * 0.035;
  float edge = uHeight + wave + k * 0.05;
  float d = uv.y - edge;
  // 下缘锐利、向上缓慢衰减
  float body = d > 0.0 ? exp(-d * (4.5 + k * 2.0)) : exp(-d * d * 260.0);
  // 竖向光柱
  float rays = 0.55 + 0.45 * snoise(vec2(uv.x * 14.0 + k * 5.0, t * 0.25 + uv.y * 0.6));
  return body * rays;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // 指针靠近时光幕微微抬升、变亮
  float lift = uMouseActive * exp(-abs(uv.x - uMouse.x) * 4.0) * 0.04;
  vec2 p = vec2(uv.x * (uResolution.x / uResolution.y) * 0.6, uv.y - lift);

  float a = curtain(p, 0.0);
  float b = curtain(p + vec2(0.37, 0.0), 1.0) * 0.7;
  float c = curtain(p - vec2(0.21, 0.0), 2.0) * 0.45;

  vec3 col = ramp(uv.x) * a + ramp(fract(uv.x + 0.33)) * b + ramp(fract(uv.x + 0.66)) * c;
  col *= uIntensity * (1.0 + uMouseActive * 0.15);
  float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(min(col, vec3(alpha)), alpha);
}
`;

function hexToRgb(hex: string): number[] {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

type AuroraProps = {
  className?: string;
  colors?: [string, string, string];
  intensity?: number;
  /** 光幕下缘位置，0 为底部，1 为顶部 */
  height?: number;
  speed?: number;
};

export function Aurora({
  className,
  colors = ["#5b5bf6", "#a855f7", "#22d3ee"],
  intensity = 0.9,
  height = 0.62,
  speed = 1,
}: AuroraProps) {
  const [a, b, c] = colors;
  const uniforms = useMemo(
    () => ({
      uColorA: hexToRgb(a),
      uColorB: hexToRgb(b),
      uColorC: hexToRgb(c),
      uHeight: height,
      uIntensity: intensity,
    }),
    [a, b, c, height, intensity]
  );
  return (
    <ShaderCanvas
      className={className}
      fragment={FRAGMENT}
      maxDpr={1}
      speed={speed}
      uniforms={uniforms}
    />
  );
}
