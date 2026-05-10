import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { constellations, islandFeatures, VOYAGE_POSITION } from './taumakoData.js';
import { brightFieldStars } from './brightStars.js';

const STAR_GOLD = '#ffe51e';
const STAR_LINE = '#807818';
const ARC_BLUE = '#1c8dff';
const GRID_BLUE = '#66bdff';
const SKY_RADIUS_EARTH_RADII = 500;
const SKY_HORIZON_Y = 55.5;
const BOAT_ASPECT_RATIO = 512 / 1074;
const STELLARIUM_CAMERA_RADIUS = 1;
const STELLARIUM_CAMERA_NEAR = 0.0001;
const STELLARIUM_CAMERA_FAR = SKY_RADIUS_EARTH_RADII * 4;
const STELLARIUM_OCEAN_RADIUS = SKY_RADIUS_EARTH_RADII * 0.94;
const STELLARIUM_OCEAN_OPACITY = 0.72;
const STELLARIUM_OCEAN_COLOR = '#06194f';
const STELLARIUM_HORIZON_ALTITUDE = THREE.MathUtils.degToRad(-0.35);
const SEASONAL_TILT_DEGREES = 23.4;
const REFERENCE_LST_HOURS = 11;
const SURFACE_ALTITUDE_METERS = 0;
const DEBUG_CAMERA_TRANSITIONS = false;
const ASSET_BASE_URL = import.meta.env.BASE_URL || '/';

let starTexture;

function assetUrl(path) {
  return `${ASSET_BASE_URL}${path.replace(/^\/+/, '')}`;
}

const SKY_VERTEX_PROJECT = `
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(clip.xy, clip.w * 0.999999, clip.w);
`;

function makeSkyLineMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      void main() {
        ${SKY_VERTEX_PROJECT}
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function makeSkyWideLineMaterial(color, opacity, width) {
  const material = new LineMaterial({
    color,
    linewidth: width,
    opacity,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  material.vertexShader = material.vertexShader.replace(
    'gl_Position = clip;',
    'gl_Position = vec4( clip.xy, clip.w * 0.999999, clip.w );',
  );
  material.needsUpdate = true;
  return material;
}

function makeSkyFieldStarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: getStarTexture() },
      uOpacity: { value: 0.78 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float alpha;
      attribute float starSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = alpha;
        ${SKY_VERTEX_PROJECT}
        gl_PointSize = starSize;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 texel = texture2D(uMap, gl_PointCoord);
        float alpha = texel.a * uOpacity * vAlpha;
        if (alpha < 0.05) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function makeSkyNamedStarMaterial(size) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(STAR_GOLD) },
      uMap: { value: getStarTexture() },
      uOpacity: { value: 0.95 },
      uSize: { value: size },
    },
    vertexShader: `
      uniform float uSize;
      void main() {
        ${SKY_VERTEX_PROJECT}
        gl_PointSize = uSize;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform sampler2D uMap;
      uniform float uOpacity;
      void main() {
        vec4 texel = texture2D(uMap, gl_PointCoord);
        float alpha = texel.a * uOpacity;
        if (alpha < 0.05) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function makeSkyLabelMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uOpacity: { value: 0.96 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        ${SKY_VERTEX_PROJECT}
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(uMap, vUv);
        float alpha = texel.a * uOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(texel.rgb, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function makeScreenLabelMaterial(texture) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    opacity: 0.96,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function makeStellariumBackground() {
  const material = new THREE.MeshBasicMaterial({
    color: '#020934',
    opacity: 0,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  background.renderOrder = -100;
  return background;
}

function makeSkySolidMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      void main() {
        ${SKY_VERTEX_PROJECT}
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function getStarTexture() {
  if (starTexture) {
    return starTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(48, 48);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 42 : 17;
    const angle = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.fill();

  starTexture = new THREE.CanvasTexture(canvas);
  starTexture.colorSpace = THREE.SRGBColorSpace;
  return starTexture;
}

function bleedTransparentPixels(imageData, width, height, passes = 10) {
  const { data } = imageData;
  const filled = new Uint8Array(width * height);
  const distance = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const offsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  for (let i = 0; i < filled.length; i += 1) {
    if (data[i * 4 + 3] > 0) {
      filled[i] = 1;
      queue[tail] = i;
      tail += 1;
    }
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;

    if (distance[pixel] >= passes) {
      continue;
    }

    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const sourceOffset = pixel * 4;

    offsets.forEach(([offsetX, offsetY]) => {
      const nx = x + offsetX;
      const ny = y + offsetY;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return;
      }

      const neighbor = ny * width + nx;
      if (filled[neighbor]) {
        return;
      }

      const neighborOffset = neighbor * 4;
      data[neighborOffset] = data[sourceOffset];
      data[neighborOffset + 1] = data[sourceOffset + 1];
      data[neighborOffset + 2] = data[sourceOffset + 2];
      filled[neighbor] = 1;
      distance[neighbor] = distance[pixel] + 1;
      queue[tail] = neighbor;
      tail += 1;
    });
  }
}

function loadCompassTexture(onLoad) {
  const canvas = document.createElement('canvas');
  const image = new Image();
  image.onload = () => {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    bleedTransparentPixels(imageData, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    onLoad(texture);
  };
  image.src = assetUrl('/compass.png');
}

function makeLabelTexture(name, association) {
  const canvas = document.createElement('canvas');
  const width = 1024;
  const height = 308;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#ffd75d';
  ctx.font = '700 84px "Trebuchet MS", sans-serif';
  ctx.fillText(name, 36, 120);
  if (association) {
    ctx.shadowBlur = 16;
    ctx.fillStyle = 'rgba(255, 225, 116, 0.92)';
    ctx.font = '500 48px "Trebuchet MS", sans-serif';
    ctx.fillText(association, 40, 196);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.aspect = width / height;
  return texture;
}

function makeIslandLabelTexture(name) {
  const canvas = document.createElement('canvas');
  const width = 1024;
  const height = 336;
  const lines = String(name).split('\n');
  const fontSize = lines.length > 1 ? 70 : 84;
  const lineHeight = fontSize * 1.02;
  const blockHeight = lineHeight * lines.length;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#f5f8ff';
  ctx.font = `700 ${fontSize}px "Trebuchet MS", sans-serif`;

  const startY = height / 2 - blockHeight / 2 + lineHeight / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.aspect = width / height;
  return texture;
}

function lngLatToGlobeVector({ lng, lat }) {
  const lngRad = THREE.MathUtils.degToRad(lng);
  const latRad = THREE.MathUtils.degToRad(lat);
  const cosLat = Math.cos(latRad);
  return new THREE.Vector3(
    Math.sin(lngRad) * cosLat,
    Math.sin(latRad),
    Math.cos(lngRad) * cosLat,
  ).normalize();
}

function makeLocalSkyBasis(location) {
  const up = lngLatToGlobeVector(location);
  let east = new THREE.Vector3(up.z, 0, -up.x);

  if (east.lengthSq() < 0.000001) {
    east = new THREE.Vector3(1, 0, 0);
  }

  east.normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();

  return {
    up,
    east,
    south: north.clone().negate(),
  };
}

const VOYAGE_SKY_BASIS = makeLocalSkyBasis(VOYAGE_POSITION);

function pctToSkyPosition(x, y, radius = SKY_RADIUS_EARTH_RADII) {
  const azimuth = THREE.MathUtils.degToRad(((x - 50) / 50) * 82);
  const altitude = THREE.MathUtils.degToRad(((SKY_HORIZON_Y - y) / SKY_HORIZON_Y) * 78);
  const horizontal = Math.cos(altitude);

  return new THREE.Vector3()
    .addScaledVector(VOYAGE_SKY_BASIS.south, Math.cos(azimuth) * horizontal)
    .addScaledVector(VOYAGE_SKY_BASIS.east, -Math.sin(azimuth) * horizontal)
    .addScaledVector(VOYAGE_SKY_BASIS.up, Math.sin(altitude))
    .normalize()
    .multiplyScalar(radius);
}

function equatorialToSkyPosition({ ra, dec }, radius = SKY_RADIUS_EARTH_RADII) {
  const latitude = THREE.MathUtils.degToRad(VOYAGE_POSITION.lat);
  const hourAngle = THREE.MathUtils.degToRad((REFERENCE_LST_HOURS - ra) * 15);
  const declination = THREE.MathUtils.degToRad(dec);
  const cosDec = Math.cos(declination);
  const east = -cosDec * Math.sin(hourAngle);
  const north = Math.cos(latitude) * Math.sin(declination)
    - Math.sin(latitude) * cosDec * Math.cos(hourAngle);
  const up = Math.sin(latitude) * Math.sin(declination)
    + Math.cos(latitude) * cosDec * Math.cos(hourAngle);

  return new THREE.Vector3()
    .addScaledVector(VOYAGE_SKY_BASIS.east, east)
    .addScaledVector(VOYAGE_SKY_BASIS.south, -north)
    .addScaledVector(VOYAGE_SKY_BASIS.up, up)
    .normalize()
    .multiplyScalar(radius);
}

function visualSizeForMagnitude(magnitude) {
  return THREE.MathUtils.clamp(1.5 - (magnitude + 1.5) * 0.18, 0.34, 1.62);
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smootherStep(value) {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function visualModeBlend(value) {
  const edge = 0.1;
  return smootherStep((clamp01(value) - edge) / (1 - edge * 2));
}

function makeStellariumLookDirection(yawDegrees = 0, pitchDegrees = 0) {
  const yaw = THREE.MathUtils.degToRad(yawDegrees);
  const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(pitchDegrees, -24, 88));
  const horizontal = Math.cos(pitch);

  return new THREE.Vector3()
    .addScaledVector(VOYAGE_SKY_BASIS.south, Math.cos(yaw) * horizontal)
    .addScaledVector(VOYAGE_SKY_BASIS.east, -Math.sin(yaw) * horizontal)
    .addScaledVector(VOYAGE_SKY_BASIS.up, Math.sin(pitch))
    .normalize();
}

function makeStellariumProjectionMatrix({ aspect, fov, lookYaw, lookPitch }) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, STELLARIUM_CAMERA_NEAR, STELLARIUM_CAMERA_FAR);
  const cameraPosition = VOYAGE_SKY_BASIS.up.clone().multiplyScalar(STELLARIUM_CAMERA_RADIUS);
  const lookDirection = makeStellariumLookDirection(lookYaw, lookPitch);
  let right = new THREE.Vector3().crossVectors(lookDirection, VOYAGE_SKY_BASIS.up);

  if (right.lengthSq() < 0.000001) {
    right = VOYAGE_SKY_BASIS.east.clone().negate();
  }

  right.normalize();
  const cameraUp = new THREE.Vector3().crossVectors(right, lookDirection).normalize();
  const matrixWorld = new THREE.Matrix4().makeBasis(
    right,
    cameraUp,
    lookDirection.clone().negate(),
  );

  matrixWorld.setPosition(cameraPosition);

  return camera.projectionMatrix.clone().multiply(matrixWorld.invert());
}

function projectiveMatrixScale(matrix, referencePoints) {
  const values = referencePoints
    .map((point) => Math.abs(new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(matrix).w))
    .filter((value) => Number.isFinite(value) && value > 0.000001)
    .sort((a, b) => a - b);

  if (!values.length) {
    return 1;
  }

  return values[Math.floor(values.length / 2)];
}

function interpolateProjectiveMatrix(from, to, amount, referencePoints) {
  const t = clamp01(amount);
  if (t <= 0) {
    return {
      matrix: from.clone(),
      fromScale: projectiveMatrixScale(from, referencePoints),
      toScale: projectiveMatrixScale(to, referencePoints),
    };
  }
  if (t >= 1) {
    return {
      matrix: to.clone(),
      fromScale: projectiveMatrixScale(from, referencePoints),
      toScale: projectiveMatrixScale(to, referencePoints),
    };
  }

  const fromScale = projectiveMatrixScale(from, referencePoints);
  const toScale = projectiveMatrixScale(to, referencePoints);
  const normalizedFrom = from.clone().multiplyScalar(1 / fromScale);
  const normalizedTo = to.clone().multiplyScalar(1 / toScale);
  const matrix = new THREE.Matrix4();
  const elements = matrix.elements;
  const fromElements = normalizedFrom.elements;
  const toElements = normalizedTo.elements;

  for (let i = 0; i < elements.length; i += 1) {
    elements[i] = THREE.MathUtils.lerp(fromElements[i], toElements[i], t);
  }

  return {
    matrix,
    fromScale,
    toScale,
  };
}

function makeStellariumOcean() {
  const segments = 128;
  const rings = 28;
  const cameraPosition = VOYAGE_SKY_BASIS.up.clone().multiplyScalar(STELLARIUM_CAMERA_RADIUS);
  const positions = [];
  const alphas = [];
  const indices = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const v = ring / rings;
    const altitude = THREE.MathUtils.lerp(STELLARIUM_HORIZON_ALTITUDE, -Math.PI * 0.5, v);
    const horizontal = Math.cos(altitude);
    const vertical = Math.sin(altitude);
    const edgeFade = THREE.MathUtils.smoothstep(v, 0.0, 0.1);

    for (let segment = 0; segment <= segments; segment += 1) {
      const theta = (segment / segments) * Math.PI * 2;
      const direction = new THREE.Vector3()
        .addScaledVector(VOYAGE_SKY_BASIS.east, Math.cos(theta) * horizontal)
        .addScaledVector(VOYAGE_SKY_BASIS.south, Math.sin(theta) * horizontal)
        .addScaledVector(VOYAGE_SKY_BASIS.up, vertical)
        .normalize();
      const position = cameraPosition.clone().addScaledVector(direction, STELLARIUM_OCEAN_RADIUS);

      positions.push(position.x, position.y, position.z);
      alphas.push(edgeFade);
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('oceanAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(STELLARIUM_OCEAN_COLOR) },
    },
    vertexShader: `
      attribute float oceanAlpha;
      varying float vOceanAlpha;
      void main() {
        vOceanAlpha = oceanAlpha;
        ${SKY_VERTEX_PROJECT}
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vOceanAlpha;

      void main() {
        float alpha = uOpacity * vOceanAlpha;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const ocean = new THREE.Mesh(geometry, material);
  ocean.frustumCulled = false;
  ocean.renderOrder = 60;

  return ocean;
}

function makeStellariumHorizonLine() {
  const cameraPosition = VOYAGE_SKY_BASIS.up.clone().multiplyScalar(STELLARIUM_CAMERA_RADIUS);
  const points = [];
  const samples = 192;
  const horizontal = Math.cos(STELLARIUM_HORIZON_ALTITUDE);
  const vertical = Math.sin(STELLARIUM_HORIZON_ALTITUDE);

  for (let i = 0; i <= samples; i += 1) {
    const theta = (i / samples) * Math.PI * 2;
    const direction = new THREE.Vector3()
      .addScaledVector(VOYAGE_SKY_BASIS.east, Math.cos(theta) * horizontal)
      .addScaledVector(VOYAGE_SKY_BASIS.south, Math.sin(theta) * horizontal)
      .addScaledVector(VOYAGE_SKY_BASIS.up, vertical)
      .normalize();
    points.push(cameraPosition.clone().addScaledVector(direction, STELLARIUM_OCEAN_RADIUS * 1.002));
  }

  const line = makeWorldLine(points, ARC_BLUE, 0, { wide: true, width: 1.8 });
  line.frustumCulled = false;
  line.renderOrder = 62;
  return line;
}

function makeStellariumHorizonProbePoint() {
  const cameraPosition = VOYAGE_SKY_BASIS.up.clone().multiplyScalar(STELLARIUM_CAMERA_RADIUS);
  const horizontal = Math.cos(STELLARIUM_HORIZON_ALTITUDE);
  const vertical = Math.sin(STELLARIUM_HORIZON_ALTITUDE);
  const direction = new THREE.Vector3()
    .addScaledVector(VOYAGE_SKY_BASIS.south, horizontal)
    .addScaledVector(VOYAGE_SKY_BASIS.up, vertical)
    .normalize();

  return cameraPosition.clone().addScaledVector(direction, STELLARIUM_OCEAN_RADIUS * 1.002);
}

function projectToScreen(matrix, point, width, height) {
  const projected = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(matrix);
  const w = projected.w || 1;
  projected.divideScalar(w);
  return {
    ndcX: projected.x,
    ndcY: projected.y,
    screenX: ((projected.x + 1) / 2) * width,
    screenY: ((1 - projected.y) / 2) * height,
    w,
  };
}

function skyTransitionLog(entry) {
  if (!DEBUG_CAMERA_TRANSITIONS) {
    return;
  }

  window.__tntmSkyTransitionFrames = window.__tntmSkyTransitionFrames ?? [];
  window.__tntmSkyTransitionFrames.push(entry);
  console.log('tntm-sky-transition', JSON.stringify(entry));
}

function makeWorldLine(points, color, opacity, options = {}) {
  const { wide = false, width = 1 } = options;

  if (wide) {
    const geometry = new LineGeometry();
    geometry.setFromPoints(points);
    return new Line2(geometry, makeSkyWideLineMaterial(color, opacity, width));
  }

  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    makeSkyLineMaterial(color, opacity),
  );
}

function makeSkyArrowFromPoints(tip, previous, color, opacity) {
  const radius = tip.length();
  const radial = tip.clone().normalize();
  const tangent = tip.clone().sub(previous).projectOnPlane(radial).normalize();
  const side = new THREE.Vector3().crossVectors(radial, tangent).normalize();
  const baseCenter = tip.clone().addScaledVector(tangent, -radius * 0.008);
  const baseA = baseCenter.clone().addScaledVector(side, radius * 0.0035);
  const baseB = baseCenter.clone().addScaledVector(side, -radius * 0.0035);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      tip.x,
      tip.y,
      tip.z,
      baseA.x,
      baseA.y,
      baseA.z,
      baseB.x,
      baseB.y,
      baseB.z,
    ], 3),
  );
  return new THREE.Mesh(geometry, makeSkySolidMaterial(color, opacity));
}

function projectToPixels(matrix, point, width, height) {
  const projected = new THREE.Vector4(point.x, point.y, point.z, 1).applyMatrix4(matrix);
  projected.divideScalar(projected.w || 1);
  return new THREE.Vector2(((projected.x + 1) / 2) * width, ((1 - projected.y) / 2) * height);
}

function constantPixelScale(projection, modelMatrix, targetPixels, width, height) {
  const matrix = projection.clone().multiply(modelMatrix);
  const origin = projectToPixels(matrix, new THREE.Vector3(0, 0, 0), width, height);
  const xUnit = projectToPixels(matrix, new THREE.Vector3(1, 0, 0), width, height);
  const yUnit = projectToPixels(matrix, new THREE.Vector3(0, 1, 0), width, height);
  const pixelsPerUnit = Math.max(origin.distanceTo(xUnit), origin.distanceTo(yUnit), 0.000001);
  return targetPixels / pixelsPerUnit;
}

function targetMarkerPixels(width, height) {
  if (width < 700) {
    return THREE.MathUtils.clamp(Math.min(width * 0.72, height * 0.36), 230, 300);
  }
  return THREE.MathUtils.clamp(Math.min(width * 0.2, height * 0.32), 220, 320);
}

function makeSkyGrid(positionForSky = pctToSkyPosition) {
  const group = new THREE.Group();

  for (let y = 12; y <= SKY_HORIZON_Y; y += 10.5) {
    const points = [];
    for (let x = 0; x <= 100; x += 2) {
      points.push(positionForSky(x, y, SKY_RADIUS_EARTH_RADII * 0.992));
    }
    group.add(makeWorldLine(
      points,
      GRID_BLUE,
      y === SKY_HORIZON_Y ? 0.72 : 0.34,
      { wide: true, width: y === SKY_HORIZON_Y ? 2.4 : 1.35 },
    ));
  }

  for (let x = 4; x <= 96; x += 9.2) {
    const points = [];
    for (let y = 4; y <= 95; y += 3) {
      points.push(positionForSky(x, y, SKY_RADIUS_EARTH_RADII * 0.99));
    }
    group.add(makeWorldLine(points, GRID_BLUE, 0.28, { wide: true, width: 1.15 }));
  }

  return group;
}

function altitudeToDiagramY(altitudeDegrees) {
  return SKY_HORIZON_Y - (altitudeDegrees / 78) * SKY_HORIZON_Y;
}

function makeDiurnalBasis(positionForSky) {
  const poleAltitude = Math.abs(VOYAGE_POSITION.lat);
  const axis = positionForSky(50, altitudeToDiagramY(poleAltitude), SKY_RADIUS_EARTH_RADII).normalize();
  const highMeridian = positionForSky(50, altitudeToDiagramY(70), SKY_RADIUS_EARTH_RADII).normalize();
  let meridian = highMeridian.clone().projectOnPlane(axis);

  if (meridian.lengthSq() < 0.000001) {
    meridian = new THREE.Vector3(1, 0, 0).projectOnPlane(axis);
  }

  meridian.normalize();

  const eastWest = new THREE.Vector3().crossVectors(axis, meridian).normalize();
  const rightReference = positionForSky(58, altitudeToDiagramY(45), SKY_RADIUS_EARTH_RADII)
    .sub(positionForSky(50, altitudeToDiagramY(45), SKY_RADIUS_EARTH_RADII))
    .normalize();

  if (eastWest.dot(rightReference) < 0) {
    eastWest.negate();
  }

  return { axis, meridian, eastWest };
}

function diurnalPoint({ axis, meridian, eastWest }, separationDegrees, phaseRadians, radius = SKY_RADIUS_EARTH_RADII) {
  const separation = THREE.MathUtils.degToRad(separationDegrees);
  return new THREE.Vector3()
    .addScaledVector(axis, Math.cos(separation) * radius)
    .addScaledVector(meridian, Math.sin(separation) * Math.cos(phaseRadians) * radius)
    .addScaledVector(eastWest, Math.sin(separation) * Math.sin(phaseRadians) * radius);
}

function makeStarMotionPaths(diurnalBasis) {
  const group = new THREE.Group();
  const separations = [];

  for (let separation = 5; separation <= 175; separation += 10) {
    separations.push(separation);
  }

  separations.forEach((separationDegrees) => {
    const linePoints = [];
    const samples = 180;

    for (let i = 0; i <= samples; i += 1) {
      const phase = (i / samples) * Math.PI * 2;
      linePoints.push(diurnalPoint(diurnalBasis, separationDegrees, phase, SKY_RADIUS_EARTH_RADII * 0.984));
    }

    group.add(makeWorldLine(linePoints, ARC_BLUE, 0.42, { wide: true, width: 2.25 }));

    for (let i = 0; i < 12; i += 1) {
      const phase = (i / 12) * Math.PI * 2;
      const tip = diurnalPoint(diurnalBasis, separationDegrees, phase, SKY_RADIUS_EARTH_RADII * 0.986);
      const previous = diurnalPoint(
        diurnalBasis,
        separationDegrees,
        phase - 0.055,
        SKY_RADIUS_EARTH_RADII * 0.986,
      );
      group.add(makeSkyArrowFromPoints(tip, previous, ARC_BLUE, 0.7));
    }
  });

  return group;
}

function makeWorldFieldStars() {
  const positions = [];
  const colors = [];
  const sizes = [];
  const alphas = [];

  function pushStar(position, brightness, size, alpha, tint = 0.5) {
    positions.push(position.x, position.y, position.z);
    const warm = tint < 0.38;
    const cool = tint > 0.72;
    colors.push(
      Math.min(1, brightness * (warm ? 1.12 : cool ? 0.88 : 1)),
      Math.min(1, brightness * (warm ? 1.01 : cool ? 0.95 : 0.98)),
      Math.min(1, brightness * (warm ? 0.76 : cool ? 1.18 : 1.05)),
    );
    sizes.push(size);
    alphas.push(alpha);
  }

  brightFieldStars.forEach(([, ra, dec, mag]) => {
    const size = THREE.MathUtils.clamp(7.1 - mag * 1.05, 2.1, 8.8);
    const alpha = THREE.MathUtils.clamp(1.02 - (mag + 1.5) * 0.12, 0.32, 0.94);
    const brightness = THREE.MathUtils.clamp(1.04 - Math.max(mag, -1.5) * 0.1, 0.62, 1);
    const tint = dec < -35 ? 0.74 : dec > 20 ? 0.42 : 0.55;
    const position = equatorialToSkyPosition({ ra, dec }, SKY_RADIUS_EARTH_RADII * 0.998);
    pushStar(position, brightness, size, alpha, tint);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

  return new THREE.Points(
    geometry,
    makeSkyFieldStarMaterial(),
  );
}

function makeWorldStar(star) {
  const position = equatorialToSkyPosition(star, SKY_RADIUS_EARTH_RADII);
  const size = visualSizeForMagnitude(star.mag);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([position.x, position.y, position.z], 3));

  return new THREE.Points(
    geometry,
    makeSkyNamedStarMaterial(11 * size + 3),
  );
}

function makeWorldLabel(constellation, starPositions) {
  const texture = makeLabelTexture(constellation.name, constellation.association);
  const position = starPositions
    .reduce((total, point) => total.add(point.clone().normalize()), new THREE.Vector3());

  if (position.lengthSq() < 0.000001) {
    position.copy(starPositions[0]).normalize();
  } else {
    position.normalize();
  }

  position.multiplyScalar(SKY_RADIUS_EARTH_RADII * 0.975);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    makeScreenLabelMaterial(texture),
  );
  mesh.renderOrder = 20;
  return { mesh, position, id: constellation.id, aspect: texture.userData.aspect ?? 512 / 154 };
}

function makeWorldSky(positionForSky = pctToSkyPosition) {
  const root = new THREE.Group();
  const starMotionGroup = new THREE.Group();
  const labelGroup = new THREE.Group();
  const pathGroup = new THREE.Group();
  const diurnalBasis = makeDiurnalBasis(positionForSky);
  const gridGroup = new THREE.Group();
  const fieldStars = makeWorldFieldStars();
  const stellariumOcean = makeStellariumOcean();
  const stellariumHorizon = makeStellariumHorizonLine();
  const constellationGroups = [];
  const screenLabels = [];
  const starHitTargets = [];
  const lineHitTargets = [];

  root.add(gridGroup);
  root.add(fieldStars);
  root.add(starMotionGroup);
  root.add(pathGroup);
  root.add(labelGroup);

  pathGroup.add(makeStarMotionPaths(diurnalBasis));

  constellations.forEach((constellation) => {
    const group = new THREE.Group();
    const starPositions = constellation.stars.map((star) => equatorialToSkyPosition(star, SKY_RADIUS_EARTH_RADII));

    constellation.lines.forEach(([from, to]) => {
      group.add(makeWorldLine(
        [starPositions[from], starPositions[to]],
        STAR_LINE,
        0.6,
        { wide: true, width: 3.2 },
      ));
      lineHitTargets.push({
        id: constellation.id,
        from: starPositions[from],
        to: starPositions[to],
        radius: 13,
      });
    });

    constellation.stars.forEach((star) => {
      group.add(makeWorldStar(star));
    });

    starPositions.forEach((position, index) => {
      const star = constellation.stars[index];
      const size = visualSizeForMagnitude(star.mag);
      starHitTargets.push({
        id: constellation.id,
        position,
        radius: 14 + size * 9,
      });
    });

    starMotionGroup.add(group);
    screenLabels.push(makeWorldLabel(constellation, starPositions));
    constellationGroups.push({ group });
  });

  root.traverse((child) => {
    child.frustumCulled = false;
  });

  return {
    root,
    starMotionGroup,
    labelGroup,
    pathGroup,
    gridGroup,
    fieldStars,
    stellariumOcean,
    stellariumHorizon,
    constellationGroups,
    screenLabels,
    starHitTargets,
    lineHitTargets,
    diurnalAxis: diurnalBasis.axis,
    seasonAxis: diurnalBasis.eastWest,
  };
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function updateWideLineResolutions(object, width, height) {
  object.traverse((child) => {
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material?.isLineMaterial) {
        material.resolution.set(width, height);
      }
    });
  });
}

function setMaterialOpacityScale(material, scale) {
  if (!material) {
    return;
  }

  if (material.uniforms?.uOpacity) {
    material.userData.baseUOpacity ??= material.uniforms.uOpacity.value;
    material.uniforms.uOpacity.value = material.userData.baseUOpacity * scale;
    return;
  }

  if (typeof material.opacity === 'number') {
    material.userData.baseOpacity ??= material.opacity;
    material.opacity = material.userData.baseOpacity * scale;
  }
}

export function createTaumakoSkyLayer(stateRef) {
  return {
    id: 'taumako-infinite-sky',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      this.map = map;
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
        alpha: true,
      });
      this.renderer.autoClear = false;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.backgroundScene = new THREE.Scene();
      this.skyScene = new THREE.Scene();
      this.horizonScene = new THREE.Scene();
      this.labelScene = new THREE.Scene();
      this.skyCamera = new THREE.Camera();
      this.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      this.labelCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      this.stellariumBackground = makeStellariumBackground();
      this.backgroundScene.add(this.stellariumBackground);
      this.horizonProbePoint = makeStellariumHorizonProbePoint();
      this.projectiveReferencePoints = [
        this.horizonProbePoint,
        pctToSkyPosition(50, 8, SKY_RADIUS_EARTH_RADII),
        pctToSkyPosition(16, 30, SKY_RADIUS_EARTH_RADII),
        pctToSkyPosition(84, 30, SKY_RADIUS_EARTH_RADII),
        pctToSkyPosition(32, 52, SKY_RADIUS_EARTH_RADII),
        pctToSkyPosition(68, 52, SKY_RADIUS_EARTH_RADII),
        VOYAGE_SKY_BASIS.up.clone().multiplyScalar(SKY_RADIUS_EARTH_RADII),
        VOYAGE_SKY_BASIS.south.clone().multiplyScalar(SKY_RADIUS_EARTH_RADII),
      ];
      this.worldSky = null;
    },

    render(gl, args) {
      const state = stateRef.current;
      const canvas = this.map.getCanvas();
      const mainMatrix = args.defaultProjectionData?.mainMatrix || args.projectionMatrix || args.matrix;

      if (!this.worldSky) {
        this.worldSky = makeWorldSky();
        this.skyScene.add(this.worldSky.root);
        this.horizonScene.add(this.worldSky.stellariumOcean);
        this.horizonScene.add(this.worldSky.stellariumHorizon);
        this.worldSky.screenLabels.forEach(({ mesh }) => this.labelScene.add(mesh));
      }
      updateWideLineResolutions(this.skyScene, canvas.clientWidth, canvas.clientHeight);
      updateWideLineResolutions(this.horizonScene, canvas.clientWidth, canvas.clientHeight);

      this.worldSky.gridGroup.visible = Boolean(state.showGrid);
      this.worldSky.pathGroup.visible = Boolean(state.showPaths);
      this.worldSky.fieldStars.visible = Boolean(state.showFieldStars);

      const hourAngle = THREE.MathUtils.degToRad(state.phase ?? 0);
      const dayOfYear = THREE.MathUtils.clamp(state.dayOfYear ?? 1, 1, 365);
      const yearAngle = ((dayOfYear - 1) / 365) * Math.PI * 2;
      const seasonalTilt = Math.sin(yearAngle) * THREE.MathUtils.degToRad(SEASONAL_TILT_DEGREES);
      const hourQuaternion = new THREE.Quaternion().setFromAxisAngle(this.worldSky.diurnalAxis, hourAngle);
      const seasonQuaternion = new THREE.Quaternion().setFromAxisAngle(this.worldSky.seasonAxis, seasonalTilt);
      this.worldSky.root.quaternion.copy(seasonQuaternion).multiply(hourQuaternion);

      const modeBlend = clamp01(state.cameraModeBlend ?? 0);
      const globeProjection = new THREE.Matrix4().fromArray(mainMatrix);
      const stellariumProjection = makeStellariumProjectionMatrix({
        aspect: canvas.clientWidth / Math.max(1, canvas.clientHeight),
        fov: state.stellariumFov ?? 36.87,
        lookYaw: state.lookYaw ?? 0,
        lookPitch: state.lookPitch ?? 0,
      });
      const projectionBlend = smootherStep(modeBlend);
      const interpolatedProjection = interpolateProjectiveMatrix(
        globeProjection,
        stellariumProjection,
        projectionBlend,
        this.projectiveReferencePoints,
      );
      const projection = interpolatedProjection.matrix;
      const oceanFade = clamp01((projectionBlend - 0.18) / 0.82);
      const labelAspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);

      if (modeBlend > 0.001 && modeBlend < 0.999) {
        const center = this.map.getCenter();
        skyTransitionLog({
          tag: 'tntm-sky-transition',
          time: Number(performance.now().toFixed(2)),
          modeBlend: Number(modeBlend.toFixed(6)),
          projectionBlend: Number(projectionBlend.toFixed(6)),
          lng: Number(center.lng.toFixed(6)),
          lat: Number(center.lat.toFixed(6)),
          zoom: Number(this.map.getZoom().toFixed(5)),
          pitch: Number(this.map.getPitch().toFixed(5)),
          bearing: Number(this.map.getBearing().toFixed(5)),
          roll: Number((this.map.getRoll?.() ?? 0).toFixed(5)),
          mapFov: Number((this.map.getVerticalFieldOfView?.() ?? 36.87).toFixed(5)),
          stellariumFov: Number((state.stellariumFov ?? 36.87).toFixed(5)),
          lookYaw: Number((state.lookYaw ?? 0).toFixed(5)),
          lookPitch: Number((state.lookPitch ?? 0).toFixed(5)),
          globeMatrixScale: Number(interpolatedProjection.fromScale.toFixed(5)),
          stellariumMatrixScale: Number(interpolatedProjection.toScale.toFixed(5)),
          horizonGlobe: projectToScreen(globeProjection, this.horizonProbePoint, canvas.clientWidth, canvas.clientHeight),
          horizonStellarium: projectToScreen(stellariumProjection, this.horizonProbePoint, canvas.clientWidth, canvas.clientHeight),
          horizonBlend: projectToScreen(projection, this.horizonProbePoint, canvas.clientWidth, canvas.clientHeight),
          horizonRendered: projectToScreen(projection, this.horizonProbePoint, canvas.clientWidth, canvas.clientHeight),
        });
      }

      this.worldSky.stellariumOcean.visible = oceanFade > 0.001;
      this.worldSky.stellariumOcean.material.uniforms.uOpacity.value = STELLARIUM_OCEAN_OPACITY * oceanFade;
      this.worldSky.stellariumHorizon.visible = oceanFade > 0.001;
      this.worldSky.stellariumHorizon.material.opacity = 0.76 * oceanFade;
      this.stellariumBackground.visible = projectionBlend > 0.001;
      this.stellariumBackground.material.opacity = projectionBlend;

      this.labelCamera.left = -labelAspect;
      this.labelCamera.right = labelAspect;
      this.labelCamera.top = 1;
      this.labelCamera.bottom = -1;
      this.labelCamera.updateProjectionMatrix();

      const hitTargets = [];
      const labelWidthPixels = canvas.clientWidth < 700 ? 232 : 336;
      const updateScreenLabels = (labelProjection, collectHitTargets = false) => {
        this.worldSky.screenLabels.forEach(({ mesh, position, id, aspect: textureAspect }) => {
          const labelHeightPixels = labelWidthPixels / textureAspect;
          const worldPosition = position.clone().applyQuaternion(this.worldSky.root.quaternion);
          const projected = new THREE.Vector4(worldPosition.x, worldPosition.y, worldPosition.z, 1)
            .applyMatrix4(labelProjection);
          const w = projected.w || 1;
          projected.divideScalar(w);
          mesh.visible = Boolean(state.showLabels) && w > 0 && Math.abs(projected.x) < 1.18 && Math.abs(projected.y) < 1.18;
          mesh.position.set(projected.x * labelAspect, projected.y, 0);
          mesh.scale.set(
            (labelWidthPixels / canvas.clientWidth) * 2 * labelAspect,
            (labelHeightPixels / canvas.clientHeight) * 2,
            1,
          );
          setMaterialOpacityScale(mesh.material, 1);

          if (collectHitTargets && mesh.visible) {
            hitTargets.push({
              id,
              x: ((projected.x + 1) / 2) * canvas.clientWidth,
              y: ((1 - projected.y) / 2) * canvas.clientHeight,
              width: labelWidthPixels,
              height: labelHeightPixels,
            });
          }
        });
      };
      updateScreenLabels(projection, true);

      this.worldSky.starHitTargets.forEach(({ id, position, radius }) => {
        const worldPosition = position.clone().applyQuaternion(this.worldSky.root.quaternion);
        const projected = new THREE.Vector4(worldPosition.x, worldPosition.y, worldPosition.z, 1)
          .applyMatrix4(projection);
        const w = projected.w || 1;
        projected.divideScalar(w);

        if (w > 0 && Math.abs(projected.x) < 1.08 && Math.abs(projected.y) < 1.08) {
          hitTargets.push({
            id,
            x: ((projected.x + 1) / 2) * canvas.clientWidth,
            y: ((1 - projected.y) / 2) * canvas.clientHeight,
            radius,
          });
        }
      });

      this.worldSky.lineHitTargets.forEach(({ id, from, to, radius }) => {
        const fromPosition = from.clone().applyQuaternion(this.worldSky.root.quaternion);
        const toPosition = to.clone().applyQuaternion(this.worldSky.root.quaternion);
        const projectedFrom = new THREE.Vector4(fromPosition.x, fromPosition.y, fromPosition.z, 1)
          .applyMatrix4(projection);
        const projectedTo = new THREE.Vector4(toPosition.x, toPosition.y, toPosition.z, 1)
          .applyMatrix4(projection);
        const fromW = projectedFrom.w || 1;
        const toW = projectedTo.w || 1;
        projectedFrom.divideScalar(fromW);
        projectedTo.divideScalar(toW);

        if (
          fromW > 0
          && toW > 0
          && Math.abs(projectedFrom.x) < 1.12
          && Math.abs(projectedFrom.y) < 1.12
          && Math.abs(projectedTo.x) < 1.12
          && Math.abs(projectedTo.y) < 1.12
        ) {
          hitTargets.push({
            id,
            x1: ((projectedFrom.x + 1) / 2) * canvas.clientWidth,
            y1: ((1 - projectedFrom.y) / 2) * canvas.clientHeight,
            x2: ((projectedTo.x + 1) / 2) * canvas.clientWidth,
            y2: ((1 - projectedTo.y) / 2) * canvas.clientHeight,
            radius,
          });
        }
      });
      state.hitTargets = hitTargets;

      if (this.renderer.resetState) {
        this.renderer.resetState();
      }
      if (modeBlend > 0.01) {
        this.renderer.clearDepth();
        this.renderer.render(this.backgroundScene, this.backgroundCamera);
        this.renderer.clearDepth();
      }
      this.skyCamera.projectionMatrix.copy(projection);
      this.renderer.render(this.skyScene, this.skyCamera);
      this.renderer.clearDepth();
      if (this.worldSky.stellariumOcean.visible || this.worldSky.stellariumHorizon.visible) {
        this.skyCamera.projectionMatrix.copy(projection);
        this.renderer.render(this.horizonScene, this.skyCamera);
        this.renderer.clearDepth();
      }
      this.renderer.render(this.labelScene, this.labelCamera);
    },

    onRemove() {
      disposeObject(this.backgroundScene);
      disposeObject(this.skyScene);
      disposeObject(this.horizonScene);
      disposeObject(this.labelScene);
    },
  };
}

export function createTaumakoLayer(stateRef) {
  return {
    id: 'taumako-stars-and-compass',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      this.map = map;
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
        alpha: true,
      });
      this.renderer.autoClear = false;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.markerScene = new THREE.Scene();
      this.hudScene = new THREE.Scene();
      this.geoCamera = new THREE.Camera();
      this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
      this.loaded = false;
      this.islandLabels = [];

      const loader = new THREE.TextureLoader();
      const textureLoaded = () => {
        this.loaded = true;
        this.map.triggerRepaint();
      };

      const boatTexture = loader.load(assetUrl('/boat.png'), textureLoaded);
      boatTexture.colorSpace = THREE.SRGBColorSpace;

      this.markerGroup = new THREE.Group();
      this.markerGroup.rotation.y = Math.PI;

      this.compassGroup = new THREE.Group();

      const compassCenter = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 48),
        new THREE.MeshBasicMaterial({
          color: '#03133f',
          transparent: true,
          opacity: 0.78,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      compassCenter.rotation.x = -Math.PI / 2;
      compassCenter.renderOrder = 90;
      this.compassCenter = compassCenter;
      this.compassGroup.add(compassCenter);

      const compassMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      this.compassMaterial = compassMaterial;
      loadCompassTexture((texture) => {
        compassMaterial.map = texture;
        compassMaterial.needsUpdate = true;
        textureLoaded();
      });

      const compass = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        compassMaterial,
      );
      compass.rotation.x = -Math.PI / 2;
      compass.renderOrder = 91;
      this.compassGroup.add(compass);

      this.screenBoat = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: boatTexture,
          transparent: true,
          opacity: 0.98,
          alphaTest: 0.01,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      this.screenBoat.rotation.z = 0;
      this.screenBoat.renderOrder = 100;
      this.hudScene.add(this.screenBoat);

      this.islandLabels = islandFeatures.features.map((feature) => {
        const texture = makeIslandLabelTexture(feature.properties.name);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          makeScreenLabelMaterial(texture),
        );
        mesh.renderOrder = 80;
        this.hudScene.add(mesh);

        return {
          mesh,
          coordinates: feature.geometry.coordinates,
          size: feature.properties.size ?? 1,
          aspect: texture.userData.aspect ?? 512 / 168,
        };
      });

      this.markerGroup.add(this.compassGroup);
      this.markerScene.add(this.markerGroup);
    },

    render(gl, args) {
      const state = stateRef.current;
      const canvas = this.map.getCanvas();
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      this.aspect = aspect;

      const markerBlend = visualModeBlend(state.cameraModeBlend ?? 0);
      const markerFade = (Boolean(state.showCompass) ? 1 : 0) * (1 - markerBlend);
      this.markerGroup.visible = markerFade > 0.001;
      this.compassCenter.material.opacity = 0.78 * markerFade;
      this.compassMaterial.opacity = 0.92 * markerFade;

      const mainMatrix = args.defaultProjectionData?.mainMatrix || args.projectionMatrix || args.matrix;
      const projection = new THREE.Matrix4().fromArray(mainMatrix);
      const modelMatrix = new THREE.Matrix4().fromArray(
        this.map.transform.getMatrixForModel([VOYAGE_POSITION.lng, VOYAGE_POSITION.lat], SURFACE_ALTITUDE_METERS),
      );
      const markerPixels = targetMarkerPixels(canvas.clientWidth, canvas.clientHeight);
      const compassPixels = markerPixels * 2;
      const markerScale = constantPixelScale(projection, modelMatrix, compassPixels, canvas.clientWidth, canvas.clientHeight);

      this.markerGroup.scale.set(markerScale, markerScale, markerScale);
      this.geoCamera.projectionMatrix = projection.clone().multiply(modelMatrix);

      this.screenCamera.left = -this.aspect;
      this.screenCamera.right = this.aspect;
      this.screenCamera.top = 1;
      this.screenCamera.bottom = -1;
      this.screenCamera.updateProjectionMatrix();

      const boatAnchor = this.map.project([VOYAGE_POSITION.lng, VOYAGE_POSITION.lat]);
      const boatHeightPixels = markerPixels * 0.48;
      const boatWidthPixels = boatHeightPixels * BOAT_ASPECT_RATIO;
      this.screenBoat.visible = markerFade > 0.001;
      this.screenBoat.material.opacity = 0.98 * markerFade;
      this.screenBoat.position.set(
        (boatAnchor.x / canvas.clientWidth) * 2 * this.aspect - this.aspect,
        1 - (boatAnchor.y / canvas.clientHeight) * 2 + (boatHeightPixels * 0.5 * 2) / canvas.clientHeight,
        0,
      );
      this.screenBoat.scale.set(
        (boatWidthPixels / canvas.clientWidth) * 2 * this.aspect,
        (boatHeightPixels / canvas.clientHeight) * 2,
        1,
      );

      const mapFade = 1 - markerBlend;
      this.islandLabels.forEach(({ mesh, coordinates, size, aspect: labelTextureAspect }) => {
        const point = this.map.project(coordinates);
        const labelWidthPixels = THREE.MathUtils.clamp(360 * size, 260, 520);
        const labelHeightPixels = labelWidthPixels / labelTextureAspect;
        const labelOffsetPixels = 28 + size * 20;
        const visible = mapFade > 0.001
          && point.x > -160
          && point.x < canvas.clientWidth + 160
          && point.y > -120
          && point.y < canvas.clientHeight + 160;

        mesh.visible = visible;
        mesh.material.opacity = 0.92 * mapFade;
        mesh.position.set(
          (point.x / canvas.clientWidth) * 2 * this.aspect - this.aspect,
          1 - ((point.y + labelOffsetPixels) / canvas.clientHeight) * 2,
          0,
        );
        mesh.scale.set(
          (labelWidthPixels / canvas.clientWidth) * 2 * this.aspect,
          (labelHeightPixels / canvas.clientHeight) * 2,
          1,
        );
      });

      if (this.renderer.resetState) {
        this.renderer.resetState();
      }
      this.renderer.render(this.markerScene, this.geoCamera);
      this.renderer.clearDepth();
      this.renderer.render(this.hudScene, this.screenCamera);
    },

    onRemove() {
      disposeObject(this.markerScene);
      disposeObject(this.hudScene);
    },
  };
}
