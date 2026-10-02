// ดึงรายชื่อ model ทั้งหมดจาก AI server แล้วเขียนลงไฟล์ MODELS.md จัดกลุ่มตามผู้ให้บริการ
// รันด้วยคำสั่ง: npm run models
import fs from 'node:fs';
import config from '../src/config.js';

const res = await fetch(`${config.aiBaseUrl}/models`, {
  headers: { Authorization: `Bearer ${config.aiApiKey}` },
});

if (!res.ok) {
  console.error(`❌ ดึงรายชื่อ model ไม่สำเร็จ (สถานะ ${res.status})`);
  process.exit(1);
}

const { data } = await res.json();
const ids = data.map((m) => m.id).sort((a, b) => a.localeCompare(b));

// จัดกลุ่มจากคำนำหน้าก่อน "/" แรก เช่น ag/, kr/, ollama/
const groups = new Map();
for (const id of ids) {
  const prefix = id.includes('/') ? id.split('/')[0] : '(ไม่มีคำนำหน้า)';
  if (!groups.has(prefix)) groups.set(prefix, []);
  groups.get(prefix).push(id);
}

let md = `# รายชื่อ Model ทั้งหมดของ AI Server (${ids.length} ตัว)\n\n`;
md += `> ดึงอัตโนมัติจาก \`${config.aiBaseUrl}/models\` เมื่อ ${new Date().toLocaleString('th-TH')}\n`;
md += `> วิธีเปลี่ยน model: แก้ \`AI_MODEL\` ในไฟล์ \`.env\` แล้วรีสตาร์ทบอท (Ctrl+C → \`npm start\`)\n`;
md += `> รายชื่อนี้เปลี่ยนได้เมื่อ server อัพเดต — รัน \`npm run models\` เพื่อดึงใหม่\n`;

for (const [prefix, list] of groups) {
  md += `\n## ${prefix} (${list.length} ตัว)\n\n`;
  for (const id of list) md += `- \`${id}\`\n`;
}

fs.writeFileSync('MODELS.md', md, 'utf8');
console.log(`✅ เขียนรายชื่อ ${ids.length} model (${groups.size} กลุ่ม) ลงไฟล์ MODELS.md แล้ว`);
