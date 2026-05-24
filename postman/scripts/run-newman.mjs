import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const newman = require('newman');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postmanRoot = path.resolve(__dirname, '..');
const configPath = path.join(postmanRoot, 'newman.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const options = parseArgs(process.argv.slice(2));

const reportsDir = path.resolve(postmanRoot, config.reportsDir);
mkdirSync(reportsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const mode = options.mode || 'api';
const reportBase = `saip-api-${mode}-${timestamp}`;
const jsonReport = path.join(reportsDir, `${reportBase}.newman.json`);
const junitReport = path.join(reportsDir, `${reportBase}.newman.xml`);
const htmlReport = path.join(reportsDir, `${reportBase}.newman.html`);
const diagnosticJson = path.join(reportsDir, `${reportBase}.diagnostic.json`);
const diagnosticMarkdown = path.join(reportsDir, `${reportBase}.diagnostic.md`);

const collection = path.resolve(postmanRoot, config.collection);
const environment = path.resolve(postmanRoot, config.environment);

if (!existsSync(collection)) {
  console.error(`Collection not found: ${collection}`);
  process.exit(1);
}

if (!existsSync(environment)) {
  console.error(`Environment not found: ${environment}`);
  process.exit(1);
}

const reporterNames = (config.reporters || ['cli']).filter((reporter) => reporter !== 'json');
const newmanOptions = {
  collection,
  environment,
  reporters: reporterNames,
  reporter: {
    junit: {
      export: junitReport,
    },
    htmlextra: {
      export: htmlReport,
      title: `SAIP API ${mode} validation`,
    },
  },
  timeoutRequest: config.timeoutRequest,
  delayRequest: config.delayRequest || 0,
  color: 'on',
};

if (mode === 'auth' && !options.folder) {
  newmanOptions.folder = '01. Autenticación';
}

if (options.folder) {
  newmanOptions.folder = options.folder;
}

if (options.bail || mode === 'bail') {
  newmanOptions.bail = true;
}

console.log(`Running Newman mode: ${mode}`);
console.log(`Collection: ${collection}`);
console.log(`Environment: ${environment}`);
console.log(`Reports directory: ${reportsDir}`);

let summary;
try {
  summary = await runNewman(newmanOptions);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}

writeFileSync(jsonReport, `${JSON.stringify(sanitizeSummary(summary, config), null, 2)}\n`, 'utf8');

const diagnosticArgs = [
  path.join(__dirname, 'diagnose-newman.mjs'),
  '--json',
  jsonReport,
  '--collection',
  collection,
  '--environment',
  environment,
  '--config',
  configPath,
  '--out',
  diagnosticJson,
  '--markdown',
  diagnosticMarkdown,
];

const diagnosticResult = spawnSync(process.execPath, diagnosticArgs, {
  cwd: postmanRoot,
  stdio: 'inherit',
  shell: false,
});

if (diagnosticResult.error) {
  console.error(diagnosticResult.error.message);
  process.exit(1);
}

const diagnostic = JSON.parse(readFileSync(diagnosticJson, 'utf8'));
console.log('');
console.log('Generated reports:');
console.log(`- JSON: ${jsonReport}`);
console.log(`- JUnit: ${junitReport}`);
console.log(`- HTML: ${htmlReport}`);
console.log(`- Diagnostic JSON: ${diagnosticJson}`);
console.log(`- Diagnostic Markdown: ${diagnosticMarkdown}`);

const hasBlockingDiagnostics =
  diagnostic.summary.httpErrors > 0 ||
  diagnostic.summary.runtimeFailures > 0 ||
  diagnostic.summary.problemDetailsViolations > 0 ||
  diagnostic.summary.environmentProblems > 0 ||
  diagnostic.summary.failedTests > 0;

process.exit(hasBlockingDiagnostics ? 1 : 0);

function runNewman(runOptions) {
  return new Promise((resolve, reject) => {
    newman.run(runOptions, (error, runSummary) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(runSummary);
    });
  });
}

function sanitizeSummary(runSummary, diagnosticConfig) {
  const executions = (runSummary.run?.executions || []).map((execution) =>
    sanitizeExecution(execution, diagnosticConfig)
  );

  return {
    collection: {
      name: runSummary.collection?.name,
    },
    environment: {
      name: runSummary.environment?.name,
    },
    run: {
      stats: runSummary.run?.stats,
      failures: (runSummary.run?.failures || []).map(sanitizeFailure),
      executions,
    },
  };
}

function sanitizeExecution(execution, diagnosticConfig) {
  const status = execution.response?.code || 0;
  const keepResponseBody =
    status >= 400 || (diagnosticConfig.diagnosticStatusCodes || []).includes(status);

  return {
    item: {
      name: execution.item?.name,
    },
    request: sanitizeRequest(execution.request),
    response: execution.response
      ? {
          code: execution.response.code,
          status: execution.response.status,
          stream: keepResponseBody ? limitedBody(execution.response) : '',
        }
      : null,
  };
}

function sanitizeRequest(request) {
  return {
    method: request?.method,
    url: request?.url?.toString ? request.url.toString() : String(request?.url || ''),
    header: listToArray(request?.headers || request?.header).map((header) => ({
      key: header.key,
      value: header.value,
    })),
    body: request?.body
      ? {
          raw: request.body.raw || '',
        }
      : undefined,
  };
}

function sanitizeFailure(failure) {
  return {
    source: {
      name: failure.source?.name,
    },
    parent: {
      name: failure.parent?.name,
    },
    error: {
      name: failure.error?.name,
      message: failure.error?.message,
    },
  };
}

function listToArray(value) {
  if (!value) {
    return [];
  }
  if (typeof value.all === 'function') {
    return value.all();
  }
  if (Array.isArray(value.members)) {
    return value.members;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function limitedBody(response) {
  const stream = response.stream;
  let body = '';

  if (typeof stream === 'string') {
    body = stream;
  } else if (Buffer.isBuffer(stream)) {
    body = stream.toString('utf8');
  } else if (stream?.data) {
    body = Buffer.from(stream.data).toString('utf8');
  } else if (typeof response.body === 'string') {
    body = response.body;
  }

  return body.slice(0, 64_000);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--mode') {
      parsed.mode = args[index + 1];
      index += 1;
    } else if (arg === '--folder') {
      parsed.folder = args[index + 1];
      index += 1;
    } else if (arg === '--bail') {
      parsed.bail = true;
    }
  }
  return parsed;
}
