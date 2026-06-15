import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const iconv = require('iconv-lite');

export function decodeMaybeMojibake(value) {
  if (!value || typeof value !== 'string') return value || '';
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    if (scoreReadableText(repaired) > scoreReadableText(value)) return repaired;
  } catch {
    // Keep original value if it cannot be repaired.
  }
  return value;
}

export function decodeTextBuffer(buffer) {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const gb18030 = iconv.decode(buffer, 'gb18030').replace(/^\uFEFF/, '');
  return scoreReadableText(gb18030) > scoreReadableText(utf8) ? gb18030 : utf8;
}

function scoreReadableText(text) {
  const replacement = (text.match(/\uFFFD/g) || []).length;
  const mojibake = (text.match(/[ÃÂæçèéäåð]/g) || []).length;
  const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const knownHeaders = (text.match(/题目|题干|答案|考察点|知识点|难度|题型|解析/g) || []).length;
  return chinese * 3 + knownHeaders * 20 - replacement * 20 - mojibake * 2;
}
