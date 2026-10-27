// Generate crisp PNG icons with pure Node.js (no external dependencies needed)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, filename) {
  const width = size;
  const height = size;

  // Buffer for raw image data: (width * 4 + 1) * height bytes
  // Each scanline begins with a filter byte (0 = None)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const r = size * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded squircle app icon background
      const cornerR = size * 0.22;
      const clampedX = Math.max(cornerR, Math.min(width - cornerR, x));
      const clampedY = Math.max(cornerR, Math.min(height - cornerR, y));
      const cornerDist = Math.hypot(x - clampedX, y - clampedY);

      if (cornerDist <= cornerR) {
        // Gradient from #6366f1 (99, 102, 241) to #ec4899 (236, 72, 153)
        const factor = (x + y) / (width + height);
        const red = Math.round(99 + (236 - 99) * factor);
        const green = Math.round(102 + (72 - 102) * factor);
        const blue = Math.round(241 + (153 - 241) * factor);

        // Simple cart symbol in center
        const relX = (x - cx) / (size * 0.5);
        const relY = (y - cy) / (size * 0.5);

        // Draw cart shape
        let isSymbol = false;
        // Cart basket box
        if (relY >= -0.2 && relY <= 0.25 && relX >= -0.4 && relX <= 0.35) {
          if (relY <= -0.12 || relY >= 0.17 || relX <= -0.32 || relX >= 0.27) {
            isSymbol = true;
          }
        }
        // Cart handle
        if (relX >= -0.55 && relX <= -0.38 && relY >= -0.45 && relY <= -0.2) {
          isSymbol = true;
        }
        // Wheels
        const w1Dist = Math.hypot(relX - (-0.2), relY - 0.42);
        const w2Dist = Math.hypot(relX - 0.2, relY - 0.42);
        if (w1Dist <= 0.1 || w2Dist <= 0.1) {
          isSymbol = true;
        }

        if (isSymbol) {
          rawData[pixelOffset] = 255;
          rawData[pixelOffset + 1] = 255;
          rawData[pixelOffset + 2] = 255;
          rawData[pixelOffset + 3] = 255;
        } else {
          rawData[pixelOffset] = red;
          rawData[pixelOffset + 1] = green;
          rawData[pixelOffset + 2] = blue;
          rawData[pixelOffset + 3] = 255;
        }
      } else {
        // Transparent
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      }
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8-bit depth
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // Compression (deflate)
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  const pngBuffer = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(filename, pngBuffer);
  console.log('Saved', filename);
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

createPNG(192, path.join(iconsDir, 'icon-192.png'));
createPNG(512, path.join(iconsDir, 'icon-512.png'));
