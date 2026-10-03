// ไฟล์ config ของ pm2 — ใช้ทั้งบน Windows และ VPS (Ubuntu)
// เริ่มบอท:      pm2 start ecosystem.config.cjs
// บันทึกรายการ:  pm2 save
// ให้รันตอนบูต:  pm2 startup (Linux) หรือ pm2-startup install (Windows)
module.exports = {
  apps: [
    {
      name: 'ai-bot',
      script: 'src/index.js',
      time: true, // แนบเวลาใน log
      autorestart: true, // พังแล้วรีเอง
      max_restarts: 30,
      restart_delay: 5000, // หน่วง 5 วิก่อนรีเอง กันสแปมรีสตาร์ท
      max_memory_restart: '400M', // กินแรมเกินก็รีใหม่
    },
  ],
};
