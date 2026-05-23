import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const newmanCli = path.join(postmanRoot, 'node_modules', 'newman', 'bin', 'newman.js');

if (!existsSync(newmanCli)) {
  console.error('Newman is not installed. Run `npm install` inside the postman directory first.');
  process.exit(1);
}

const collection = path.resolve(postmanRoot, config.collection);
const environment = path.resolve(postmanRoot, config.environment);
const reporters = config.reporters.join(',');

const newmanArgs = [
  newmanCli,
  'run',
  collection,
  '--environment',
  environment,
  '--reporters',
  reporters,
  '--reporter-json-export',
  jsonReport,
  '--reporter-junit-export',
  junitReport,
  '--reporter-htmlextra-export',
  htmlReport,
  '--reporter-htmlextra-title',
  `SAIP API ${mode} validation`,
  '--timeout-request',
  String(config.timeoutRequest),
  '--delay-request',
  String(config.delayRequest || 0),
  '--color',
  'on',
  '--suppress-exit-code',
];

if (mode === 'auth' && !options.folder) {
  newmanArgs.push('--folder', '01. Autenticación');
}

if (options.folder) {
  newmanArgs.push('--folder', options.folder);
}

if (options.bail || mode === 'bail') {
  newmanArgs.push('--bail', 'failure');
}

console.log(`Running Newman mode: ${mode}`);
console.log(`Collection: ${collection}`);
console.log(`Environment: ${environment}`);
console.log(`Reports directory: ${reportsDir}`);

const newmanResult = spawnSync(process.execPath, newmanArgs, {
  cwd: postmanRoot,
  stdio: 'inherit',
  shell: false,
});

if (newmanResult.error) {
  console.error(newmanResult.error.message);
  process.exit(1);
}

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
  diagnostic.summary.environmentProblems > 0;

process.exit(hasBlockingDiagnostics ? 1 : 0);

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
