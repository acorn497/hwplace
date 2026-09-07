import { PixelColor } from "../contexts/interfaces/Pixel.interface";

/**
 * 시작 좌표와 같은 색으로 이어진 영역을 훑는다.
 *
 * 픽셀 저장소가 Map에서 평면 버퍼로 바뀌었으므로 자료구조 대신 조회 함수를 받는다.
 * (미도색 좌표는 조회 함수가 흰색을 돌려주기로 약속되어 있다)
 */
export const BFS = (
  startX: number,
  startY: number,
  targetColor: PixelColor,
  getPixelColor: (x: number, y: number) => PixelColor,
  canvasWidth: number,
  canvasHeight: number,
) => {
  const limit = Number(import.meta.env.VITE_BFS_SIZE ?? 500);
  const queue: { x: number, y: number }[] = [];
  let head = 0;
  queue.push({ x: startX, y: startY });

  const visited = new Set<string>();
  const result: { x: number, y: number }[] = [];

  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  visited.add(`${startX},${startY}`);

  while (queue.length > head) {
    if (result.length >= limit) break;

    const item = queue[head++];
    const currentColor = getPixelColor(item.x, item.y);

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
