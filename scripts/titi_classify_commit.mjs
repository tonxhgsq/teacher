import { readFileSync, writeFileSync } from 'fs';
import { createSession } from '../server/src/lib/auth.js';

const INPUT = process.argv[2] || 'tmp/titi_pdf_text_questions.json';
const label = process.argv[3] || INPUT.replace(/^.*\/|\.json$/g, '') || 'titi_import';
const CLASSIFIED_OUT = `tmp/${label}_classified_imports.json`;
const COMMIT_OUT = `tmp/${label}_commit_results.json`;
const API = 'http://127.0.0.1:3001/api/upload';
const OWNER_USER_ID = 5;
const CHUNK_SIZE = 5;

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function api(path, token, body) {
  const resp = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-json: ${text.slice(0, 300)}`);
  }
  if (!resp.ok || data.error) {
    throw new Error(`${path} failed: ${data.error || text.slice(0, 300)}`);
  }
  return data;
}

const source = JSON.parse(readFileSync(INPUT, 'utf8'));
const imports = source.imports.filter(item => item.questions?.length);
const { token } = await createSession(OWNER_USER_ID);

const classifiedImports = [];
const classifyErrors = [];
let classifiedFiles = 0;

for (const group of chunks(imports, CHUNK_SIZE)) {
  const result = await api('/classify', token, { imports: group, force: true });
  for (const item of result.results || []) {
    if (item.error) {
      classifyErrors.push({ file: item.file, error: item.error });
    } else {
      classifiedImports.push({
        file: item.file,
        fileType: item.fileType || 'pdf',
        questions: item.questions || [],
        source: item.source,
        warning: item.warning || '',
      });
      classifiedFiles += 1;
    }
  }
  console.log(`classified ${classifiedFiles}/${imports.length}`);
}

writeFileSync(CLASSIFIED_OUT, JSON.stringify({ imports: classifiedImports, errors: classifyErrors }, null, 2));

const commitResults = [];
const commitErrors = [];
let committedFiles = 0;

for (const group of chunks(classifiedImports, CHUNK_SIZE)) {
  const result = await api('/commit', token, { imports: group });
  for (const item of result.results || []) {
    if (item.error) {
      commitErrors.push({ file: item.file, error: item.error });
    } else {
      commitResults.push(item);
      committedFiles += 1;
    }
  }
  console.log(`committed ${committedFiles}/${classifiedImports.length}`);
}

writeFileSync(COMMIT_OUT, JSON.stringify({ results: commitResults, errors: commitErrors }, null, 2));

const inserted = commitResults.reduce((sum, item) => sum + Number(item.count || 0), 0);
const skipped = commitResults.reduce((sum, item) => sum + Number(item.skippedCount || 0), 0);
console.log(JSON.stringify({
  inputFiles: imports.length,
  classifiedFiles,
  classifyErrors: classifyErrors.length,
  committedFiles,
  commitErrors: commitErrors.length,
  inserted,
  skipped,
}, null, 2));
