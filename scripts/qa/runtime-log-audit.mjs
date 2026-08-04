import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspaceRoot = process.cwd();
const runtimeDirectory =
  process.env.QA_RUNTIME_DIR?.trim() ||
  path.join(workspaceRoot, 'tmp', 'qa-runtime');
const reportPath = path.join(
  workspaceRoot,
  'docs',
  'working-notes',
  'runtime-log-qa-last-run.md'
);

const logFiles = [
  'api.err.log',
  'api.out.log',
  'admin.err.log',
  'frontend.err.log'
];

const forbiddenSignals = [
  {
    code: 'NODE_DEPRECATION',
    description: 'Node.js or dependency deprecation warning',
    pattern: /DeprecationWarning:/gi
  },
  {
    code: 'UNHANDLED_REJECTION',
    description: 'Unhandled promise rejection',
    pattern: /UnhandledPromiseRejection|unhandled rejection/gi
  },
  {
    code: 'MAX_LISTENERS',
    description: 'Possible event-listener leak',
    pattern: /MaxListenersExceededWarning/gi
  },
  {
    code: 'OUT_OF_MEMORY',
    description: 'Runtime exhausted the JavaScript heap',
    pattern: /FATAL ERROR[\s\S]{0,120}(?:heap out of memory|allocation failed)|heap out of memory/gi
  }
];

const findings = [];
const inspectedLogs = [];

for (const fileName of logFiles) {
  const filePath = path.join(runtimeDirectory, fileName);
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      continue;
    }
    throw error;
  }

  inspectedLogs.push({
    fileName,
    bytes: Buffer.byteLength(content, 'utf8')
  });

  for (const signal of forbiddenSignals) {
    const matches = [...content.matchAll(signal.pattern)];
    if (matches.length === 0) {
      continue;
    }
    findings.push({
      fileName,
      code: signal.code,
      description: signal.description,
      count: matches.length
    });
  }
}

const generatedAt = new Date().toISOString();
const reportLines = [
  '# Runtime log hygiene QA',
  '',
  `- Generated at: ${generatedAt}`,
  `- Runtime directory: \`${runtimeDirectory}\``,
  `- Logs inspected: ${inspectedLogs.length}`,
  `- Forbidden findings: ${findings.reduce((total, finding) => total + finding.count, 0)}`,
  '',
  '## Inspected logs',
  '',
  '| Log | Bytes |',
  '|---|---:|',
  ...inspectedLogs.map((item) => `| \`${item.fileName}\` | ${item.bytes} |`),
  '',
  '## Findings',
  ''
];

if (findings.length === 0) {
  reportLines.push('No deprecation, unhandled-rejection, listener-leak, or out-of-memory signal was found.');
} else {
  reportLines.push(
    '| Log | Code | Description | Count |',
    '|---|---|---|---:|',
    ...findings.map(
      (finding) =>
        `| \`${finding.fileName}\` | ${finding.code} | ${finding.description} | ${finding.count} |`
    )
  );
}

reportLines.push('');
await writeFile(reportPath, `${reportLines.join('\n')}\n`, 'utf8');

for (const item of inspectedLogs) {
  console.log(`PASS LOG-FILE ${item.fileName} inspected (${item.bytes} bytes)`);
}

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(
      `FAIL ${finding.code} ${finding.fileName}: ${finding.description} (${finding.count})`
    );
  }
  console.error(`Report: ${reportPath}`);
  process.exitCode = 1;
} else {
  console.log('PASS LOG-HYGIENE No forbidden runtime warning or fatal signal');
  console.log(`Report: ${reportPath}`);
}
