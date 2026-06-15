import crypto from 'crypto';

export function hasCredentialKey() {
  return !!(process.env.FEISHU_CREDENTIAL_KEY || process.env.MIMO_API_KEY || process.env.ANTHROPIC_API_KEY);
}

function key() {
  const source = process.env.FEISHU_CREDENTIAL_KEY || process.env.MIMO_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!source) throw new Error('缺少 FEISHU_CREDENTIAL_KEY');
  return crypto.createHash('sha256').update(source).digest();
}

export function encryptCredential(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(v => v.toString('base64url')).join('.');
}

export function decryptCredential(value) {
  const [iv, tag, encrypted] = String(value).split('.').map(v => Buffer.from(v, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
