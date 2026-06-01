// 百度 OCR 共用模块
let token = null;
let tokenExpiry = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiry) return token;
  const resp = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${process.env.BAIDU_OCR_API_KEY}&client_secret=${process.env.BAIDU_OCR_SECRET_KEY}`
  );
  const data = await resp.json();
  if (!data.access_token) throw new Error('百度 OCR 获取 token 失败：' + JSON.stringify(data));
  token = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}

const safeBase64 = buf => buf.toString('base64').replaceAll('+', '%2B').replaceAll('/', '%2F');

export async function ocrImage(imageBuffer) {
  const t = await getToken();
  const base64 = safeBase64(imageBuffer);
  const resp = await fetch(
    `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${t}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${base64}&detect_direction=false&paragraph=false`,
    }
  );
  const data = await resp.json();
  if (data.error_code) throw new Error('百度 OCR 错误：' + data.error_msg);
  return data.words_result.map(w => w.words).join('\n');
}

export async function ocrPdf(pdfBuffer, maxPages = 20, pageDelayMs = 600) {
  const t = await getToken();
  const base64 = safeBase64(pdfBuffer);

  async function ocrPage(pageNum) {
    const resp = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${t}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `pdf_file_num=${pageNum}&pdf_file=${base64}`,
        signal: AbortSignal.timeout(30000),
      }
    );
    const data = await resp.json();
    if (data.error_code) throw new Error('百度 OCR PDF 错误：' + data.error_msg);
    return data;
  }

  const first = await ocrPage(1);
  const totalPages = Math.min(first.pdf_file_size || 1, maxPages);
  const texts = [first.words_result.map(w => w.words).join('\n')];
  for (let i = 2; i <= totalPages; i++) {
    await new Promise(res => setTimeout(res, pageDelayMs));
    const data = await ocrPage(i);
    texts.push(data.words_result.map(w => w.words).join('\n'));
  }
  return texts.join('\n');
}
