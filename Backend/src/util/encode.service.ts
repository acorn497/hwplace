import { Injectable } from "@nestjs/common";
import { CompressedPixel } from "src/common/global/types/CompressedPixel";

const BYTES_PER_PIXEL = 7;
const BYTES_PER_RGB_PIXEL = 3;

type RgbPixel = Pick<CompressedPixel, 'r' | 'g' | 'b'>;

@Injectable()
export class EncodeService {
/**
 * 픽셀 데이터 직렬화 함수
 */
  serealizePixel(pixels: CompressedPixel[]) {
    const buffer = Buffer.allocUnsafe(pixels.length * BYTES_PER_PIXEL);

    pixels.forEach((pixel, index) => {
      const offset = index * BYTES_PER_PIXEL;

      buffer.writeUInt16LE(pixel.x, offset);
      buffer.writeUInt16LE(pixel.y, offset + 2);
      buffer.writeUInt8(pixel.r, offset + 4);
      buffer.writeUInt8(pixel.g, offset + 5);
      buffer.writeUInt8(pixel.b, offset + 6);
    });

    return buffer;
  }

  serializeRgbPixel(pixel: RgbPixel) {
    const buffer = Buffer.allocUnsafe(BYTES_PER_RGB_PIXEL);

    buffer.writeUInt8(pixel.r, 0);
    buffer.writeUInt8(pixel.g, 1);
    buffer.writeUInt8(pixel.b, 2);

    return buffer;
  }

  createRgbChunk(pixelCount: number, fillColor: RgbPixel = { r: 255, g: 255, b: 255 }) {
    const buffer = Buffer.allocUnsafe(pixelCount * BYTES_PER_RGB_PIXEL);

    for (let offset = 0; offset < buffer.length; offset += BYTES_PER_RGB_PIXEL) {
      buffer.writeUInt8(fillColor.r, offset);
      buffer.writeUInt8(fillColor.g, offset + 1);
      buffer.writeUInt8(fillColor.b, offset + 2);
    }

    return buffer;
  }

  getRgbPixelOffset(x: number, y: number, width: number) {
    return (y * width + x) * BYTES_PER_RGB_PIXEL;
  }

  writeRgbPixel(buffer: Buffer, x: number, y: number, width: number, pixel: RgbPixel) {
    const offset = this.getRgbPixelOffset(x, y, width);

    buffer.writeUInt8(pixel.r, offset);
    buffer.writeUInt8(pixel.g, offset + 1);
    buffer.writeUInt8(pixel.b, offset + 2);
  }

  readRgbPixel(buffer: Buffer, x: number, y: number, width: number) {
    const offset = this.getRgbPixelOffset(x, y, width);

    return {
      r: buffer.readUInt8(offset),
      g: buffer.readUInt8(offset + 1),
      b: buffer.readUInt8(offset + 2),
    };
  }
}
