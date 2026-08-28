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
