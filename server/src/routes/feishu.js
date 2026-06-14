import express from 'express';
import { randomUUID } from 'crypto';
import { registerApp } from '@larksuiteoapi/node-sdk';
import { db } from '../db/schema.js';
import { encryptCredential } from '../lib/credentialCrypto.js';
import { startFeishuChannel, getFeishuChannelStatus } from '../lib/feishuChannels.js';

const r = express.Router();
const sessions = new Map();

function publicSession(session) {
  return {
    id: session.id,
    status: session.status,
    url: session.url,
    expireIn: session.expireIn,
    appId: session.result?.client_id || '',
    connection: session.result?.client_id ? getFeishuChannelStatus(session.result.client_id) : null,
    tenantBrand: session.result?.user_info?.tenant_brand || '',
    openId: session.result?.user_info?.open_id || '',
    error: session.error || ''
  };
}

r.post('/one-click/start', async (req, res) => {
  const id = randomUUID();
  const controller = new AbortController();
  const session = {
    id,
    status: 'starting',
    url: '',
    expireIn: 0,
    result: null,
    error: '',
    controller,
    ownerUserId: req.user.id,
    createdAt: Date.now()
  };
  sessions.set(id, session);

  const ready = new Promise((resolve, reject) => {
    registerApp({
      source: 'teacher-ai-workbench',
      signal: controller.signal,
      appPreset: {
        name: '{user}的 AI 助教',
        desc: '帮助老师分析学生学情、生成练习、整理家长反馈。'
      },
      onQRCodeReady(info) {
        session.status = 'waiting';
        session.url = info.url;
        session.expireIn = info.expireIn;
        resolve();
      },
      onStatusChange(info) {
        session.status = info.status || session.status;
      }
    }).then(async result => {
      session.status = 'saving';
      session.result = result;
      await db.execute({
        sql: `INSERT INTO feishu_integrations
              (owner_user_id, app_id, app_secret_encrypted, owner_open_id, tenant_brand, status, last_error)
              VALUES (?, ?, ?, ?, ?, 'created', '')
              ON CONFLICT(app_id) DO UPDATE SET
                owner_user_id = excluded.owner_user_id,
                app_secret_encrypted = excluded.app_secret_encrypted,
                owner_open_id = excluded.owner_open_id,
                tenant_brand = excluded.tenant_brand,
                status = 'created',
                last_error = '',
                updated_at = datetime('now','localtime')`,
        args: [
          session.ownerUserId,
          result.client_id,
          encryptCredential(result.client_secret),
          result.user_info?.open_id || '',
          result.user_info?.tenant_brand || 'feishu'
        ]
      });
      session.status = 'connecting';
      await startFeishuChannel({ appId: result.client_id, appSecret: result.client_secret });
      session.status = 'connected';
    }).catch(err => {
      session.status = 'failed';
      session.error = err.description || err.message || String(err);
      reject(err);
    });
  });

  try {
    await ready;
    res.json({ ok: true, ...publicSession(session) });
  } catch (err) {
    res.status(500).json({ error: err.description || err.message || '飞书一键创建失败' });
  }
});

r.get('/one-click/status/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: '接入会话不存在或已过期' });
  if (session.ownerUserId !== req.user.id) return res.status(404).json({ error: '接入会话不存在或已过期' });
  res.json({ ok: true, ...publicSession(session) });
});

r.get('/integrations', async (req, res) => {
  const { rows } = await db.execute({
    sql: 'SELECT app_id, owner_open_id, tenant_brand, status, last_error, created_at, updated_at FROM feishu_integrations WHERE owner_user_id = ? ORDER BY id DESC',
    args: [req.user.id]
  });
  res.json({ ok: true, integrations: rows });
});

r.post('/one-click/cancel/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (session && session.ownerUserId !== req.user.id) return res.status(404).json({ error: '接入会话不存在或已过期' });
  if (session?.controller) session.controller.abort();
  sessions.delete(req.params.id);
  res.json({ ok: true });
});

export default r;
