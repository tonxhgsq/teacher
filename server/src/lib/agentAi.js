const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding/v3';
const DEFAULT_MODEL = '请填写火山引擎模型或Endpoint ID';

function getAgentConfig() {
  const apiKey = process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
  const baseURL = (process.env.VOLCENGINE_BASE_URL || process.env.ARK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.VOLCENGINE_MODEL || process.env.ARK_MODEL || DEFAULT_MODEL;
  if (!apiKey || apiKey.includes('请填写')) throw new Error('缺少 VOLCENGINE_API_KEY');
  if (!model || model.includes('请填写')) throw new Error('缺少 VOLCENGINE_MODEL');
  return { apiKey, baseURL, model };
}

function createPayload(messages, { maxTokens = 1200, stream = false } = {}) {
  const { model } = getAgentConfig();
  return {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.4,
    stream
  };
}

export async function callAgentAi(messages, { maxTokens = 1200, timeoutMs = 45000 } = {}) {
  const { apiKey, baseURL } = getAgentConfig();
  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload(messages, { maxTokens })),
    signal: AbortSignal.timeout(timeoutMs)
  });

  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!resp.ok) {
    const detail = data?.error?.message || data?.message || text.slice(0, 300);
    throw new Error(`AI 接口失败：${detail}`);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 未返回回复内容');
  return String(content).trim();
}

export async function streamAgentAi(messages, onDelta, { maxTokens = 1200 } = {}) {
  const { apiKey, baseURL } = getAgentConfig();
  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createPayload(messages, { maxTokens, stream: true }))
  });

  if (!resp.ok) {
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    const detail = data?.error?.message || data?.message || text.slice(0, 300);
    throw new Error(`AI 接口失败：${detail}`);
  }
  if (!resp.body) throw new Error('AI 接口未返回流');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      let data;
      try { data = JSON.parse(payload); } catch { continue; }
      const delta = data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.message?.content || '';
      if (delta) await onDelta(delta);
    }
  }
}
