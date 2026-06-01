import Anthropic from '@anthropic-ai/sdk';

let client = null;
function getClient() {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });
  }
  return client;
}

// 调 Mimo，带重试。返回第一个 text block 的内容。
export async function callMimo(systemPrompt, userText, { retries = 3, retryDelayMs = 1500, maxTokens = 4000, useThinking = true } = {}) {
  const anthropic = getClient();
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const msg = await anthropic.messages.create({
        model: process.env.AI_MODEL,
        max_tokens: maxTokens,
        ...(useThinking ? { thinking: { type: 'enabled', budget_tokens: 2000 } } : {}),
        system: systemPrompt,
        messages: [{ role: 'user', content: userText }],
      });
      const textBlock = msg.content.find(b => b.type === 'text');
      if (!textBlock) throw new Error('Mimo 未返回文本 block');
      return textBlock.text.trim();
    } catch (err) {
      lastErr = err;
      // 503 / 429 / network 才重试
      const msg = String(err.message || '');
      const retryable = msg.includes('503') || msg.includes('429') || msg.includes('No available') || msg.includes('timeout');
      if (!retryable || i === retries - 1) throw err;
      console.warn(`[mimo] 第 ${i+1} 次失败，${retryDelayMs}ms 后重试：${msg.slice(0,80)}`);
      await new Promise(res => setTimeout(res, retryDelayMs));
    }
  }
  throw lastErr;
}

// 提取 JSON 数组或对象
export function extractJson(raw) {
  // 优先匹配数组
  let start = raw.indexOf('[');
  let end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    start = raw.indexOf('{');
    end = raw.lastIndexOf('}');
  }
  if (start === -1 || end === -1 || end < start) {
    throw new Error('未找到 JSON');
  }
  return JSON.parse(raw.slice(start, end + 1));
}
