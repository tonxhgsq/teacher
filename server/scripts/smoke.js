import { spawn } from 'child_process';

const port = Number(process.env.SMOKE_PORT || 3999);
const base = `http://127.0.0.1:${port}`;
const smokeId = Date.now();
const smokeUsername = `smoke-${smokeId}`;
const smokePassword = 'smoke-pass-123';
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), SYSTEM_QUESTION_BANK_OWNER: smokeUsername },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', d => { output += d.toString(); });
server.stderr.on('data', d => { output += d.toString(); });

async function waitForHealth() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`server did not become healthy\n${output}`);
}

async function json(path, options) {
  const res = await fetch(`${base}${path}`, options);
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  return body;
}

async function authedJson(token, path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return json(path, { ...options, headers });
}

async function registerSmokeUser() {
  const email = `${smokeUsername}@example.com`;
  const codeResp = await json('/api/auth/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!codeResp.devCode) throw new Error('smoke expects devCode when SMTP is not configured');
  const registered = await json('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: smokeUsername, email, password: smokePassword, code: codeResp.devCode }),
  });
  if (!registered.ok || registered.token) throw new Error('register should create the user without logging in');
  const loggedIn = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: smokeUsername, password: smokePassword }),
  });
  if (!loggedIn.token) throw new Error('login did not return token after register');
  return loggedIn.token;
}

async function ensureSeedData(token) {
  let students = await authedJson(token, '/api/students');
  if (students.length === 0) {
    await authedJson(token, '/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '冒烟测试学生', grade: '三年级', weakPoints: ['分数应用题'], homeworkRate: 90 }),
    });
    students = await authedJson(token, '/api/students');
  }

  let questions = await authedJson(token, '/api/questions');
  if (!questions.some(q => q.status === 'approved')) {
    await authedJson(token, '/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '一桶油重15千克，用去了2/5，还剩多少千克？',
        type: '应用题',
        difficulty: '提升',
        knowledgePoint: '分数应用题',
        answer: '9千克',
        status: 'approved',
      }),
    });
    questions = await authedJson(token, '/api/questions');
  }

  return { student: students[0], questions };
}

try {
  await waitForHealth();
  const token = await registerSmokeUser();
  const initialCredits = await authedJson(token, '/api/credits');
  const { student } = await ensureSeedData(token);
  const generated = await authedJson(token, '/api/homework/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: student.id, count: 3, difficulty: '基础' }),
  });
  if (!generated.ok || generated.questions.length === 0) throw new Error('homework generate returned no questions');
  if (!generated.credit) throw new Error('homework generate returned no credit summary');
  if (generated.credit.balance !== initialCredits.balance || !generated.credit.freeUse) {
    throw new Error('homework generate should be free during teacher trial');
  }

  const saved = await authedJson(token, '/api/homework', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: student.id, questions: generated.questions, status: 'draft' }),
  });
  if (!saved.ok || !saved.id) throw new Error('homework save failed');

  console.log(`smoke ok: generated ${generated.questions.length} questions, saved homework #${saved.id}`);
} finally {
  server.kill('SIGTERM');
}
