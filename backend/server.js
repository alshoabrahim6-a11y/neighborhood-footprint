// ============================================================================
// server.js — نقطة انطلاق السيرفر
// ----------------------------------------------------------------------------
// هاد الملف بيسوي: يجهز express، يفعّل CORS (عشان الواجهة الأمامية تقدر
// تناديه من بورت مختلف)، يربط الـ routes، وبيشغّل وظيفة تعافي النقاط
// اليومية بشكل تلقائي طول ما السيرفر شغال.
// ============================================================================

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';

import reportsRouter from './routes/reports.js';
import neighborhoodsRouter from './routes/neighborhoods.js';
import adminRouter from './routes/admin.js';
import { recoverPointsForAllNeighborhoods } from './services/ecoPoints.js';
import { saveWeeklySnapshot } from './services/reportSummary.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors()); // يسمح للفرونت إند (مثلا localhost:5173) يتواصل مع هاد السيرفر
app.use(express.json());

// فحص سريع: افتح http://localhost:4000/ بالمتصفح للتأكد إن السيرفر شغال
app.get('/', (req, res) => {
  res.json({ status: 'ok', project: 'بصمة الحي - Neighborhood Footprint API' });
});

app.use('/api/reports', reportsRouter);
app.use('/api/neighborhoods', neighborhoodsRouter);
app.use('/api/admin', adminRouter);

// جدولة يومية: كل يوم الساعة 3 فجرًا (بتوقيت السيرفر) نشغّل تعافي النقاط
// (node-cron format: minute hour day month weekday)
cron.schedule('0 3 * * *', () => {
  console.log('⏰ بدء وظيفة تعافي نقاط الأحياء اليومية...');
  recoverPointsForAllNeighborhoods();
});

// جدولة أسبوعية: كل يوم أحد الساعة 6 صباحًا (بتوقيت السيرفر) نولّد ونحفظ
// "التقرير الدوري" التلقائي (راجع services/reportSummary.js). لازم السيرفر
// يكون شغال وقتها عشان الوظيفة تشتغل — الأدمن كمان يقدر يولّد تقرير فوري
// يدويًا من لوحة الإدارة بدون ما ينتظر هاد الموعد.
cron.schedule('0 6 * * 0', () => {
  console.log('⏰ بدء وظيفة التقرير الأسبوعي التلقائي...');
  saveWeeklySnapshot().catch((err) => console.error('❌ فشل التقرير الأسبوعي التلقائي:', err.message));
});

app.listen(PORT, () => {
  console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`);
});
