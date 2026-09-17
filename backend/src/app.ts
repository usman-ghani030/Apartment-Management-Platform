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
// Capture the raw request body so webhook handlers can verify signatures over
// the exact bytes received (Safepay signs the raw body).
app.use(express.json({
  verify: (req: express.Request, _res, buf: Buffer) => {
    (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}));
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

// ── Parcel Routes ─────────────────────────────────────────────────────────
import parcelRoutes from './routes/parcels';
app.use('/api/v1/parcels', parcelRoutes);

// ── Payment Routes (Safepay webhook + verification) ────────────────────────
import paymentRoutes from './routes/payments';
app.use('/api/v1/payments', paymentRoutes);

// ── Audit Log Routes ──────────────────────────────────────────────────────
import auditLogRoutes from './routes/audit-log';
app.use('/api/v1/audit-logs', auditLogRoutes);

// ── Staff Routes (Phase 8) ────────────────────────────────────────────────
import staffRoutes from './routes/staff';
app.use('/api/v1/staff', staffRoutes);

// ── SOS Alert Routes (Phase 8) ────────────────────────────────────────────
import sosAlertRoutes from './routes/sos-alerts';
app.use('/api/v1/sos-alerts', sosAlertRoutes);

// ── Settings Routes (per-society settings, dues reminders) ─────────────────
import settingsRoutes from './routes/settings';
app.use('/api/v1/settings', settingsRoutes);

// ── Analytics Routes (admin-only aggregate view) ───────────────────────────
import analyticsRoutes from './routes/analytics';
app.use('/api/v1/analytics', analyticsRoutes);

// ── CSV Import Routes ─────────────────────────────────────────────────────
import importRoutes from './routes/import-csv';
app.use('/api/v1/import', importRoutes);

// ── Vendor Directory Routes (admin: search/create for ticket assignment) ───
import vendorRoutes from './routes/vendors';
app.use('/api/v1/vendors', vendorRoutes);

// ── Manual Payment Proof Routes (ADR 008: review queue, approve, reject) ───
// Resident submission lives on POST /api/v1/invoices/:id/payment-proof.
import paymentProofRoutes from './routes/payment-proofs';
app.use('/api/v1/payment-proofs', paymentProofRoutes);

// ── Signed Upload Routes (ADR 002: direct-to-Cloudinary with server signing) ─
import uploadRoutes from './routes/uploads';
app.use('/api/v1/uploads', uploadRoutes);

// ── Vendor Portal Routes (public, token-secured - no login) ────────────────
import vendorPortalRoutes from './routes/vendor-portal';
app.use('/api/v1/vendor', vendorPortalRoutes);

// ── Platform Billing Routes (Phase 9 - societies paying the platform) ───────
import platformBillingRoutes from './routes/platform-billing';
app.use('/api/v1/platform-billing', platformBillingRoutes);

// ── Error Handler (must be last) ──────────────────────────────────────────
app.use(errorHandler);

export default app;
