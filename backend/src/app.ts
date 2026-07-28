import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './routes/auth';
import { PingSchema } from '@apartment/shared';

dotenv.config();

const app = express();

// ── Global Middleware ──────────────────────────────────────────────────────
// Echo back the request origin for CORS (production-safe behind Railway's network)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/api/v1/ping', (_req, res) => {
  const responseData = { message: 'pong' };
  const result = PingSchema.safeParse(responseData);
  if (!result.success) {
    return res.status(500).json({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Response type validation failed' },
    });
  }
  res.json({ data: result.data, error: null });
});

// ── Auth Routes ───────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);

// ── Notice Routes ─────────────────────────────────────────────────────────
import noticeRoutes from './routes/notices';
app.use('/api/v1/notices', noticeRoutes);

// ── Directory Routes ───────────────────────────────────────────────────────
import directoryRoutes from './routes/directory';
app.use('/api/v1/directory', directoryRoutes);

// ── Ticket Routes ─────────────────────────────────────────────────────────
import ticketRoutes from './routes/tickets';
app.use('/api/v1/tickets', ticketRoutes);

// ── Invoice Routes ────────────────────────────────────────────────────────
import invoiceRoutes from './routes/invoices';
app.use('/api/v1/invoices', invoiceRoutes);

// ── Building Routes ───────────────────────────────────────────────────────
import buildingRoutes from './routes/buildings';
app.use('/api/v1/buildings', buildingRoutes);

// ── Unit Routes ───────────────────────────────────────────────────────────
import unitRoutes from './routes/units';
app.use('/api/v1/units', unitRoutes);

// ── Amenity / Booking Routes ──────────────────────────────────────────────
import amenityRoutes from './routes/amenities';
app.use('/api/v1/amenities', amenityRoutes);

// ── Visitor / Gate Routes ─────────────────────────────────────────────────
import visitorRoutes from './routes/visitors';
app.use('/api/v1/visitors', visitorRoutes);

// ── Poll / Vote Routes ────────────────────────────────────────────────────
import pollRoutes from './routes/polls';
app.use('/api/v1/polls', pollRoutes);

// ── Document Routes ───────────────────────────────────────────────────────
import documentRoutes from './routes/documents';
app.use('/api/v1/documents', documentRoutes);

// ── Audit Log Routes ──────────────────────────────────────────────────────
import auditLogRoutes from './routes/audit-log';
app.use('/api/v1/audit-logs', auditLogRoutes);

// ── Error Handler (must be last) ──────────────────────────────────────────
app.use(errorHandler);

export default app;
