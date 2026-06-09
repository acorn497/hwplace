export interface CompressedPixel {
  /**
   * 0 ~ 65535
   * 2 Bytes
   */
  x: number;

  /**
   * 0 ~ 65535
   * 2 Bytes
   */
  y: number;

  /**
   * 0 ~ 255
   * 1 Bytes
   */
  r: number;

  /**
   * 0 ~ 255
   * 1 Bytes
   */
  g: number;

  /**
   * 0 ~ 255
   * 1 Bytes
   */
  b: number;
}