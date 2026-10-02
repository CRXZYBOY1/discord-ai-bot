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
2. ใน Scopes ติ๊กเลือก `bot` **และ** `applications.commands` (ตัวหลังจำเป็นสำหรับคำสั่ง /model)
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

### เปลี่ยน model ด้วยคำสั่ง /model (ไม่ต้องแก้ไฟล์)

ใช้ได้เฉพาะผู้ที่มีสิทธิ์ **จัดการเซิร์ฟเวอร์ (Manage Server)**:

| คำสั่ง | ทำอะไร |
|---|---|
| `/model set model:...` | เปลี่ยน model — พิมพ์ในช่อง model แล้วรายชื่อจาก server จะค้นหาให้เลือกทันที (รองรับหลายพัน model) |
| `/model show` | ดู model ที่ใช้อยู่ตอนนี้ |
| `/model reset` | กลับไปใช้ model ค่าเริ่มต้นจากไฟล์ `.env` |

- เปลี่ยนแล้วใช้ได้ทันที **ไม่ต้องรีสตาร์ทบอท** และค่าที่ตั้งจะถูกจำไว้ในไฟล์ `data/settings.json` แม้รีสตาร์ท
- การตั้งค่ามีผลทั้งเซิร์ฟเวอร์ (ทุกช่องที่บอทตอบ ใช้ model เดียวกัน)
- ดูรายชื่อ model ทั้งหมดในไฟล์ `MODELS.md` (สร้างด้วยคำสั่ง `npm run models`)
- รายชื่อในการค้นหามาจาก**แคชในเครื่อง** (`data/models-cache.json`) — บอทตอบไวภายในไม่กี่มิลลิวินาทีและใช้ได้แม้ AI server ล่ม โดยจะรีเฟรชรายชื่อล่าสุดจาก server เบื้องหลังทุก 10 นาทีเมื่อ server ตอบได้
- หมายเหตุ: model แบบ `-thinking` หรือ `-agentic` จะคิดลึกกว่าแต่ตอบช้ากว่า อาจใช้เวลานานจนสถานะ "กำลังพิมพ์" หายไปก่อน ถือเป็นเรื่องปกติ

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| บอทไม่ตอบในช่องเลย | 1) ลืมเปิด **MESSAGE CONTENT INTENT** ใน Developer Portal (ขั้นตอน 1.4) 2) `ALLOWED_CHANNEL_IDS` ผิด/ลืมใส่ 3) บอทไม่มีสิทธิ์ View Channels ในช่องนั้น |
| `ล็อกอิน Discord ไม่สำเร็จ` | `DISCORD_TOKEN` ผิดหรือถูก Reset ไปแล้ว — คัดลอกใหม่จาก Developer Portal |
| `AI API ตอบกลับด้วยสถานะ 401` | `AI_API_KEY` ผิด หรือ `AI_BASE_URL` ไม่ตรงกับผู้ให้บริการ |
| `AI API ตอบกลับด้วยสถานะ 404` | `AI_BASE_URL` ไม่ถูกต้อง (ส่วนใหญ่ต้องลงท้ายด้วย `/v1`) หรือ `AI_MODEL` ไม่มีอยู่จริงในผู้ให้บริการนั้น |
| `AI API ตอบกลับด้วยสถานะ 429` | ใช้เกินโควตา/เรทลิมิตของผู้ให้บริการ AI — รอสักครู่หรือเติมเครดิต |
| บอทออนไลน์แต่ตอบแล้ว error | ดูรายละเอียด error ในหน้าต่างคอนโซลที่รัน `npm start` อยู่ |
| พิมพ์ `/model` แล้วไม่เห็นคำสั่ง | บอทถูกเชิญโดยไม่มี scope `applications.commands` — เชิญใหม่ตามขั้นตอนที่ 2 โดยติ๊ก scope ทั้ง `bot` และ `applications.commands` (ไม่ต้องเอาบอทออก เชิญซ้ำทับได้เลย) หรือดู error ในคอนโซลตอนรีสตาร์ทบอท |
| รัน `npm` ใน PowerShell ขึ้น `running scripts is disabled on this system` | ดูวิธีแก้ในหัวข้อถัดไปด้านล่าง |

### รัน `npm` ใน PowerShell ไม่ได้ — "running scripts is disabled on this system"

อาการนี้เกิดจาก Windows ตั้งค่าไม่ให้ PowerShell รันสคริปต์ `.ps1` (ซึ่งคำสั่ง `npm` ใช้อยู่) — ไม่เกี่ยวกับโปรเจกต์นี้โดยตรง วิธีแก้มี 2 แบบ:

**แบบที่ 1: แก้ถาวร (แนะนำ)** — พิมพ์คำสั่งนี้ใน PowerShell แล้วกด Enter จะมีถามยืนยัน พิมพ์ `Y` แล้วกด Enter อีกครั้ง:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

เป็นการอนุญาตให้รันสคริปต์ในเครื่องตัวเองได้ (ระดับผู้ใช้ปัจจุบัน ไม่ต้องเป็น admin) เป็นค่ามาตรฐานที่นักพัฒนาใช้กัน

**แบบที่ 2: แก้เฉพาะครั้ง (ไม่ต้องเปลี่ยนการตั้งค่า)** — เติม `.cmd` ต่อท้ายคำสั่ง `npm` ทุกครั้ง:

```powershell
npm.cmd install
npm.cmd start
```

## โครงสร้างโค้ด

```
src/
├── index.js          # จุดเริ่มรัน: เชื่อมต่อ Discord และผูก event ต่าง ๆ
├── config.js         # โหลดและตรวจค่าจากไฟล์ .env
├── ai.js             # เรียก AI API (/chat/completions)
├── memory.js         # เก็บประวัติบทสนทนาแยกตามช่อง
├── settings.js       # เก็บ model ที่ตั้งผ่าน /model แยกตามเซิร์ฟเวอร์ (ลงไฟล์ data/)
├── models.js         # ดึงรายชื่อ model จาก AI server (แคช 5 นาที)
├── commands.js       # ลงทะเบียนคำสั่ง และรับ interaction จาก Discord
├── commands/
│   └── model.js      # คำสั่ง /model (set/show/reset + ค้นหา model)
└── messageHandler.js # ตรวจช่อง → ถาม AI → ตอบกลับใน Discord

scripts/
└── list-models.mjs   # ดึงรายชื่อ model ทั้งหมดลงไฟล์ MODELS.md (npm run models)
```
