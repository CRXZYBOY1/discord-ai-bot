// ข้อมูลสดอัตโนมัติ: ตรวจว่าคำถามต้องการข้อมูลปัจจุบันไหม แล้วหาให้เอง
// วิธีค้น: ถ้าตั้ง SEARCH_MODEL ใน .env จะสลับไปใช้ search model นั้น
// ถ้าไม่ตั้ง จะค้นเว็บเองผ่าน DuckDuckGo lite (ฟรี ไม่ต้องมี key)
// แล้วฉีดผลค้นหาให้ model ปกติตอบพร้อมอ้างอิง
import config from './config.js';
import { log } from './logger.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_RESULTS = 5;

// คำที่บ่งบอกว่าคำถามต้องใช้ข้อมูลปัจจุบัน (ไทย+อังกฤษ)
const LIVE_KEYWORDS =
  /วันนี้|พรุ่งนี้|เมื่อวาน|ตอนนี้|ล่าสุด|กี่โมง|ข่าว|พยากรณ์|อากาศ|ฝนตก|อุณหภูมิ|ราคา|ค่าเงิน|อัตราแลกเปลี่ยน|ทองคำ|น้ำมัน|หุ้น|คริปโต|บิตคอยน์|ผลฟุตบอล|ผลการแข่งขัน|ออกอากาศ|ปีนี้|เดือนนี้|สัปดาห์นี้|today|tonight|tomorrow|yesterday|right now|latest|breaking|news|weather|forecast|temperature|price of|stock|exchange rate|bitcoin|live score|current(ly)?|202[5-9]/i;

export function needsLiveInfo(text) {
  return LIVE_KEYWORDS.test(text);
}

function stripHtml(s) {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ลิงก์จริงถูกฝังในพารามิเตอร์ uddg ของ redirect ของ DDG
function decodeDdgUrl(href) {
  const m = /[?&]uddg=([^&]+)/.exec(href);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  return href.startsWith('http') ? href : null;
}

// ค้นเว็บผ่าน DuckDuckGo lite — คืน [{ title, snippet, url }]
export async function searchWeb(query, maxResults = MAX_RESULTS) {
  const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'th,en' },
  });
  if (!res.ok) throw new Error(`DuckDuckGo ตอบด้วยสถานะ ${res.status}`);

  const html = await res.text();

  // โครงสร้างหน้า lite: href มาก่อน class และ snippet อยู่แถวถัดไปของแต่ละผลลัพธ์
  const linkRe = /<a[^>]*href="([^"]+)"[^>]*class='result-link'[^>]*>([\s\S]*?)<\/a>/g;
  const snippetRe = /<td[^>]*class='result-snippet'[^>]*>([\s\S]*?)<\/td>/g;

  const snippets = [];
  let s;
  while ((s = snippetRe.exec(html)) && snippets.length < maxResults * 2) {
    snippets.push(stripHtml(s[1]));
  }

  const results = [];
  let m;
  while ((m = linkRe.exec(html)) && results.length < maxResults) {
    const url = decodeDdgUrl(m[1]);
    if (!url) continue;
    results.push({ title: stripHtml(m[2]), url, snippet: snippets[results.length] ?? '' });
  }

  return results;
}

export function buildSearchContext(query, results) {
  const today = new Date().toLocaleDateString('th-TH', { dateStyle: 'full' });
  const lines = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet || '(ไม่มีคำอธิบาย)'}\nแหล่งที่มา: ${r.url}`)
    .join('\n\n');

  return (
    `[ข้อมูลจากการค้นเว็บ เมื่อ ${today} สำหรับคำถาม: "${query.slice(0, 120)}"]\n${lines}\n` +
    `[จบผลค้นหา — ตอบจากข้อมูลข้างต้นและอ้างอิงหมายเลข [1] [2] ตามควรสม หากข้อมูลไม่เพียงพอให้บอกตามความจริง]`
  );
}

// จุดรวมที่ messageHandler และ /ask เรียก — ตรวจ + หาข้อมูลสดให้เสร็จในฟังก์ชันเดียว
// คืน null ถ้าไม่ต้องใช้ข้อมูลสด, { model } ถ้าใช้ search model, { contextBlock } ถ้าค้นเอง
export async function prepareLiveInfo(text) {
  if (!needsLiveInfo(text)) return null;

  // มี SEARCH_MODEL ตั้งไว้ → ให้ model ค้นเว็บเองทั้งคำถาม
  if (config.searchModel) {
    return { model: config.searchModel, contextBlock: null };
  }

  // ไม่มี → ค้นเว็บเองแล้วฉีดผลลัพธ์เป็นบริบท
  try {
    const results = await searchWeb(text);
    if (results.length === 0) return null;
    log.info(`  🔎  คำถามต้องการข้อมูลสด — ค้นเว็บได้ ${results.length} ผลลัพธ์`);
    return { model: null, contextBlock: buildSearchContext(text, results) };
  } catch (err) {
    log.warn(`  ⚠️  ค้นเว็บไม่สำเร็จ (${err.message}) — ตอบด้วยความรู้เดิมต่อไป`);
    return null;
  }
}
