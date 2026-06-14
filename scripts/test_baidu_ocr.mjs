import { existsSync, readFileSync } from 'fs';

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    process.env[key] = raw.replace(/^['"]|['"]$/g, '');
  }
}

function encodeForm(data) {
  return new URLSearchParams(data).toString();
}

loadEnv('server/.env');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('usage: node scripts/test_baidu_ocr.mjs image.png');
  process.exit(2);
}

const apiKey = process.env.BAIDU_OCR_API_KEY;
const secretKey = process.env.BAIDU_OCR_SECRET_KEY;
if (!apiKey || !secretKey) {
  console.error('missing BAIDU_OCR_API_KEY or BAIDU_OCR_SECRET_KEY');
  process.exit(1);
}

const tokenResp = await fetch(
  `https://aip.baidubce.com/oauth/2.0/token?${encodeForm({
    grant_type: 'client_credentials',
    client_id: apiKey,
    client_secret: secretKey,
  })}`,
  { method: 'POST' },
);
const tokenData = await tokenResp.json();
if (!tokenResp.ok || !tokenData.access_token) {
  console.error(JSON.stringify(tokenData, null, 2));
  process.exit(1);
}

const image = readFileSync(imagePath).toString('base64');
const ocrResp = await fetch(
  `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${tokenData.access_token}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodeForm({
      image,
      detect_direction: 'false',
      paragraph: 'false',
      language_type: 'CHN_ENG',
    }),
  },
);
const ocrData = await ocrResp.json();
if (!ocrResp.ok || ocrData.error_code) {
  console.error(JSON.stringify(ocrData, null, 2));
  process.exit(1);
}

const lines = (ocrData.words_result || []).map(item => item.words);
console.log(JSON.stringify({
  words_result_num: ocrData.words_result_num,
  sample: lines.slice(0, 80),
  items: (ocrData.words_result || []).slice(0, 80).map(item => ({
    words: item.words,
    location: item.location,
  })),
}, null, 2));
