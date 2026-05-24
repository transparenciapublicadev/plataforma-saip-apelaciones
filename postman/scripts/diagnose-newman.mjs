import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));

for (const required of ['json', 'collection', 'environment', 'config', 'out', 'markdown']) {
  if (!args[required]) {
    console.error(`Missing --${required}`);
    process.exit(1);
  }
}

const config = readJson(args.config);
const summary = existsSync(args.json) ? readJson(args.json) : emptySummary();
const collection = readJson(args.collection);
const environment = readJson(args.environment);
const env = environmentMap(environment);
const collectionVariables = new Set((collection.variable || []).map((variable) => variable.key));

const diagnostics = {
  generatedAt: new Date().toISOString(),
  collection: path.basename(args.collection),
  environment: path.basename(args.environment),
  summary: {
    totalRequests: summary.run?.stats?.requests?.total || 0,
    failedTests: summary.run?.stats?.assertions?.failed || 0,
    httpErrors: 0,
    expectedHttpErrors: 0,
    runtimeFailures: summary.run?.failures?.length || 0,
    problemDetailsViolations: 0,
    environmentProblems: 0,
    environmentWarnings: 0,
  },
  environmentProblems: validateEnvironment({
    collection,
    collectionVariables,
    config,
    env,
  }),
  httpErrors: [],
  expectedHttpErrors: [],
  runtimeFailures: [],
  problemDetailsViolations: [],
};

for (const execution of summary.run?.executions || []) {
  const response = execution.response;
  const status = response?.code || 0;

  if (status >= 400 || config.diagnosticStatusCodes.includes(status)) {
    const bodyText = responseBody(response);
    const parsedBody = parseJson(bodyText);
    const request = execution.request || {};
    const itemName = execution.item?.name || 'Unnamed request';
    const method = request.method || 'UNKNOWN';
    const url = requestUrl(request);
    const expectedError = isExpectedErrorRequest({ request, itemName });
    const classification = classifyError({
      status,
      itemName,
      method,
      url,
      request,
      parsedBody,
      bodyText,
    });

    const errorFinding = {
      request: itemName,
      method,
      url,
      status,
      category: classification.category,
      source: classification.source,
      detail: classification.detail,
      backendDetail: parsedBody?.detail || parsedBody?.mensaje || response?.status || bodyText.slice(0, 240),
    };

    if (expectedError) {
      diagnostics.expectedHttpErrors.push(errorFinding);
    } else {
      diagnostics.httpErrors.push(errorFinding);
    }

    const violation = validateProblemDetails(status, parsedBody, itemName, method, url);
    if (violation) {
      diagnostics.problemDetailsViolations.push(violation);
    }
  }
}

for (const failure of summary.run?.failures || []) {
  diagnostics.runtimeFailures.push({
    request: failure.source?.name || failure.parent?.name || 'Unknown source',
    error: failure.error?.name || 'Failure',
    message: failure.error?.message || 'No failure message available.',
    category: classifyFailure(failure),
  });
}

diagnostics.summary.httpErrors = diagnostics.httpErrors.length;
diagnostics.summary.expectedHttpErrors = diagnostics.expectedHttpErrors.length;
diagnostics.summary.problemDetailsViolations = diagnostics.problemDetailsViolations.length;
diagnostics.summary.environmentProblems = diagnostics.environmentProblems.filter((item) => item.severity !== 'warning').length;
diagnostics.summary.environmentWarnings = diagnostics.environmentProblems.filter((item) => item.severity === 'warning').length;

writeFileSync(args.out, `${JSON.stringify(diagnostics, null, 2)}\n`, 'utf8');
writeFileSync(args.markdown, markdown(diagnostics), 'utf8');

printConsoleSummary(diagnostics);

function parseArgs(input) {
  const parsed = {};
  for (let index = 0; index < input.length; index += 1) {
    const arg = input[index];
    if (arg.startsWith('--')) {
      parsed[arg.slice(2)] = input[index + 1];
      index += 1;
    }
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function emptySummary() {
  return { run: { stats: { requests: { total: 0 }, assertions: { failed: 0 } }, executions: [], failures: [] } };
}

function environmentMap(environmentJson) {
  const values = new Map();
  for (const variable of environmentJson.values || []) {
    if (variable.enabled !== false) {
      values.set(variable.key, variable.value);
    }
  }
  return values;
}

function validateEnvironment({ collection, collectionVariables, config, env }) {
  const problems = [];
  const usedVariables = collectVariablesFromRequests(collection);
  const runtimeVariables = new Set([
    ...(config.runtimeVariables || []),
    ...(config.tokenVariables || []),
  ]);

  for (const variable of usedVariables) {
    if (!env.has(variable) && !collectionVariables.has(variable) && !runtimeVariables.has(variable)) {
      problems.push({
        key: variable,
        category: 'environment mal configurado',
        detail: `Variable {{${variable}}} usada por la colección pero no definida en environment, variables de colección ni runtime.`,
      });
    }
  }

  for (const tokenKey of config.tokenVariables || []) {
    const token = env.get(tokenKey);
    if (!token || String(token).startsWith('TOKEN_')) {
      problems.push({
        key: tokenKey,
        category: 'token faltante',
        detail: `El environment versionado no debe guardar JWT reales; ${tokenKey} se genera durante login. Si ejecuta carpetas protegidas de forma aislada, ejecute primero npm run test:api:auth.`,
        severity: 'warning',
      });
    }
  }

  for (const expectation of config.seedExpectations || []) {
    const actual = env.get(expectation.key);
    if (actual !== expectation.expected) {
      problems.push({
        key: expectation.key,
        category: expectation.category,
        detail: `Valor actual "${actual}" no coincide con "${expectation.expected}" declarado por ${expectation.source}.`,
        severity: 'error',
      });
    }
  }

  return problems;
}

function collectVariablesFromRequests(collection) {
  const variables = new Set();
  const visit = (items = []) => {
    for (const item of items) {
      if (item.request) {
        scanValue(item.request.url?.raw, variables);
        for (const header of item.request.header || []) {
          scanValue(header.value, variables);
        }
        scanValue(item.request.body?.raw, variables);
      }
      visit(item.item || []);
    }
  };
  visit(collection.item || []);
  return variables;
}

function scanValue(value, variables) {
  if (typeof value !== 'string') {
    return;
  }
  const matches = value.matchAll(/{{\s*([^{}\s]+)\s*}}/g);
  for (const match of matches) {
    variables.add(match[1]);
  }
}

function responseBody(response) {
  if (!response) {
    return '';
  }
  if (typeof response.stream === 'string') {
    return response.stream;
  }
  if (response.stream?.data) {
    return Buffer.from(response.stream.data).toString('utf8');
  }
  if (typeof response.body === 'string') {
    return response.body;
  }
  return '';
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function requestUrl(request) {
  if (typeof request.url === 'string') {
    return request.url;
  }
  if (!request.url || typeof request.url !== 'object') {
    return '';
  }

  if (typeof request.url.raw === 'string' && request.url.raw.length > 0) {
    return request.url.raw;
  }

  const protocol = request.url.protocol || 'http';
  const host = Array.isArray(request.url.host) ? request.url.host.join('.') : String(request.url.host || '');
  const port = request.url.port ? `:${request.url.port}` : '';
  const pathSegments = Array.isArray(request.url.path) ? request.url.path : [];
  const requestPath = pathSegments.map((segment) => String(segment)).join('/');
  const query = Array.isArray(request.url.query)
    ? request.url.query
        .filter((param) => !param.disabled)
        .map((param) => `${param.key}=${param.value}`)
        .join('&')
    : '';

  return `${protocol}://${host}${port}/${requestPath}${query ? `?${query}` : ''}`;
}

function isExpectedErrorRequest({ request, itemName }) {
  if (String(itemName || '').includes('[EXPECTED_ERROR]')) {
    return true;
  }
  for (const header of request.header || []) {
    if (String(header.key || '').toLowerCase() === 'x-expected-error'
        && String(header.value || '').toLowerCase() === 'true') {
      return true;
    }
  }
  return false;
}

function classifyError({ status, itemName, method, url, request, parsedBody, bodyText }) {
  const detail = `${parsedBody?.title || ''} ${parsedBody?.detail || ''} ${parsedBody?.mensaje || ''} ${bodyText}`.toLowerCase();
  const unresolvedVariable = url.includes('{{') || bodyText.includes('{{') || JSON.stringify(request).includes('{{');

  if (unresolvedVariable) {
    return problem('environment mal configurado', 'Postman collection/environment', 'La request conserva variables sin resolver.');
  }

  if (status === 401) {
    if (url.includes('/auth/login')) {
      return problem('credenciales incorrectas', 'Environment credentials', 'El login falló; valide usuario/password contra database/script_saip_db.sql.');
    }
    return problem('token faltante', 'Environment tokens', 'La request protegida no recibió un JWT válido.');
  }

  if (status === 403) {
    return problem('credenciales incorrectas', 'Role authorization', 'El token existe pero no autoriza el rol requerido por el endpoint.');
  }

  if (status === 404) {
    if (detail.includes('endpoint not found') || detail.includes('no existe un endpoint')) {
      return problem('backend bug', 'Backend route contract', 'La colección espera una ruta que el backend no expone.');
    }
    if (hasIdInUrl(url)) {
      return problem('IDs inexistentes', 'Environment IDs or seed SQL', 'El endpoint recibió un ID o expediente inexistente para la base actual.');
    }
    return problem('seed SQL desalineado', 'Database seed', 'El recurso esperado por la colección no aparece en la base cargada.');
  }

  if (status === 400) {
    return problem('payload inválido', 'Request body/query params', 'El backend rechazó formato, campos requeridos o tipos inválidos.');
  }

  if (status === 409) {
    if (method === 'POST' && (detail.includes('ya existe') || detail.includes('duplic'))) {
      return problem('seed SQL desalineado', 'Database seed or idempotent request', 'La colección intenta crear un dato ya presente en la base.');
    }
    return problem('regla de negocio', 'Domain rules', 'La operación viola una regla de negocio o una transición de estado.');
  }

  if (status === 422) {
    return problem('regla de negocio', 'Domain rules', 'El payload es válido, pero la operación no es permitida por el estado/plazo actual.');
  }

  if (status >= 500) {
    return problem('bug backend', 'Backend runtime', 'El backend lanzó un error 5xx; revisar logs y stack trace.');
  }

  return problem('bug backend', 'Unknown', `Estado ${status} no clasificado para ${itemName}.`);
}

function problem(category, source, detail) {
  return { category, source, detail };
}

function hasIdInUrl(url) {
  return /\/\d+($|[/?#])/.test(url) || /SAIP-\d{4}-\d{5}/.test(url) || /\d{5}-\d{4}-JUS\/TTAIP/.test(url);
}

function validateProblemDetails(status, parsedBody, request, method, url) {
  if (!parsedBody || typeof parsedBody !== 'object') {
    return {
      request,
      method,
      url,
      status,
      missing: ['type', 'title', 'status', 'detail', 'instance'],
      detail: 'La respuesta de error no es JSON Problem Details.',
    };
  }

  const required = ['type', 'title', 'status', 'detail', 'instance'];
  const missing = required.filter((field) => parsedBody[field] === undefined || parsedBody[field] === null || parsedBody[field] === '');
  if (parsedBody.status !== status) {
    missing.push(`status=${status}`);
  }

  if (missing.length === 0) {
    return null;
  }

  return {
    request,
    method,
    url,
    status,
    missing,
    detail: 'La respuesta de error no cumple RFC 9457 / Problem Details.',
  };
}

function classifyFailure(failure) {
  const message = `${failure.error?.name || ''} ${failure.error?.message || ''}`.toLowerCase();
  const requestName = `${failure.source?.name || failure.parent?.name || ''}`.toLowerCase();

  if (message.includes('returned 401')) {
    return requestName.includes('login') ? 'credenciales incorrectas' : 'token faltante';
  }
  if (message.includes('returned 403')) {
    return 'credenciales incorrectas';
  }
  if (message.includes('returned 404')) {
    return 'IDs inexistentes';
  }
  if (message.includes('returned 409')) {
    return message.includes('ya existe') ? 'seed SQL desalineado' : 'regla de negocio';
  }
  if (message.includes('returned 422')) {
    return 'regla de negocio';
  }
  if (/returned 5\d\d/.test(message)) {
    return 'bug backend';
  }

  if (message.includes('problem details')) {
    return 'bug backend';
  }
  if (message.includes('econnrefused') || message.includes('enotfound') || message.includes('etimedout')) {
    return 'backend no disponible';
  }
  if (message.includes('no http response') || message.includes('returned undefined') || message.includes('"undefined" is not valid json')) {
    return 'backend no disponible';
  }
  if (message.includes('status is below 400') || message.includes('returned')) {
    return 'regla de negocio';
  }
  if (message.includes('variable') || message.includes('token') || message.includes('environment')) {
    return 'environment mal configurado';
  }
  return 'payload inválido';
}

function markdown(diagnostic) {
  const lines = [
    '# SAIP API Newman Diagnostic',
    '',
    `Generated at: ${diagnostic.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Total requests: ${diagnostic.summary.totalRequests}`,
    `- Failed tests: ${diagnostic.summary.failedTests}`,
    `- HTTP errors: ${diagnostic.summary.httpErrors}`,
    `- Expected HTTP errors: ${diagnostic.summary.expectedHttpErrors}`,
    `- Runtime/assertion failures: ${diagnostic.summary.runtimeFailures}`,
    `- Problem Details violations: ${diagnostic.summary.problemDetailsViolations}`,
    `- Environment problems: ${diagnostic.summary.environmentProblems}`,
    `- Environment warnings: ${diagnostic.summary.environmentWarnings}`,
    '',
    '## Environment And Seed Checks',
    '',
    ...table(
      ['Key', 'Category', 'Detail'],
      diagnostic.environmentProblems.map((item) => [item.key, item.category, item.detail]),
    ),
    '',
    '## HTTP Error Classification',
    '',
    ...table(
      ['Request', 'Method', 'Status', 'Category', 'Likely Source', 'Detail'],
      diagnostic.httpErrors.map((item) => [
        item.request,
        item.method,
        String(item.status),
        item.category,
        item.source,
        item.backendDetail || item.detail,
      ]),
    ),
    '',
    '## Expected Negative HTTP Checks',
    '',
    ...table(
      ['Request', 'Method', 'Status', 'Category', 'Likely Source', 'Detail'],
      diagnostic.expectedHttpErrors.map((item) => [
        item.request,
        item.method,
        String(item.status),
        item.category,
        item.source,
        item.backendDetail || item.detail,
      ]),
    ),
    '',
    '## Problem Details Contract',
    '',
    ...table(
      ['Request', 'Status', 'Missing/Issue'],
      diagnostic.problemDetailsViolations.map((item) => [item.request, String(item.status), item.missing.join(', ')]),
    ),
    '',
    '## Runtime Failures',
    '',
    ...table(
      ['Request', 'Category', 'Message'],
      diagnostic.runtimeFailures.map((item) => [item.request, item.category, item.message]),
    ),
    '',
    '## Reading Guide',
    '',
    '- `environment mal configurado`: missing variables, unresolved placeholders or wrong base values.',
    '- `credenciales incorrectas`: login credentials or role/token mismatch.',
    '- `token faltante`: protected requests ran before a valid login token was captured.',
    '- `IDs inexistentes`: environment IDs or expediente values do not exist in the loaded database.',
    '- `seed SQL desalineado`: collection assumes data not produced by `database/script_saip_db.sql`.',
    '- `payload inválido`: request body/query does not match backend validation.',
    '- `regla de negocio`: valid request rejected by domain state, dates, ownership or transition rules.',
    '- `backend no disponible`: Newman could not connect to `baseUrl` or the API process is not running.',
    '- `bug backend`: 5xx errors or backend route/error-contract defects.',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function table(headers, rows) {
  if (rows.length === 0) {
    return ['No findings.'];
  }

  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((value) => escapeCell(truncate(String(value || ''), 180))).join(' | ')} |`),
  ];
}

function escapeCell(value) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function printConsoleSummary(diagnostic) {
  console.log('');
  console.log('SAIP API diagnostic summary');
  console.log(`- HTTP errors: ${diagnostic.summary.httpErrors}`);
  console.log(`- Expected HTTP errors: ${diagnostic.summary.expectedHttpErrors}`);
  console.log(`- Problem Details violations: ${diagnostic.summary.problemDetailsViolations}`);
  console.log(`- Environment problems: ${diagnostic.summary.environmentProblems}`);
  console.log(`- Environment warnings: ${diagnostic.summary.environmentWarnings}`);
  console.log(`- Runtime/assertion failures: ${diagnostic.summary.runtimeFailures}`);
}
