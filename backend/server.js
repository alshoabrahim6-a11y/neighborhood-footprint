// ============================================================================
// server.js — the server's entry point
// ----------------------------------------------------------------------------
// This file: sets up express, enables CORS (so the frontend can call it from
// a different port), wires up the routes, and runs the daily points-recovery
// job automatically for as long as the server is running.
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

app.use(cors()); // lets the frontend (e.g. localhost:5173) talk to this server
app.use(express.json());

// Quick check: open http://localhost:4000/ in a browser to confirm the server is running
app.get('/', (req, res) => {
  res.json({ status: 'ok', project: 'Neighborhood Footprint API' });
});

app.use('/api/reports', reportsRouter);
app.use('/api/neighborhoods', neighborhoodsRouter);
app.use('/api/admin', adminRouter);

// Daily schedule: every day at 3 AM (server time) we run the points recovery job
// (node-cron format: minute hour day month weekday)
cron.schedule('0 3 * * *', () => {
  console.log('⏰ Starting the daily neighborhood points recovery job...');
  recoverPointsForAllNeighborhoods();
});

// Weekly schedule: every Sunday at 6 AM (server time) we generate and save
// the automatic "periodic report" (see services/reportSummary.js). The
// server needs to be running at that time for the job to run — the admin
// can also generate a report on demand manually from the admin panel
// without waiting for this schedule.
cron.schedule('0 6 * * 0', () => {
  console.log('⏰ Starting the automatic weekly report job...');
  saveWeeklySnapshot().catch((err) => console.error('❌ Automatic weekly report failed:', err.message));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
