# SAM Bridge

เชื่อมข้อมูลจาก iXacs ไปยังระบบที่องค์กรใช้งาน ผ่านจุดเชื่อมต่อเดียว

## วิธีใช้กับ ngrok

1. ติดตั้ง dependencies แล้วรันเซิร์ฟเวอร์

```bash
npm install
npm run dev
```

2. เปิด HTTPS ไปที่พอร์ต 4525

```bash
ngrok http 4525
```

3. ใน Web Application กรอก

- **Push Api Url:** `https://<ngrok-host>` (หรือ `https://<ngrok-host>/api/push`)
- **x-api-key:** ค่าใดก็ได้ (หรือค่าเดียวกับ `PUSH_API_KEY` ถ้าตั้งไว้)

4. เมื่อมี request เข้ามา จะเห็น `method`, `headers`, `x-api-key`, และ `body` ใน console ของ `npm run dev`

## เข้าหน้าเว็บ

ตั้งค่าใน `.env.local` แล้ว restart `npm run dev`:

```
AUTH_USER=admin
AUTH_PASSWORD=your-password
```

ต้องล็อกอินก่อนเข้าแดชบอร์ด ตั้งค่า และหน้ารายละเอียดไลน์  
Push จาก iXacs (`/` หรือ `/api/push`) ไม่ต้องล็อกอิน ยังใช้ `x-api-key` ตามเดิม

## API key (ไม่บังคับ)

สร้างไฟล์ `.env.local` ถ้าต้องการให้ปฏิเสธ key ที่ไม่ตรง:

``` 
PUSH_API_KEY=your-secret-key
```

ถ้าไม่ตั้งค่านี้ ทุก request จะถูกรับและ log ทั้งหมด

## ส่งสถานะกลับไป iXacs

เพิ่ม iXacs connection และเข้าสู่ระบบจากหน้า `/settings` ระบบจะเก็บ session ไว้กับ connection และเข้าสู่ระบบใหม่ให้อัตโนมัติเมื่อ session หมดอายุ จากนั้นส่ง `productionLineUuid` + `andonStatusStyleUuid` ไปที่ `/ct-monitor/api/ctMonitor/regist`

## Slack

1. รัน migration `supabase/migrations/016_slack_notifications.sql` ใน Supabase ก่อน deploy
2. สร้าง Slack App แล้วเปิด Incoming Webhooks จากนั้นเพิ่ม webhook ให้ channel ที่ต้องการ
3. เพิ่ม Bot Token Scopes `app_mentions:read` และ `chat:write` แล้วติดตั้งหรือติดตั้ง App ใหม่ใน Workspace
4. เชิญ Bot เข้า channel เดียวกับ Incoming Webhook และคัดลอก Channel ID
5. เปิด Event Subscriptions และตั้ง Request URL เป็น `https://<production-domain>/api/slack/events`
6. สมัคร Bot Event เฉพาะ `app_mention` ไม่ต้องสมัคร Direct Message event
7. ที่ `/settings/systems/slack` กรอก Production URL, Incoming Webhook, Channel ID, Bot User OAuth Token และ Signing Secret
8. สร้าง Notification Rule โดยเลือกเครื่อง/ไลน์และสถานะที่ต้องการแจ้งเตือน

การแจ้งเตือนสถานะทำงานจาก push event ของ iXacs และส่งทันทีโดยไม่ใช้ cron ส่วน Bot จะตอบเฉพาะข้อความที่ `@mention` ใน channel ที่ตั้งค่าไว้เท่านั้น
