export function normalizeMathText(value) {
  let text = String(value || '').trim();
  if (!text) return '';

  text = normalizePrivateMathSymbols(text);

  text = protectFractionalPartMarkers(text);

  text = text
    .replace(/\\n/g, '\n')
    .replace(/\$(.*?)\$/gs, '$1')
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    .replace(/\\(?:left|right)/g, '');

  text = normalizeRecurringDecimals(text);
  text = normalizeMixedFractions(text);
  text = normalizeFractions(text);

  text = text
    .replace(/\\underline\s*\{\s*\\hspace\s*\{[^{}]*\}\s*\}/g, '______')
    .replace(/\\underbrace\s*\{([^{}]+)\}\s*_\s*\{([^{}]+)\}/g, (_, body, label) => `⏟[${body}|${label}]`)
    .replace(/\\(?:underline|overline|widehat|hat|bar)\s*\{([^{}]+)\}/g, '$1')
    .replace(/\\hspace\s*\{[^{}]*\}/g, ' ')
    .replace(/\\cdots|\\ldots|\\dots/g, '…')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\leq?|\\le/g, '≤')
    .replace(/\\geq?|\\ge/g, '≥')
    .replace(/\\neq|\\ne/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\angle/g, '∠')
    .replace(/\\Delta/g, '△')
    .replace(/\\Theta/g, 'Θ')
    .replace(/\\triangle/g, '△')
    .replace(/\\oplus/g, '⊕')
    .replace(/\\odot/g, '⊙')
    .replace(/\\star/g, '★')
    .replace(/\\vee/g, '∨')
    .replace(/\\wedge/g, '∧')
    .replace(/\\uparrow/g, '↑')
    .replace(/\\downarrow/g, '↓')
    .replace(/\\lceil/g, '⌈')
    .replace(/\\rceil/g, '⌉')
    .replace(/\\parallel/g, '∥')
    .replace(/\\perp/g, '⊥')
    .replace(/\\pi/g, 'π')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√$1')
    .replace(/\^\s*\{?\\circ\}?|\\degree/g, '°')
    .replace(/\\circ/g, '°')
    .replace(/\\%/g, '%')
    .replace(/\\[,;]/g, ' ')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s*([+×÷=])\s*/g, ' $1 ')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+([,，。；;：:？?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  return text;
}

function protectFractionalPartMarkers(value) {
  return String(value || '').replace(/(^|[^\\])\\(?![()[\]])([^\\\n]+?)\\/g, (_, prefix, body) => {
    return `${prefix}⦃${body.trim()}⦄`;
  });
}

function normalizePrivateMathSymbols(value) {
  const symbolMap = new Map([
    ['\uf02b', '+'],
    ['\uf02d', '-'],
    ['\uf03d', '='],
    ['\uf03c', '<'],
    ['\uf03e', '>'],
    ['\uf0a3', '≤'],
    ['\uf0b0', '°'],
    ['\uf0b3', '≥'],
    ['\uf0b4', '×'],
    ['\uf0b8', '÷'],
    ['\uf0bc', '…'],
    ['\uf0d0', '∠'],
    ['\uf0d1', '∇'],
    ['\uf044', '△'],
    ['\uf056', '▽'],
    ['\uf070', 'π'],
    ['\uf051', 'Θ'],
    ['\uf057', 'Ω'],
    ['\uf04c', '…'],
    ['\uf085', '≥'],
    ['\uf0ae', '→'],
    ['\uf02a', '∗'],
    ['\uf0a2', '′'],
    ['\uf06f', '°'],
    ['\uf028', '('],
    ['\uf029', ')'],
    ['\uf067', '·'],
    ['\uf0b6', '弧'],
  ]);
  const recurringDotMarks = new Set(['\uf026', '\uf0d7']);
  const decorativeSymbols = new Set([
    '\uf031', '\uf032', '\uf033', '\uf034',
    '\uf0e6', '\uf0e7', '\uf0e8', '\uf0e9', '\uf0ea', '\uf0eb', '\uf0ec', '\uf0ed', '\uf0ee', '\uf0ef',
    '\uf0f6', '\uf0f7', '\uf0f8', '\uf0f9', '\uf0fa', '\uf0fb',
    '\uf07b', '\uf0c4',
  ]);
  let text = '';
  for (const ch of String(value || '')) {
    if (recurringDotMarks.has(ch) && text.length) {
      text += '\u0307';
    } else if (decorativeSymbols.has(ch)) {
      text += ' ';
    } else {
      text += symbolMap.get(ch) || ch;
    }
  }
  return text;
}

function normalizeRecurringDecimals(value) {
  return String(value || '')
    .replace(/\\dot\s*\{([^{}])\}/g, (_, digit) => `${digit}\u0307`)
    .replace(/\\(?:overline|bar)\s*\{([0-9]+)\}/g, (_, digits) => markRepeatingDigits(digits))
    .replace(/\\(?:overline|bar)\s*\{([^{}]+)\}/g, '$1');
}

function markRepeatingDigits(digits) {
  if (digits.length <= 1) return `${digits}\u0307`;
  return `${digits[0]}\u0307${digits.slice(1, -1)}${digits.at(-1)}\u0307`;
}

function normalizeMixedFractions(value) {
  const mixed = /(\d+(?:\.\d+)?)\s*\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  let text = value;
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(mixed, (_, whole, numerator, denominator) => {
      return `${whole}又${formatFractionPart(numerator)}/${formatFractionPart(denominator)}`;
    });
  }
  return text;
}

function normalizeFractions(value) {
  const fraction = /\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  let text = value;
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(fraction, (_, numerator, denominator) => {
      return formatPlainFraction(numerator, denominator);
    });
  }
  return text;
}

function formatPlainFraction(numerator, denominator) {
  const n = formatFractionPart(numerator);
  const d = formatFractionPart(denominator);
  const isLong = n.length > 12 || d.length > 12 || /[+\-×÷=]/.test(n) || /[+\-×÷=]/.test(d);
  return isLong ? `（${n}）/（${d}）` : `${n}/${d}`;
}

function formatFractionPart(value) {
  return String(value || '')
    .trim()
    .replace(/\s*([+×÷=])\s*/g, ' $1 ')
    .replace(/\s*-\s*/g, '-')
    .replace(/[ \t]{2,}/g, ' ');
}
