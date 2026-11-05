import {useEffect, useMemo, useRef, useState} from 'react';

/** Velaris-based WebGL1 simplex-noise gradient, scoped to the campus hero. */
export const VELARIS_VERTEX_SHADER = "attribute vec2 position;\nvarying vec2 vUv;\nvoid main() {\n  vUv = position * 0.5 + 0.5;\n  gl_Position = vec4(position, 0.0, 1.0);\n}";
export const VELARIS_FRAGMENT_SHADER = "precision highp float;\nvarying vec2 vUv;\nuniform vec2 u_resolution;\nuniform float u_time;\nuniform float u_grain;\nuniform vec3 u_colors[4];\nuniform vec3 u_bg;\n\nvec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }\n\nfloat snoise(vec2 v) {\n  const vec4 C = vec4(0.211324865405187, 0.366025403784439,\n    -0.577350269189626, 0.024390243902439);\n  vec2 i = floor(v + dot(v, C.yy));\n  vec2 x0 = v - i + dot(i, C.xx);\n  vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n  vec4 x12 = x0.xyxy + C.xxzz;\n  x12.xy -= i1;\n  i = mod(i, 289.0);\n  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))\n    + i.x + vec3(0.0, i1.x, 1.0));\n  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),\n    dot(x12.zw,x12.zw)), 0.0);\n  m = m * m;\n  m = m * m;\n  vec3 x = 2.0 * fract(p * C.www) - 1.0;\n  vec3 h = abs(x) - 0.5;\n  vec3 ox = floor(x + 0.5);\n  vec3 a0 = x - ox;\n  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);\n  vec3 g;\n  g.x = a0.x * x0.x + h.x * x0.y;\n  g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n  return 130.0 * dot(m, g);\n}\n\nvoid main() {\n  vec2 uv = vUv;\n  float ratio = u_resolution.x / max(u_resolution.y, 1.0);\n  vec2 p = uv - 0.5;\n  p.x *= ratio;\n\n  float t = u_time * 0.1;\n  float n1 = snoise(p * 0.4 + vec2(t * 0.2, -t * 0.3));\n  float n2 = snoise(p * 0.55 + vec2(-t * 0.15, t * 0.25) + n1 * 0.25);\n  float n3 = snoise(p * 0.75 + vec2(t * 0.1, -t * 0.2) + n2 * 0.2);\n\n  vec3 col = u_bg;\n  float dist = length(p) * 1.5;\n  float vignette = 1.0 - smoothstep(0.3, 1.2, dist);\n  col = mix(col, u_colors[0], smoothstep(-0.2, 0.5, n1) * 0.85);\n  col = mix(col, u_colors[1], smoothstep(-0.1, 0.6, n2) * 0.7);\n  col = mix(col, u_colors[2], smoothstep(-0.3, 0.4, n3) * 0.6);\n  col = mix(col, u_colors[3], smoothstep(0.0, 0.7, n1 * n2) * 0.5);\n\n  float glow = smoothstep(0.8, 0.0, dist) * 0.3;\n  col += u_colors[1] * glow;\n  col = mix(col * 0.2, col, vignette);\n\n  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time);\n  col += (grain - 0.5) * u_grain * 0.1;\n  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);\n}";

const DEFAULT_COLORS = ['#315CE5','#10213B','#6C8FF7','#CFDDFC'];
const HEX_COLOR = /^#[\da-f]{6}$/i;

export function hexToUnitRGB(value) {
  const color = HEX_COLOR.test(value) ? value.slice(1) : '101B2C';
  return [
    Number.parseInt(color.slice(0, 2), 16) / 255,
    Number.parseInt(color.slice(2, 4), 16) / 255,
    Number.parseInt(color.slice(4, 6), 16) / 255,
  ];
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader creation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(detail || 'WebGL shader compilation failed');
  }
  return shader;
}

export default function VelarisGradient({
  className = '',
  colors = DEFAULT_COLORS,
  background = '#07162C',
  speed = 0.42,
  grain = 0.16,
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [animate, setAnimate] = useState(false);
  const [contextEpoch, setContextEpoch] = useState(0);
  const colorsKey = colors.join('|');
  const palette = useMemo(() => {
    const complete = Array.from({length: 4}, (_, i) => colors[i] || DEFAULT_COLORS[i]);
    return new Float32Array(complete.flatMap(hexToUnitRGB));
  }, [colorsKey]);
  const backgroundRGB = useMemo(() => hexToUnitRGB(background), [background]);

  // Keep the branded CSS gradient for reduced-motion, small screens and WebGL failures.
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const wide = window.matchMedia('(min-width: 900px)');
    const update = () => setAnimate(!motion.matches && wide.matches);
    update();
    motion.addEventListener?.('change', update);
    wide.addEventListener?.('change', update);
    return () => {
      motion.removeEventListener?.('change', update);
      wide.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!animate || !canvas || !wrapper) return undefined;

    let gl, vertex, fragment, program, buffer;
    try {
      gl = canvas.getContext('webgl', {
        alpha: false, antialias: false, depth: false, stencil: false,
        preserveDrawingBuffer: false, powerPreference: 'low-power',
      });
      if (!gl) return undefined;
      vertex = compile(gl, gl.VERTEX_SHADER, VELARIS_VERTEX_SHADER);
      fragment = compile(gl, gl.FRAGMENT_SHADER, VELARIS_FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error('WebGL program creation failed');
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'WebGL program link failed');
      }
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error('WebGL buffer creation failed');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, 1, 1,
      ]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      if (position < 0) throw new Error('WebGL vertex attribute not found');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    } catch {
      // This is decorative. Preserve the static CSS background on any GL error.
      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
      }
      return undefined;
    }

    // Uniform array lookup needs the [0] suffix on WebGL1 implementations.
    const uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      grain: gl.getUniformLocation(program, 'u_grain'),
      colors: gl.getUniformLocation(program, 'u_colors[0]'),
      bg: gl.getUniformLocation(program, 'u_bg'),
    };
    gl.uniform3fv(uniforms.colors, palette);
    gl.uniform3f(uniforms.bg, ...backgroundRGB);
    gl.uniform1f(uniforms.grain, Math.min(0.4, Math.max(0, grain)));

    let frame = 0;
    let visible = false;
    let lastDraw = -Infinity;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.min(2048, Math.max(1, Math.round(wrapper.clientWidth * dpr)));
      const height = Math.min(512, Math.max(1, Math.round(wrapper.clientHeight * dpr)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(uniforms.resolution, width, height);
      }
    };
    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const draw = (timestamp) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (timestamp - lastDraw >= 1000 / 30) {
        resize();
        gl.uniform1f(uniforms.time, timestamp * 0.001 * speed);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        canvas.style.opacity = '1';
        lastDraw = timestamp;
      }
      frame = window.requestAnimationFrame(draw);
    };
    const start = () => {
      if (!frame && visible && !document.hidden) frame = window.requestAnimationFrame(draw);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    const onLost = (event) => {
      event.preventDefault();
      stop();
      canvas.style.opacity = '0';
    };
    const onRestored = () => setContextEpoch(n => n + 1);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', onVisibility);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(wrapper);
    window.addEventListener('resize', resize);
    resize();

    const intersection = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
        visible = !!entries[0]?.isIntersecting;
        if (visible) start();
        else stop();
      }, {threshold: 0.01}) : null;
    if (intersection) intersection.observe(wrapper);
    else { visible = true; start(); }

    return () => {
      stop();
      intersection?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      canvas.style.opacity = '0';
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [animate, contextEpoch, palette, backgroundRGB, speed, grain]);

  return <div ref={wrapperRef} className={'cx-velaris ' + className} aria-hidden="true">
    <canvas ref={canvasRef} className="cx-velaris-canvas"/>
  </div>;
}
