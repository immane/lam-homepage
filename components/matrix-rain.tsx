"use client";

import { useEffect, useRef } from "react";

const characters =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const glyphs = characters.split("");
const atlasColumns = 16;
const atlasRows = Math.ceil(glyphs.length / atlasColumns);

type Stream = {
  elapsed: number;
  glyphs: string[];
  head: number;
  initialHead: number;
  length: number;
  random: () => number;
  seed: number;
  speed: number;
};

type Glyph = {
  alpha: number;
  character: number;
  head: number;
  x: number;
  y: number;
};

type Renderer = {
  draw: (items: Glyph[]) => void;
  destroy: () => void;
};

function createSeededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createGlyphAtlas() {
  const cellSize = 32;
  const atlas = document.createElement("canvas");
  atlas.width = atlasColumns * cellSize;
  atlas.height = atlasRows * cellSize;
  const context = atlas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, atlas.width, atlas.height);
  context.fillStyle = "#ffffff";
  context.font = `24px "Geist Mono", monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  glyphs.forEach((glyph, index) => {
    const column = index % atlasColumns;
    const row = Math.floor(index / atlasColumns);
    context.fillText(glyph, column * cellSize + cellSize / 2, row * cellSize + cellSize / 2);
  });

  return atlas;
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function createWebGlRenderer(canvas: HTMLCanvasElement, pixelRatio: number): Renderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  const atlas = createGlyphAtlas();
  if (!gl || !atlas) return null;

  const vertexShader = createShader(
    gl,
    gl.VERTEX_SHADER,
    `
      attribute vec4 aGlyph;
      uniform vec2 uResolution;
      uniform float uPointSize;
      varying float vCharacter;
      varying float vAlpha;
      varying float vHead;

      void main() {
        vec2 position = (aGlyph.xy / uResolution) * 2.0 - 1.0;
        gl_Position = vec4(position.x, -position.y, 0.0, 1.0);
        gl_PointSize = uPointSize;
        vCharacter = aGlyph.z;
        vAlpha = aGlyph.w;
        vHead = aGlyph.w > 0.95 ? 1.0 : 0.0;
      }
    `,
  );
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    `
      precision mediump float;
      uniform sampler2D uAtlas;
      uniform float uIntensity;
      varying float vCharacter;
      varying float vAlpha;
      varying float vHead;

      void main() {
        float column = mod(vCharacter, ${atlasColumns.toFixed(1)});
        float row = floor(vCharacter / ${atlasColumns.toFixed(1)});
        vec2 uv = (vec2(column, row) + gl_PointCoord) / vec2(${atlasColumns.toFixed(1)}, ${atlasRows.toFixed(1)});
        float mask = texture2D(uAtlas, uv).a;
        vec3 trail = vec3(0.02, 1.0, 0.32);
        vec3 head = vec3(0.82, 1.0, 0.87);
        vec3 color = mix(trail, head, vHead);
        gl_FragColor = vec4(color * uIntensity, mask * vAlpha * uIntensity);
      }
    `,
  );
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !texture) {
    gl.deleteProgram(program);
    return null;
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const position = gl.getAttribLocation(program, "aGlyph");
  const resolution = gl.getUniformLocation(program, "uResolution");
  const pointSize = gl.getUniformLocation(program, "uPointSize");
  const intensity = gl.getUniformLocation(program, "uIntensity");
  const atlasTexture = gl.getUniformLocation(program, "uAtlas");
  if (position < 0 || !resolution || !pointSize || !intensity || !atlasTexture) {
    gl.deleteBuffer(buffer);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);
  gl.uniform1i(atlasTexture, 0);
  gl.enable(gl.BLEND);

  return {
    draw(items) {
      const data = new Float32Array(items.length * 4);
      items.forEach((item, index) => {
        const offset = index * 4;
        data[offset] = item.x * pixelRatio;
        data[offset + 1] = item.y * pixelRatio;
        data[offset + 2] = item.character;
        data[offset + 3] = item.head ? 1 : item.alpha;
      });

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(resolution, canvas.width, canvas.height);

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.uniform1f(pointSize, 34 * pixelRatio);
      gl.uniform1f(intensity, 0.07);
      gl.drawArrays(gl.POINTS, 0, items.length);

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(pointSize, 17 * pixelRatio);
      gl.uniform1f(intensity, 1);
      gl.drawArrays(gl.POINTS, 0, items.length);
    },
    destroy() {
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    },
  };
}

function createCanvasRenderer(canvas: HTMLCanvasElement, pixelRatio: number): Renderer | null {
  const context = canvas.getContext("2d");
  if (!context) return null;

  return {
    draw(items) {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = '16px "Geist Mono", monospace';
      context.textAlign = "center";
      context.textBaseline = "top";
      items.forEach((item) => {
        context.fillStyle = item.head
          ? "rgba(220, 255, 225, 0.98)"
          : `rgba(0, 255, 82, ${item.alpha})`;
        context.shadowColor = item.head ? "rgba(90, 255, 125, 0.75)" : "transparent";
        context.shadowBlur = item.head ? 10 : 0;
        context.fillText(glyphs[item.character], item.x, item.y);
      });
      context.shadowBlur = 0;
    },
    destroy() {},
  };
}

export function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fontSize = 16;
    const columnWidth = 18;
    let animationFrame = 0;
    let lastFrame = performance.now();
    let rows = 0;
    let streams: Stream[] = [];
    let renderer: Renderer | null = null;

    const nextGlyph = (stream: Stream) => glyphs[Math.floor(stream.random() * glyphs.length)];

    const resetStream = (stream: Stream) => {
      stream.random = createSeededRandom(stream.seed);
      stream.speed = 42 + Math.floor(stream.random() * 58);
      stream.length = 16 + Math.floor(stream.random() * 24);
      stream.initialHead = -stream.length - Math.floor(stream.random() * Math.max(rows, 1));
      stream.head = stream.initialHead;
      stream.elapsed = 0;
      stream.glyphs = Array.from({ length: stream.length }, () => nextGlyph(stream));
    };

    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * pixelRatio;
      canvas.height = height * pixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      rows = Math.ceil(height / fontSize);
      streams = Array.from({ length: Math.ceil(width / columnWidth) }, (_, index) => {
        const stream: Stream = {
          elapsed: 0,
          glyphs: [],
          head: 0,
          initialHead: 0,
          length: 0,
          random: createSeededRandom(index + 1),
          seed: index + 1,
          speed: 0,
        };
        resetStream(stream);
        return stream;
      });

      renderer?.destroy();
      renderer = createWebGlRenderer(canvas, pixelRatio) ?? createCanvasRenderer(canvas, pixelRatio);
    };

    const draw = (timestamp: number) => {
      const elapsed = Math.min(timestamp - lastFrame, 100);
      lastFrame = timestamp;
      const items: Glyph[] = [];

      streams.forEach((stream, column) => {
        stream.elapsed += elapsed;
        while (stream.elapsed >= stream.speed) {
          stream.elapsed -= stream.speed;
          stream.head += 1;
          stream.glyphs.unshift(nextGlyph(stream));
          stream.glyphs.length = stream.length;
        }

        if (stream.head - stream.length > rows) resetStream(stream);

        stream.glyphs.forEach((glyph, offset) => {
          const row = stream.head - offset;
          if (row < 0 || row >= rows) return;
          const intensity = 1 - offset / stream.length;
          items.push({
            alpha: 0.045 + intensity * intensity * 0.42,
            character: glyphs.indexOf(glyph),
            head: offset === 0 ? 1 : 0,
            x: column * columnWidth + columnWidth / 2,
            y: row * fontSize,
          });
        });
      });

      renderer?.draw(items);
      animationFrame = requestAnimationFrame(draw);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      renderer?.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none opacity-45" style={{ zIndex: 0 }} />;
}
