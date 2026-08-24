// Node.js script to generate PNG icons without external dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  // We will generate an uncompressed RGBA pixel buffer and construct PNG chunks
  const width = size;
  const height = size;
  const buffer = Buffer.alloc(width * height * 4);

  // Background colors & shapes
  // Pink: #FB7299 -> RGBA(251, 114, 153, 255)
  // Dark Pink: #E05680
  // White: #FFFFFF
  // Dark Blue: #23ADE5

  const center = size / 2;
  const radius = size * 0.45;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Rounded rectangle bounds for app icon
      const pad = size * 0.06;
      const rx = Math.max(pad + cornerRadius, Math.min(width - pad - cornerRadius, x));
      const ry = Math.max(pad + cornerRadius, Math.min(height - pad - cornerRadius, y));
      const dist = Math.hypot(x - rx, y - ry);

      if (dist <= cornerRadius) {
        // Inside rounded squircle
        // Gradient from top (#FB7299) to bottom (#E05680)
        const t = y / height;
        const r = Math.round(251 * (1 - t * 0.15));
        const g = Math.round(114 * (1 - t * 0.2));
        const b = Math.round(153 * (1 - t * 0.1));

        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = 255;

        // Draw Touch / Play / Swipe icon (two arrows ⏪ ⏩ or hand / swipe symbol)
        // Let's draw two horizontal swipe arrows and a center dot
        const cx = x - center;
        const cy = y - center;

        // Center circle / touch indicator
        const centerDotRadius = size * 0.13;
        if (Math.hypot(cx, cy) <= centerDotRadius) {
          buffer[idx] = 255;
          buffer[idx + 1] = 255;
          buffer[idx + 2] = 255;
          buffer[idx + 3] = 255;
        }

        // Left Arrow (<)
        const leftArrowX = -size * 0.22;
        const arrowSize = size * 0.14;
        if (cx < leftArrowX + arrowSize && cx > leftArrowX - arrowSize * 0.5) {
          const expectedY = Math.abs(cx - leftArrowX);
          if (Math.abs(cy) <= expectedY && Math.abs(cy) >= expectedY - size * 0.06 && expectedY <= arrowSize) {
            buffer[idx] = 255;
            buffer[idx + 1] = 255;
            buffer[idx + 2] = 255;
            buffer[idx + 3] = 255;
          }
        }

        // Right Arrow (>)
        const rightArrowX = size * 0.22;
        if (cx > rightArrowX - arrowSize && cx < rightArrowX + arrowSize * 0.5) {
          const expectedY = Math.abs(cx - rightArrowX);
          if (Math.abs(cy) <= expectedY && Math.abs(cy) >= expectedY - size * 0.06 && expectedY <= arrowSize) {
            buffer[idx] = 255;
            buffer[idx + 1] = 255;
            buffer[idx + 2] = 255;
            buffer[idx + 3] = 255;
          }
        }

        // Antennas for TV icon style on top if size >= 32
        if (size >= 32 && y < size * 0.28 && y > size * 0.1) {
          const leftAntenna = Math.abs((x - (size * 0.38)) - (y - size * 0.1) * 0.7);
          const rightAntenna = Math.abs((x - (size * 0.62)) + (y - size * 0.1) * 0.7);
          if (leftAntenna < size * 0.03 || rightAntenna < size * 0.03) {
            buffer[idx] = 255;
            buffer[idx + 1] = 255;
            buffer[idx + 2] = 255;
            buffer[idx + 3] = 255;
          }
        }
      } else {
        // Transparent outside
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }

  // Construct PNG file
  return encodePNG(width, height, buffer);
}

function encodePNG(width, height, rgbaBuffer) {
  // Raw scanlines with filter byte 0
  const scanlineWidth = width * 4;
  const rawData = Buffer.alloc(height * (scanlineWidth + 1));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (scanlineWidth + 1);
    rawData[rowOffset] = 0; // Filter: None
    rgbaBuffer.copy(rawData, rowOffset + 1, y * scanlineWidth, (y + 1) * scanlineWidth);
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // color type 6: RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcPayload);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
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

[16, 48, 128].forEach(size => {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated: icon-${size}.png (${png.length} bytes)`);
});
