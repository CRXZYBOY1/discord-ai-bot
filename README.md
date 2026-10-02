# Discord AI Bot 🤖

บอท Discord สำหรับถาม-ตอบด้วย AI ตอบทุกข้อความในช่องที่กำหนด พร้อมจำบทสนทนาก่อนหน้าแยกตามช่อง

เชื่อมต่อกับ AI ใดก็ได้ที่รองรับ **OpenAI-compatible API** เช่น OpenAI, OpenRouter, Groq, iApp AI, Ollama (โมเดลในเครื่อง) ฯลฯ

---

## สิ่งที่ต้องเตรียม

- Node.js เวอร์ชัน 18 ขึ้นไป (เช็คด้วยคำสั่ง `node --version`)
- บัญชี Discord และเซิร์ฟเวอร์ที่มีสิทธิ์เชิญบอท
- กุญแจ API ของผู้ให้บริการ AI ที่จะใช้

## ขั้นตอนติดตั้ง

### 1) สร้างบอทใน Discord Developer Portal

1. เข้าไปที่ https://discord.com/developers/applications แล้วกด **New Application** ตั้งชื่อบอท
2. เมนูด้านซ้ายเลือก **Bot**
3. กด **Reset Token** แล้วคัดลอกโทเคนเก็บไว้ (⚠️ ห้ามเปิดเผยโทเคนนี้ให้ใคร — ถ้าหลุดให้กด Reset ใหม่ทันที)
4. ⭐ **สำคัญมาก:** เลื่อนลงมาที่หัวข้อ **Privileged Gateway Intents** แล้ว **เปิดสวิตช์ MESSAGE CONTENT INTENT** — ถ้าไม่เปิดข้อนี้ บอทจะอ่านข้อความไม่ได้เลย
5. กด **Save Changes**

### 2) เชิญบอทเข้าเซิร์ฟเวอร์

1. เมนูด้านซ้ายเลือก **OAuth2** → **URL Generator**
2. ใน Scopes ติ๊กเลือก `bot`
3. ใน Bot Permissions ติ๊กเลือก:
   - `View Channels`
   - `Send Messages`
   - `Read Message History`
4. คัดลอก URL ที่โผล่ด้านล่าง แล้วเปิดในเบราว์เซอร์ เลือกเซิร์ฟเวอร์ของคุณ กด Authorize

### 3) หา Channel ID ของช่องที่ต้องการให้บอทตอบ

1. ในแอป Discord ไปที่ **ตั้งค่า (Settings) → Advanced → เปิด Developer Mode**
2. คลิกขวาที่ช่อง (channel) ที่ต้องการ → **Copy Channel ID**
3. ทำซ้ำได้กับหลายช่อง (คั่นด้วย `,` ในไฟล์ `.env`)

### 4) ตั้งค่าไฟล์ .env

เปิดไฟล์ `.env` ในโฟลเดอร์นี้ แล้วกรอกค่า:

```env
DISCORD_TOKEN=โทเคนบอทจากขั้นตอนที่ 1
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=กุญแจ API ของคุณ
AI_MODEL=gpt-4o-mini
ALLOWED_CHANNEL_IDS=1234567890123456789
```

ตัวอย่าง `AI_BASE_URL` ของผู้ให้บริการยอดนิยม:

| ผู้ให้บริการ | AI_BASE_URL | ตัวอย่าง AI_MODEL |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `google/gemini-2.0-flash-001` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Ollama (ในเครื่อง) | `http://localhost:11434/v1` | `llama3.1` |

ปรับบทบาทของ AI ได้ที่ `SYSTEM_PROMPT` และปรับจำนวนข้อความที่จำได้ที่ `HISTORY_LIMIT`

### 5) ติดตั้งและรันบอท

เปิด Command Prompt แล้วรัน:

```
npm install
npm start
```

ถ้าสำเร็จจะขึ้นว่า `✅ บอทออนไลน์แล้วในชื่อ ...` — จากนั้นลองพิมพ์ข้อความในช่องที่กำหนดไว้ บอทจะตอบกลับมาเอง

> 💡 ระหว่างพัฒนาอยากให้บอทรีสตาร์ทเองเมื่อแก้โค้ด ใช้คำสั่ง `npm run dev` แทนได้

---

## วิธีใช้งาน

- พิมพ์ข้อความอะไรก็ได้ในช่องที่กำหนดไว้ → บอทจะตอบด้วย AI
- บอทจำบทสนทนาล่าสุดของแต่ละช่อง (จำนวนตาม `HISTORY_LIMIT`) ดังนั้นถามต่อเนื่องได้ เช่น "อธิบายเพิ่ม" หรือ "ยกตัวอย่างหน่อย"
- ประวัติบทสนทนาเก็บในหน่วยความจำ จะรีเซ็ตเมื่อรีสตาร์ทบอท

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| บอทไม่ตอบในช่องเลย | 1) ลืมเปิด **MESSAGE CONTENT INTENT** ใน Developer Portal (ขั้นตอน 1.4) 2) `ALLOWED_CHANNEL_IDS` ผิด/ลืมใส่ 3) บอทไม่มีสิทธิ์ View Channels ในช่องนั้น |
| `ล็อกอิน Discord ไม่สำเร็จ` | `DISCORD_TOKEN` ผิดหรือถูก Reset ไปแล้ว — คัดลอกใหม่จาก Developer Portal |
| `AI API ตอบกลับด้วยสถานะ 401` | `AI_API_KEY` ผิด หรือ `AI_BASE_URL` ไม่ตรงกับผู้ให้บริการ |
| `AI API ตอบกลับด้วยสถานะ 404` | `AI_BASE_URL` ไม่ถูกต้อง (ส่วนใหญ่ต้องลงท้ายด้วย `/v1`) หรือ `AI_MODEL` ไม่มีอยู่จริงในผู้ให้บริการนั้น |
| `AI API ตอบกลับด้วยสถานะ 429` | ใช้เกินโควตา/เรทลิมิตของผู้ให้บริการ AI — รอสักครู่หรือเติมเครดิต |
| บอทออนไลน์แต่ตอบแล้ว error | ดูรายละเอียด error ในหน้าต่างคอนโซลที่รัน `npm start` อยู่ |

## โครงสร้างโค้ด

```
src/
├── index.js          # จุดเริ่มรัน: เชื่อมต่อ Discord และผูก event ต่าง ๆ
├── config.js         # โหลดและตรวจค่าจากไฟล์ .env
├── ai.js             # เรียก AI API (/chat/completions)
├── memory.js         # เก็บประวัติบทสนทนาแยกตามช่อง
└── messageHandler.js # ตรวจช่อง → ถาม AI → ตอบกลับใน Discord
```
