// ตัวช่วยพิมพ์ log ให้สวยอ่านง่าย: มีสี ANSI และใช้ได้ทุกเทอร์มินัล
// ถ้า output ไม่ใช่เทอร์มินัล (เช่น redirect ลงไฟล์) หรือตั้ง NO_COLOR สีจะถูกปิดอัตโนมัติ
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

export function paint(code, text) {
  return useColor ? `\x1b[${code}m${String(text)}\x1b[0m` : String(text);
}

const RULE_CHAR = '─';
const RULE_WIDTH = 54;

export const log = {
  paint,
  info: (msg) => console.log(msg),
  success: (msg) => console.log(paint('32', msg)),
  warn: (msg) => console.log(paint('33', msg)),
  error: (msg) => console.error(paint('31', msg)),
  dim: (msg) => console.log(paint('90', msg)),
  rule: (char = RULE_CHAR) => console.log(paint('90', char.repeat(RULE_WIDTH))),
  // บรรทัดรายละเอียดแบบ "emoji  label: value"
  item: (emoji, label, value) => console.log(`  ${emoji}  ${paint('90', `${label}:`)} ${value}`),
};
