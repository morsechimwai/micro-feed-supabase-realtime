# Task Manager with Realtime CRUD (React + Supabase)

เว็บแอปจัดการงานที่สร้างด้วย React, TypeScript และ Supabase เพื่อให้ผู้ใช้สร้าง แก้ไข และลบงานได้แบบเรียลไทม์ พร้อมระบบยืนยันตัวตนและการปรับธีม

## Feature
- จัดการงานครบวงจร: เพิ่ม แก้ไข (ผ่าน dialog) และลบงาน พร้อมตรวจสอบข้อมูลด้วย Zod
- ซิงก์เรียลไทม์: รับการเปลี่ยนแปลงจาก Supabase ผ่านช่องทาง `postgres_changes`
- ระบบยืนยันตัวตน Supabase Auth สำหรับลงชื่อเข้าใช้/ออก
- แสดงเวลางานด้วย Day.js ทั้งแบบ relative เวลาใกล้ปัจจุบันและรูปแบบวันที่
- ปรับธีม Light/Dark และบันทึกค่าไว้ใน Local Storage

[Live Demo](https://react-supabase-realtime-tasks.vercel.app/)

## Quick Start
1. ติดตั้ง Node.js เวอร์ชัน 18 ขึ้นไป
2. โคลนโปรเจกต์และติดตั้งแพ็กเกจ
   ```bash
   git clone <repository-url>
   cd react-supabase-lab
   npm install
   ```
3. สร้างไฟล์ `.env.local` หรือกำหนดตัวแปรแวดล้อมตามหัวข้อ Environment Variables
4. เริ่มพัฒนา
   ```bash
   npm run dev
   ```
5. เปิดเบราว์เซอร์ที่ `http://localhost:5173`

## Environment Variables
ตั้งค่าตัวแปรต่อไปนี้ใน `.env.local`
- `VITE_SUPABASE_URL` : URL ของ Supabase Project
- `VITE_SUPABASE_KEY` : API Key (แนะนำให้ใช้ anon key สำหรับฝั่ง client)

## NodeJS Libraries
- `react`, `react-dom` : สร้าง UI หลักของแอป
- `vite`, `@vitejs/plugin-react` : Dev server และกระบวนการ build ความเร็วสูง
- `@supabase/supabase-js` : ติดต่อฐานข้อมูลและระบบ auth ของ Supabase
- `react-hook-form`, `@hookform/resolvers`, `zod` : จัดการฟอร์มและ validate ข้อมูล
- `dayjs` และปลั๊กอิน `relativeTime` : จัดรูปแบบเวลาและข้อความแบบ human-readable
- `lucide-react`, `tailwindcss` : ชุดไอคอนและระบบสไตล์
