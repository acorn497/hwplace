const autocannon = require('autocannon');
const fs = require('fs');
const pidusage = require('pidusage');

const BASE_URL = 'https://port-0-hwplace-mgroz4g3d2d6b70d.sel3.cloudtype.app/';
const API_PATH = 'paint';

function generateRandomPixel() {
  return {
    posX: Math.floor(Math.random() * 500),
    posY: Math.floor(Math.random() * 500),
    colorR: Math.floor(Math.random() * 256),
    colorG: Math.floor(Math.random() * 256),
    colorB: Math.floor(Math.random() * 256),
  };
}

function generateRandomPixels(count = 1) {
  return Array.from({ length: count }, () => generateRandomPixel());
}

async function runTest(config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${config.title}`);
  console.log(`요청 수: ${config.amount || 'unlimited'}`);
  console.log(`동시 연결: ${config.connections}`);
  console.log(`지속 시간: ${config.duration}초`);
  console.log(`픽셀 개수: ${config.pixelCount}개 (요청당)\n`);

  const resourceStats = [];
  const monitorInterval = setInterval(async () => {
    try {
      const usage = await pidusage(process.pid);
      resourceStats.push({ cpu: usage.cpu, memory: usage.memory });
    } catch (err) {
      console.error('Resource monitoring error:', err.message);
    }
  }, 1000);

  const result = await autocannon({
    url: `${BASE_URL}${API_PATH}`,
    connections: config.connections,
    duration: config.duration,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // setupClient 대신 requests 옵션 사용
    requests: [
      {
        method: 'POST',
        path: `/${API_PATH}`,
        headers: { 'Content-Type': 'application/json' },
        // 매 요청마다 새로운 body 생성
        setupRequest: (req) => {
          return {
            ...req,
            body: JSON.stringify(generateRandomPixels(config.pixelCount))
          };
        }
      }
    ]
  });

  clearInterval(monitorInterval);

  const totalPixels = result.requests.total * config.pixelCount;
  const pixelsPerSec = totalPixels / config.duration;

  console.log(`  요청: ${result.requests.total.toLocaleString()}`);
  console.log(`  초당 요청: ${result.requests.mean.toFixed(2)} req/s`);
  console.log(`  초당 픽셀 처리량: ${pixelsPerSec.toFixed(2)} pixels/s`);
  console.log(`  평균 지연: ${result.latency.mean.toFixed(2)} ms`);
  if (result.latency.p50) console.log(`  p50: ${result.latency.p50.toFixed(2)} ms`);
  if (result.latency.p95) console.log(`  p95: ${result.latency.p95.toFixed(2)} ms`);
  if (result.latency.p99) console.log(`  p99: ${result.latency.p99.toFixed(2)} ms`);
  console.log(`  타임아웃: ${result.timeouts}`);
  console.log(`  오류율: ${(result.errors / result.requests.total * 100).toFixed(2)}%`);

  return result;
}

async function main() {
  // await runTest({ title: 'Warm Up: 1픽셀, 200커넥션', connections: 200, duration: 10, pixelCount: 1 });
  // await runTest({ title: 'Test 1: 1픽셀, 50커넥션', connections: 50, duration: 20, pixelCount: 1 });
  // await runTest({ title: 'Test 2: 1픽셀, 100커넥션', connections: 100, duration: 20, pixelCount: 1 });
  // await runTest({ title: 'Test 3: 10픽셀, 75커넥션', connections: 75, duration: 20, pixelCount: 10 });
  // await runTest({ title: 'Test 4: 10픽셀, 130커넥션', connections: 100, duration: 20, pixelCount: 10 });
  // await runTest({ title: 'Test 5: 50픽셀, 100커넥션', connections: 150, duration: 20, pixelCount: 50 });
  await runTest({ title: 'Test 6: 100픽셀, 200커넥션', connections: 200, duration: 20, pixelCount: 100 });

  console.log('\n' + '='.repeat(60));
  console.log('테스트 완료');
  console.log('='.repeat(60));
}

main().catch(console.error);