// อ่านเอกสารที่แนบมากับข้อความ: PDF (สกัดข้อความด้วย unpdf) และไฟล์ข้อความล้วน
// เนื้อหาที่ได้จะถูกแนบไปกับคำถามให้ AI อ่าน — ใช้ได้กับ model ข้อความทุกตัว
import { extractText, getDocumentProxy } from 'unpdf';
import { log } from './logger.js';

const MAX_DOCUMENTS = 2;
const MAX_DOC_BYTES = 8 * 1024 * 1024; // 8MB ต่อไฟล์
const MAX_DOC_CHARS = 20000; // จำกัดข้อความต่อไฟล์ (~5-7k tokens)
const TEXT_EXTENSIONS = /\.(txt|md|csv|json|log|xml|html?|ya?ml)$/i;

function isPdf(attachment) {
  return attachment.contentType === 'application/pdf' || /\.pdf$/i.test(attachment.name ?? '');
}

function isTextFile(attachment) {
  return (
    attachment.contentType?.startsWith('text/') ||
    TEXT_EXTENSIONS.test(attachment.name ?? '')
  );
}

function capText(text, name) {
  const clean = text.replace(/\u0000/g, '').trim();
  if (clean.length <= MAX_DOC_CHARS) return clean;
  log.warn(`  ⚠️  เอกสาร ${name} ยาวเกิน ตัดเหลือ ${MAX_DOC_CHARS} ตัวอักษรแรก`);
  return `${clean.slice(0, MAX_DOC_CHARS)}\n… (เนื้อหายาวเกิน ถูกตัดเฉพาะส่วนต้น)`;
}

async function extractPdf(buffer, name) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const content = capText(Array.isArray(text) ? text.join('\n') : text, name);
  if (!content) {
    throw new Error('ไม่พบข้อความใน PDF (อาจเป็นไฟล์สแกน/รูปภาพล้วน)');
  }
  return content;
}

// คืนรายการเอกสาร [{ name, content }] จากไฟล์ที่แนบมา
export async function collectDocuments(message) {
  const docs = [...message.attachments.values()]
    .filter((a) => isPdf(a) || isTextFile(a))
    .slice(0, MAX_DOCUMENTS);

  const results = [];

  for (const attachment of docs) {
    if (attachment.size > MAX_DOC_BYTES) {
      log.warn(`  ⚠️  ข้ามไฟล์ ${attachment.name} (ใหญ่กว่า 8MB)`);
      continue;
    }
    try {
      const res = await fetch(attachment.url, { signal: AbortSignal.timeout(60 * 1000) });
      if (!res.ok) throw new Error(`สถานะ ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const content = isPdf(attachment)
        ? await extractPdf(buffer, attachment.name)
        : capText(buffer.toString('utf8'), attachment.name);

      if (content) results.push({ name: attachment.name, content });
    } catch (err) {
      log.warn(`  ⚠️  อ่านไฟล์ ${attachment.name} ไม่สำเร็จ: ${err.message}`);
    }
  }

  return results;
}
