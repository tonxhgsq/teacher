import { createLarkChannel, LoggerLevel } from '@larksuiteoapi/node-sdk';
import { db } from '../db/schema.js';
import { streamAgentAi } from './agentAi.js';
import { buildTeacherAgentMessages } from './agentContext.js';
import { decryptCredential, hasCredentialKey } from './credentialCrypto.js';

const channels = new Map();
const chatHistory = new Map();

async function updateStatus(appId, status, error = '') {
  await db.execute({
    sql: `UPDATE feishu_integrations
          SET status = ?, last_error = ?, updated_at = datetime('now','localtime')
          WHERE app_id = ?`,
    args: [status, error, appId]
  });
}

function historyFor(chatId) {
  const history = chatHistory.get(chatId) || [];
  chatHistory.set(chatId, history);
  return history;
}

async function answerMessage(channel, msg) {
  const text = String(msg.content || '').trim();
  if (!text) return;
  if (channel.botIdentity?.openId && msg.senderId === channel.botIdentity.openId) return;
  const history = historyFor(msg.chatId);
  history.push({ role: 'user', content: text });
  history.splice(0, Math.max(0, history.length - 10));

  try {
    const aiMessages = await buildTeacherAgentMessages(history);
    let reply = '';
    await channel.stream(
      msg.chatId,
      {
        markdown: async controller => {
          await streamAgentAi(aiMessages, async delta => {
            reply += delta;
            await controller.append(delta);
          }, { maxTokens: 1200 });
        }
      },
      { replyTo: msg.messageId }
    );
    history.push({ role: 'assistant', content: reply });
    history.splice(0, Math.max(0, history.length - 10));
  } catch (err) {
    console.error('[feishu/message]', err.message);
    await channel.send(msg.chatId, { text: `AI 助教暂时无法回复：${err.message}` }, { replyTo: msg.messageId }).catch(() => {});
  }
}

export async function startFeishuChannel({ appId, appSecret }) {
  if (channels.has(appId)) return channels.get(appId);

  const channel = createLarkChannel({
    appId,
    appSecret,
    transport: 'websocket',
    loggerLevel: LoggerLevel.info,
    source: 'teacher-ai-workbench',
    handshakeTimeoutMs: 20000,
    safety: { dedup: { ttl: 10 * 60 * 1000 }, chatQueue: { enabled: true } },
    policy: { dmMode: 'open', requireMention: true },
    outbound: {
      streamInitialText: 'AI 助教正在整理学情…',
      streamThrottleMs: 180,
      streamThrottleChars: 12
    }
  });

  channel.on('message', msg => {
    void answerMessage(channel, msg);
  });
  channel.on('error', err => {
    console.error(`[feishu/channel:${appId}]`, err.message);
    void updateStatus(appId, 'error', err.message);
  });
  channel.on('reconnecting', () => {
    void updateStatus(appId, 'reconnecting');
  });
  channel.on('reconnected', () => {
    void updateStatus(appId, 'connected');
  });

  await updateStatus(appId, 'connecting');
  try {
    await channel.connect();
    channels.set(appId, channel);
    await updateStatus(appId, 'connected');
    return channel;
  } catch (err) {
    await updateStatus(appId, 'failed', err.message);
    throw err;
  }
}

export async function restoreFeishuChannels() {
  const { rows } = await db.execute('SELECT app_id, app_secret_encrypted FROM feishu_integrations');
  if (rows.length && !hasCredentialKey()) {
    await db.execute({
      sql: `UPDATE feishu_integrations
            SET status = 'needs_config', last_error = '缺少 FEISHU_CREDENTIAL_KEY', updated_at = datetime('now','localtime')`
    });
    console.warn('[feishu] skipped restore: missing FEISHU_CREDENTIAL_KEY');
    return;
  }
  for (const row of rows) {
    try {
      await startFeishuChannel({
        appId: row.app_id,
        appSecret: decryptCredential(row.app_secret_encrypted)
      });
      console.log(`[feishu] restored ${row.app_id}`);
    } catch (err) {
      console.error(`[feishu] restore failed ${row.app_id}:`, err.message);
    }
  }
}

export function getFeishuChannelStatus(appId) {
  const channel = channels.get(appId);
  return channel?.getConnectionStatus?.() || null;
}
