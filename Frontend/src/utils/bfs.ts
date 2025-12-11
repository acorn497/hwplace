import { Pixel } from "../contexts/interfaces/Pixel.interface";

export const BFS = (startX: number, startY: number, targetColor: { r: number, g: number, b: number }, pixelMap: Map<string, Pixel>, canvasWidth: number, canvasHeight: number) => {
  const queue: { x: number, y: number }[] = [];
  let head = 0;
  queue.push({ x: startX, y: startY });

  const visited = new Set<string>();
  const result: { x: number, y: number }[] = [];

  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  visited.add(`${startX},${startY}`);

  while (queue.length > head) {
    if (result.length >= (import.meta.env.VITE_BFS_SIZE ?? 500)) break;

    const item = queue[head++];
    const itemKey = `${item.x},${item.y}`;

    const currentPixel = pixelMap.get(itemKey);
    const currentColor = {
      r: currentPixel?.colorR ?? 255,
      g: currentPixel?.colorG ?? 255,
      b: currentPixel?.colorB ?? 255
    };

    if (currentColor.r !== targetColor.r || currentColor.g !== targetColor.g || currentColor.b !== targetColor.b) {
      continue;
    }

    result.push({ x: item.x, y: item.y });

    for (let i = 0; i < dx.length; i++) {
      const vx = item.x + dx[i];
      const vy = item.y + dy[i];

      if (visited.has(`${vx},${vy}`) || vx >= canvasWidth || vy >= canvasHeight || vx < 0 || vy < 0) continue;

      visited.add(`${vx},${vy}`);
      queue.push({ x: vx, y: vy });
    }
  }

  return result;
}