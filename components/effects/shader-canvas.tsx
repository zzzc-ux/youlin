"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * 通用全屏片元着色器画布。
 *
 * 自动提供的 uniform：
 *   uTime        秒
 *   uResolution  画布像素尺寸
 *   uMouse       指针位置（0~1，左下为原点），带平滑
 *   uMouseActive 指针是否在画布上（0~1，带平滑）
 * 其余 uniform 通过 uniforms 传入，数字对应 float，数组对应 vec2/vec3/vec4。
 *
 * 不在视口内或页面隐藏时暂停；用户开启“减少动态效果”时只渲染一帧。
 */
export type ShaderUniforms = Record<string, number | number[]>;

type ShaderCanvasProps = {
  fragment: string;
  uniforms?: ShaderUniforms;
  className?: string;
  /** 最大像素比，背景类效果不需要太高 */
  maxDpr?: number;
  /** 时间流速倍率 */
  speed?: number;
  /** 指针移动事件挂在 window 上（背景位于其他元素下方时使用） */
  trackWindowPointer?: boolean;
  onUnsupported?: () => void;
};

const VERTEX = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("着色器编译失败：", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ShaderCanvas({
  fragment,
  uniforms,
  className,
  maxDpr = 1.5,
  speed = 1,
  trackWindowPointer = true,
  onUnsupported,
}: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniformsRef = useRef<ShaderUniforms | undefined>(uniforms);
  uniformsRef.current = uniforms;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const unsupportedRef = useRef(onUnsupported);
  unsupportedRef.current = onUnsupported;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      unsupportedRef.current?.();
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!(vs && fs && program)) {
      unsupportedRef.current?.();
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("着色器链接失败：", gl.getProgramInfoLog(program));
      unsupportedRef.current?.();
      return;
    }
    gl.useProgram(program);

    // 一个覆盖全屏的大三角形
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const locations = new Map<string, WebGLUniformLocation | null>();
    const loc = (name: string) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    };

    const setUniform = (name: string, value: number | number[]) => {
      const l = loc(name);
      if (!l) {
        return;
      }
      if (typeof value === "number") {
        gl.uniform1f(l, value);
      } else if (value.length === 2) {
        gl.uniform2fv(l, value);
      } else if (value.length === 3) {
        gl.uniform3fv(l, value);
      } else if (value.length === 4) {
        gl.uniform4fv(l, value);
      }
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { active: 0, targetActive: 0, tx: 0.5, ty: 0.5, x: 0.5, y: 0.5 };
    let width = 1;
    let height = 1;
    let frame = 0;
    let visible = true;
    let elapsed = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      if (reduced) {
        draw();
      }
    };

    const draw = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      mouse.active += (mouse.targetActive - mouse.active) * 0.05;
      setUniform("uTime", reduced ? 12 : elapsed);
      setUniform("uResolution", [width, height]);
      setUniform("uMouse", [mouse.x, mouse.y]);
      setUniform("uMouseActive", mouse.active);
      for (const [name, value] of Object.entries(uniformsRef.current ?? {})) {
        setUniform(name, value);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (visible && !document.hidden) {
        elapsed += dt * speedRef.current;
        draw();
      }
      frame = requestAnimationFrame(loop);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      mouse.tx = x;
      mouse.ty = y;
      mouse.targetActive = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? 1 : 0;
    };
    const onPointerLeave = () => {
      mouse.targetActive = 0;
    };

    const target: Window | HTMLCanvasElement = trackWindowPointer ? window : canvas;
    target.addEventListener("pointermove", onPointerMove as EventListener);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    intersection.observe(canvas);

    resize();
    if (reduced) {
      draw();
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      target.removeEventListener("pointermove", onPointerMove as EventListener);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [fragment, maxDpr, trackWindowPointer]);

  return (
    <canvas
      aria-hidden="true"
      className={cn("pointer-events-none block size-full", className)}
      ref={canvasRef}
    />
  );
}
