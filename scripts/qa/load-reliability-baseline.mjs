import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(currentFile), '..', '..');
const outputDirectory = path.join(workspaceRoot, 'docs', 'qa', 'generated');
const apiBaseUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const frontendBaseUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const requestTimeoutMs = Number(process.env.LOAD_REQUEST_TIMEOUT_MS || 15_000);
const warmupRequestTimeoutMs = Number(
  process.env.LOAD_WARMUP_TIMEOUT_MS || 60_000
);
const enforceSlo = process.env.LOAD_ENFORCE_SLO === 'true';
const runtimeMode = process.env.LOAD_RUNTIME_MODE || 'development';

const apiTargets = [
  '/health/db',
  '/public/site-shell',
  '/public/product-categories',
  '/public/product-groups?page=1&page_size=12',
  '/public/search-suggestions?q=den&limit=8',
  '/public/news?page=1&limit=9'
].map((route) => ({ name: route, url: `${apiBaseUrl}${route}` }));

const frontendTargets = [
  '/',
  '/san-pham/danh-sach',
  '/tim-kiem?q=den'
].map((route) => ({ name: route, url: `${frontendBaseUrl}${route}` }));

const phases = [
  { name: 'api-normal', targets: apiTargets, requests: 60, concurrency: 5, maxP95Ms: 750 },
  { name: 'api-load', targets: apiTargets, requests: 180, concurrency: 20, maxP95Ms: 2000 },
  { name: 'api-spike', targets: apiTargets, requests: 160, concurrency: 50, maxP95Ms: 5000 },
  { name: 'frontend-normal', targets: frontendTargets, requests: 18, concurrency: 3, maxP95Ms: 2000 },
  { name: 'frontend-load', targets: frontendTargets, requests: 36, concurrency: 6, maxP95Ms: 4000 }
];

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return Number(sorted[Math.max(0, index)].toFixed(2));
}

async function executeRequest(target, timeoutMs = requestTimeoutMs) {
  const startedAt = performance.now();
  try {
    const response = await fetch(target.url, {
      headers: {
        Accept: target.url.startsWith(frontendBaseUrl) ? 'text/html' : 'application/json',
        'User-Agent': 'SongThanh-QA-Load-Baseline/1.0'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs)
    });
    await response.arrayBuffer();
    return {
      duration_ms: performance.now() - startedAt,
      ok: response.ok,
      status: response.status,
      target: target.name
    };
  } catch (error) {
    return {
      duration_ms: performance.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      ok: false,
      status: 0,
      target: target.name
    };
  }
}

async function runPhase(phase) {
  let cursor = 0;
  const results = [];
  const startedAt = performance.now();

  async function worker() {
    while (true) {
      const requestIndex = cursor;
      cursor += 1;
      if (requestIndex >= phase.requests) return;
      const target = phase.targets[requestIndex % phase.targets.length];
      results.push(await executeRequest(target));
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(phase.concurrency, phase.requests) },
      () => worker()
    )
  );

  const wallDurationMs = performance.now() - startedAt;
  const durations = results.map((result) => result.duration_ms);
  const failures = results.filter((result) => !result.ok);
  const statusCounts = {};
  const targetCounts = {};

  for (const result of results) {
    const statusKey = String(result.status);
    statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;
    const target = targetCounts[result.target] ?? {
      durations: [],
      failures: 0,
      requests: 0
    };
    target.requests += 1;
    if (!result.ok) target.failures += 1;
    target.durations.push(result.duration_ms);
    targetCounts[result.target] = target;
  }

  const targetMetrics = Object.fromEntries(
    Object.entries(targetCounts).map(([target, values]) => [
      target,
      {
        failures: values.failures,
        latency_ms: {
          max: Number(Math.max(...values.durations).toFixed(2)),
          p50: percentile(values.durations, 0.5),
          p95: percentile(values.durations, 0.95)
        },
        requests: values.requests
      }
    ])
  );

  const p95 = percentile(durations, 0.95);
  return {
    concurrency: phase.concurrency,
    duration_ms: Number(wallDurationMs.toFixed(2)),
    error_rate: Number((failures.length / results.length).toFixed(4)),
    failures: failures.slice(0, 10),
    latency_ms: {
      max: Number(Math.max(...durations).toFixed(2)),
      p50: percentile(durations, 0.5),
      p95,
      p99: percentile(durations, 0.99)
    },
    max_p95_ms: phase.maxP95Ms,
    name: phase.name,
    passed:
      failures.length === 0 &&
      (!enforceSlo || (p95 !== null && p95 <= phase.maxP95Ms)),
    requests: results.length,
    requests_per_second: Number(
      (results.length / Math.max(wallDurationMs / 1000, 0.001)).toFixed(2)
    ),
    status_counts: statusCounts,
    target_metrics: targetMetrics
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Song Thanh — Load and reliability baseline',
    '',
    `Generated at: \`${report.generated_at}\``,
    '',
    `Runtime mode: \`${report.environment.runtime_mode}\`; latency gate: \`${report.environment.slo_enforced ? 'enforced' : 'observation only'}\`.`,
    '',
    '> Đây là phép đo trên máy phát triển và database QA cô lập. Khi chạy production build, các ngưỡng bên dưới là regression gate của bản build này, không phải cam kết năng lực máy chủ production thật.',
    '',
    '| Phase | Result | Requests | Concurrency | Error rate | p50 | p95 / gate | p99 | Max | Req/s |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];

  for (const phase of report.phases) {
    lines.push(
      `| ${phase.name} | ${phase.passed ? 'PASS' : 'FAIL'} | ${phase.requests} | ${phase.concurrency} | ${(phase.error_rate * 100).toFixed(2)}% | ${phase.latency_ms.p50} ms | ${phase.latency_ms.p95} / ${phase.max_p95_ms} ms | ${phase.latency_ms.p99} ms | ${phase.latency_ms.max} ms | ${phase.requests_per_second} |`
    );
  }

  lines.push(
    '',
    `Result: **${report.passed ? 'PASS' : 'FAIL'}**`,
    '',
    enforceSlo
      ? 'Pass gate: 0 lỗi HTTP/timeout và p95 không vượt ngưỡng đã khai báo trước cho từng phase.'
      : 'Pass gate: 0 lỗi HTTP/timeout; latency được ghi nhận nhưng chưa chặn development runtime.',
    '',
    'Per-target evidence:',
    ''
  );

  for (const phase of report.phases) {
    lines.push(`- **${phase.name}**`);
    for (const [target, metrics] of Object.entries(phase.target_metrics)) {
      lines.push(
        `  - \`${target}\`: ${metrics.requests} requests, ${metrics.failures} failures, p50 ${metrics.latency_ms.p50} ms, p95 ${metrics.latency_ms.p95} ms, max ${metrics.latency_ms.max} ms`
      );
    }
  }

  lines.push(
    '',
    'Covered:',
    '',
    '- API normal/load/spike trên health DB, site shell, taxonomy, product listing, search suggestion và news.',
    '- Next.js SSR normal/load trên trang chủ, danh sách sản phẩm và tìm kiếm.',
    '- Response body được đọc hết để tính cả thời gian truyền/serialize, không chỉ thời gian nhận headers.',
    '',
    'Not covered by this short local baseline:',
    '',
    '- soak nhiều giờ, giới hạn CPU/RAM của máy production, CDN/Cloudflare/R2 và tải phân tán nhiều IP;',
    '- write-heavy import/apply; luồng này được đo riêng bằng invariant/integration suite để không phá tính cô lập dữ liệu.',
    ''
  );

  return `${lines.join('\n')}\n`;
}

process.stdout.write('Warming every target before measurement... ');
const warmupResults = [];
for (const target of [...apiTargets, ...frontendTargets]) {
  warmupResults.push(await executeRequest(target, warmupRequestTimeoutMs));
}
const warmupFailures = warmupResults.filter((result) => !result.ok);
console.log(warmupFailures.length === 0 ? 'PASS' : `FAIL (${warmupFailures.length})`);

const phaseResults = [];
if (warmupFailures.length === 0) {
for (const phase of phases) {
  process.stdout.write(
    `Running ${phase.name}: ${phase.requests} requests, concurrency ${phase.concurrency}... `
  );
  const result = await runPhase(phase);
  phaseResults.push(result);
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} (${result.requests_per_second} req/s, p95 ${result.latency_ms.p95}/${result.max_p95_ms} ms)`
  );
}
}

const report = {
  generated_at: new Date().toISOString(),
  environment: {
    api_base_url: apiBaseUrl,
    frontend_base_url: frontendBaseUrl,
    database_name: process.env.DATABASE_NAME || null,
    node: process.version,
    request_timeout_ms: requestTimeoutMs,
    warmup_request_timeout_ms: warmupRequestTimeoutMs,
    runtime_mode: runtimeMode,
    slo_enforced: enforceSlo
  },
  passed:
    warmupFailures.length === 0 &&
    phaseResults.length === phases.length &&
    phaseResults.every(
      (phase) =>
        phase.passed &&
        phase.requests === phases.find((candidate) => candidate.name === phase.name)?.requests
    ),
  warmup_failures: warmupFailures,
  phases: phaseResults
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    path.join(outputDirectory, 'load-reliability-baseline.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  ),
  writeFile(
    path.join(outputDirectory, 'load-reliability-baseline.md'),
    renderMarkdown(report),
    'utf8'
  )
]);

if (!report.passed) {
  process.exitCode = 1;
}
