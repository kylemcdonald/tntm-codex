import fs from 'node:fs';
import { PNG } from 'pngjs';

const inputPath = new URL('../public/compass.png', import.meta.url);
const outputPath = inputPath;
const image = PNG.sync.read(fs.readFileSync(inputPath));
const { width, height, data } = image;

const offsets = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

function index(x, y) {
  return y * width + x;
}

function pixelOffsetFromIndex(id) {
  return id * 4;
}

function pixelOffset(x, y) {
  return pixelOffsetFromIndex(index(x, y));
}

function isWhiteBackground(x, y) {
  const offset = pixelOffset(x, y);
  return data[offset + 3] > 0 && data[offset] > 245 && data[offset + 1] > 245 && data[offset + 2] > 245;
}

function isNearWhiteHalo(id) {
  const offset = pixelOffsetFromIndex(id);
  return data[offset + 3] > 0 && data[offset] >= 230 && data[offset + 1] >= 230 && data[offset + 2] >= 230;
}

function floodWhiteBackgroundFromSeeds(seeds) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  function seed(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }
    const id = index(x, y);
    if (!visited[id] && isWhiteBackground(x, y)) {
      visited[id] = 1;
      queue.push(id);
    }
  }

  seeds.forEach(([x, y]) => seed(x, y));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const x = id % width;
    const y = Math.floor(id / width);
    data[pixelOffsetFromIndex(id) + 3] = 0;

    offsets.forEach(([dx, dy]) => seed(x + dx, y + dy));
  }
}

function removeNearWhiteHaloConnectedToTransparency() {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let id = 0; id < width * height; id += 1) {
    if (data[pixelOffsetFromIndex(id) + 3] === 0) {
      visited[id] = 1;
      queue.push(id);
    }
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    const x = id % width;
    const y = Math.floor(id / width);

    offsets.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return;
      }

      const nextId = index(nx, ny);
      if (visited[nextId] || !isNearWhiteHalo(nextId)) {
        return;
      }

      visited[nextId] = 1;
      data[pixelOffsetFromIndex(nextId) + 3] = 0;
      queue.push(nextId);
    });
  }
}

const seeds = [];
for (let x = 0; x < width; x += 1) {
  seeds.push([x, 0], [x, height - 1]);
}
for (let y = 0; y < height; y += 1) {
  seeds.push([0, y], [width - 1, y]);
}
seeds.push([Math.floor(width / 2), Math.floor(height / 2)]);

floodWhiteBackgroundFromSeeds(seeds);
removeNearWhiteHaloConnectedToTransparency();

fs.writeFileSync(outputPath, PNG.sync.write(image));
