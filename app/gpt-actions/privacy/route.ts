export async function GET() {
  return new Response(`<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>iXacs GPT Actions — Privacy Policy</title>
<style>body{max-width:760px;margin:64px auto;padding:0 24px;font:16px/1.7 system-ui,sans-serif;color:#202020}h1{line-height:1.2}h2{margin-top:32px}small{color:#666}</style></head>
<body><h1>นโยบายความเป็นส่วนตัว — iXacs GPT Actions</h1>
<small>ปรับปรุงล่าสุด: 21 สิงหาคม 2026</small>
<p>บริการนี้เปิดให้ GPT ที่ได้รับอนุญาตอ่านข้อมูลการผลิตและ Lost Time จากระบบ iXacs ขององค์กร เพื่อวิเคราะห์และตอบคำถามของผู้ใช้</p>
<h2>ข้อมูลที่ประมวลผล</h2><p>ระบบอาจประมวลผลชื่อบริษัท สายการผลิต สถานะการทำงาน Cycle Time จำนวนการผลิต และช่วงเวลาที่สูญเสีย โดยไม่ต้องการข้อมูลส่วนบุคคลเพื่อให้บริการ</p>
<h2>การใช้และการเปิดเผยข้อมูล</h2><p>ข้อมูลถูกส่งให้ ChatGPT เฉพาะเมื่อผู้ใช้เรียกใช้ Action และได้รับการปกป้องด้วย API key ผู้ดูแลระบบเป็นผู้กำหนดบริษัทที่ GPT เข้าถึงได้</p>
<h2>การเก็บรักษาและความปลอดภัย</h2><p>ตัวเชื่อมต่อนี้ไม่สร้างสำเนาถาวรของผลการวิเคราะห์ API key ถูกจัดเก็บในรูปแบบแฮชและสามารถหมุนเปลี่ยนได้จากหน้าตั้งค่า</p>
<h2>ติดต่อ</h2><p>โปรดติดต่อผู้ดูแลระบบ SAM Bridge ขององค์กรสำหรับคำขอเกี่ยวกับข้อมูลหรือการเพิกถอนสิทธิ์</p>
</body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
}
