import crypto from 'crypto';

const smtpRequired = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
const tencentRequired = ['TENCENTCLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_KEY', 'TENCENT_SES_FROM_EMAIL'];

const trimEnv = key => String(process.env[key] || '').trim();

function mailProvider() {
  const provider = trimEnv('MAIL_PROVIDER').toLowerCase();
  if (provider) return provider;
  if (isTencentMailConfigured()) return 'tencent';
  if (isSmtpMailConfigured()) return 'smtp';
  return '';
}

function isSmtpMailConfigured() {
  return smtpRequired.every(key => trimEnv(key));
}

function isTencentMailConfigured() {
  return tencentRequired.every(key => trimEnv(key));
}

export function isMailConfigured() {
  return Boolean(mailProvider());
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function formatTencentDate(date) {
  return date.toISOString().slice(0, 10);
}

async function sendTencentVerificationEmail(email, code) {
  if (!isTencentMailConfigured()) throw new Error('腾讯云邮件服务未配置完整');
  const endpoint = trimEnv('TENCENT_SES_ENDPOINT') || 'ses.tencentcloudapi.com';
  const region = trimEnv('TENCENT_SES_REGION') || 'ap-guangzhou';
  const service = 'ses';
  const action = 'SendEmail';
  const version = '2020-10-02';
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const date = formatTencentDate(now);
  const payload = JSON.stringify({
    FromEmailAddress: trimEnv('TENCENT_SES_FROM_EMAIL'),
    Destination: [email],
    Subject: 'AI 学情工作台邮箱验证码',
    Simple: {
      Text: `你的验证码是 ${code}，10 分钟内有效。`,
      Html: `<p>你的验证码是 <strong>${code}</strong>，10 分钟内有效。</p>`,
    },
  });
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join('\n');
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');
  const secretDate = hmac(`TC3${trimEnv('TENCENTCLOUD_SECRET_KEY')}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = hmac(secretSigning, stringToSign, 'hex');
  const authorization = [
    `TC3-HMAC-SHA256 Credential=${trimEnv('TENCENTCLOUD_SECRET_ID')}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  const response = await fetch(`https://${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: endpoint,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Region': region,
      'X-TC-Timestamp': String(timestamp),
    },
    body: payload,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.Response?.Error) {
    const message = body.Response?.Error?.Message || `腾讯云邮件 API 请求失败：${response.status}`;
    throw new Error(message);
  }
  return { sent: true, dev: false, provider: 'tencent' };
}

async function sendSmtpVerificationEmail(email, code) {
  if (!isSmtpMailConfigured()) throw new Error('SMTP 邮件服务未配置完整');
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: trimEnv('SMTP_HOST'),
    port: Number(trimEnv('SMTP_PORT')),
    secure: trimEnv('SMTP_SECURE').toLowerCase() === 'true',
    auth: {
      user: trimEnv('SMTP_USER'),
      pass: trimEnv('SMTP_PASS'),
    },
  });
  await transporter.sendMail({
    from: trimEnv('MAIL_FROM'),
    to: email,
    subject: 'AI 学情工作台邮箱验证码',
    text: `你的验证码是 ${code}，10 分钟内有效。`,
    html: `<p>你的验证码是 <strong>${code}</strong>，10 分钟内有效。</p>`,
  });
  return { sent: true, dev: false, provider: 'smtp' };
}

export async function sendVerificationEmail(email, code) {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境未配置邮件服务');
    }
    return { sent: false, dev: true };
  }
  const provider = mailProvider();
  if (provider === 'tencent') return sendTencentVerificationEmail(email, code);
  if (provider === 'smtp') return sendSmtpVerificationEmail(email, code);
  throw new Error(`不支持的邮件服务：${provider}`);
}
