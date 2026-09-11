import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import {
  CSVUnitRowSchema,
  CSV_IMPORT_MAX_ROWS,
  CSV_IMPORT_MAX_FILE_SIZE_BYTES,
  CSV_IMPORT_HEADERS,
  type CSVUnitRow,
} from '@apartment/shared';
import { ZodError } from 'zod';

const router = Router();

// Multer: accept a single CSV file, 2 MB limit, memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CSV_IMPORT_MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.csv') || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Only CSV files are accepted'));
    }
  },
});

// In-memory job store (BullMQ would be ideal, but for this feature a Map is
// simpler and avoids a Redis dependency for a one-shot import). Jobs are keyed
// by a random ID and expire after 30 minutes.
interface ImportJob {
  id: string;
  societyId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  rows: CSVUnitRow[];
  created: number;
  skipped: number;
  errors: number;
  totalRows: number;
  errorDetails: { row: number; reason: string }[];
  createdAt: number;
}

const jobs = new Map<string, ImportJob>();
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Cleanup expired jobs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}, 5 * 60 * 1000);

// ── POST /api/v1/import/validate ────────────────────────────────────────────
// Parse CSV, validate every row, check duplicates. Returns a preview — NO DB writes.
router.post(
  '/validate',
  requireAuth,
  loadMembership,
  requireRole('create', 'unit'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;

      if (!req.file) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'No CSV file uploaded');
      }

      // Parse CSV
      const text = req.file.buffer.toString('utf-8');
      // Strip BOM if present
      const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
      const parsed = Papa.parse(cleanText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      });

      if (parsed.errors.length > 0) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `CSV parse error: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`
        );
      }

      const rows = parsed.data as Record<string, string>[];
      if (rows.length === 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'CSV file is empty (no data rows)');
      }

      if (rows.length > CSV_IMPORT_MAX_ROWS) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          400,
          `CSV has ${rows.length} rows — maximum allowed is ${CSV_IMPORT_MAX_ROWS}`
        );
      }

      // Validate each row
      const toCreate: CSVUnitRow[] = [];
      const toSkip: { row: number; buildingName: string; unitNumber: string; reason: string }[] = [];
      const errors: { row: number; reason: string }[] = [];

      // Pre-fetch all existing units for this society to check duplicates
      const existingUnits = await prisma.unit.findMany({
        where: { societyId, deletedAt: null },
        select: { unitNumber: true, building: { select: { name: true } } },
      });
      const existingSet = new Set(
        existingUnits.map((u) => `${u.building.name}::${u.unitNumber}`)
      );

      // Pre-fetch all existing buildings for this society
      const existingBuildings = await prisma.building.findMany({
        where: { societyId, deletedAt: null },
        select: { id: true, name: true },
      });
      const buildingMap = new Map(existingBuildings.map((b) => [b.name, b.id]));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // 1-indexed, +1 for header

        try {
          const validated = CSVUnitRowSchema.parse(row);
          const key = `${validated['Building Name']}::${validated['Unit Number']}`;

          if (existingSet.has(key)) {
            toSkip.push({
              row: rowNum,
              buildingName: validated['Building Name'],
              unitNumber: validated['Unit Number'],
              reason: 'Unit already exists in this building',
            });
          } else {
            toCreate.push(validated);
          }
        } catch (err) {
          if (err instanceof ZodError) {
            const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
            errors.push({ row: rowNum, reason: msg });
          } else {
            errors.push({ row: rowNum, reason: 'Unexpected validation error' });
          }
        }
      }

      sendSuccess(res, {
        toCreate,
        toSkip,
        errors,
        totalRows: rows.length,
        buildingNames: Array.from(buildingMap.keys()),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/v1/import/confirm ─────────────────────────────────────────────
// Takes validated rows and creates buildings + units. Runs synchronously but
// fast — for a 1000-row import it's a single transaction batch. Returns a job ID.
router.post(
  '/confirm',
  requireAuth,
  loadMembership,
  requireRole('create', 'unit'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const userId = req.user!.id;
      const { toCreate } = req.body as { toCreate: CSVUnitRow[] };

      if (!Array.isArray(toCreate) || toCreate.length === 0) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'No rows to import');
      }

      if (toCreate.length > CSV_IMPORT_MAX_ROWS) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, `Too many rows: ${toCreate.length} (max ${CSV_IMPORT_MAX_ROWS})`);
      }

      // Re-validate every row (don't trust the client copy)
      const validatedRows: CSVUnitRow[] = [];
      for (let i = 0; i < toCreate.length; i++) {
        try {
          validatedRows.push(CSVUnitRowSchema.parse(toCreate[i]));
        } catch (err) {
          if (err instanceof ZodError) {
            const msg = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
            throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, `Row ${i + 2}: ${msg}`);
          }
          throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, `Row ${i + 2}: invalid data`);
        }
      }

      // Create a job
      const jobId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const job: ImportJob = {
        id: jobId,
        societyId,
        status: 'running',
        rows: validatedRows,
        created: 0,
        skipped: 0,
        errors: 0,
        totalRows: validatedRows.length,
        errorDetails: [],
        createdAt: Date.now(),
      };
      jobs.set(jobId, job);

      // Process inline (fast for ≤1000 rows)
      await processImportJob(job, societyId, userId);

      sendSuccess(res, {
        jobId,
        status: job.status,
        created: job.created,
        skipped: job.skipped,
        errors: job.errors,
        totalRows: job.totalRows,
      }, 202);
    } catch (err) {
      next(err);
    }
  }
);

async function processImportJob(job: ImportJob, societyId: string, userId: string) {
  try {
    // Pre-fetch existing buildings
    const existingBuildings = await prisma.building.findMany({
      where: { societyId, deletedAt: null },
      select: { id: true, name: true },
    });
    const buildingMap = new Map(existingBuildings.map((b) => [b.name, b.id]));

    // Pre-fetch existing units for duplicate check
    const existingUnits = await prisma.unit.findMany({
      where: { societyId, deletedAt: null },
      select: { unitNumber: true, buildingId: true },
    });
    const existingSet = new Set(
      existingUnits.map((u) => `${u.buildingId}::${u.unitNumber}`)
    );

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Group rows by building name to minimize DB queries
    const buildingGroups = new Map<string, CSVUnitRow[]>();
    for (const row of job.rows) {
      const name = row['Building Name'];
      if (!buildingGroups.has(name)) buildingGroups.set(name, []);
      buildingGroups.get(name)!.push(row);
    }

    for (const [buildingName, rows] of buildingGroups) {
      // Find or create building
      let buildingId = buildingMap.get(buildingName);
      if (!buildingId) {
        const newBuilding = await prisma.building.create({
          data: { name: buildingName, societyId },
        });
        buildingId = newBuilding.id;
        buildingMap.set(buildingName, buildingId);

        await logAudit({
          societyId,
          actorUserId: userId,
          action: 'BUILDING_CREATED',
          entityType: 'building',
          entityId: buildingId,
          after: { name: buildingName },
        });
      }

      for (const row of rows) {
        try {
          const unitNumber = row['Unit Number'];
          const dupKey = `${buildingId}::${unitNumber}`;

          if (existingSet.has(dupKey)) {
            skipped++;
            continue;
          }

          await prisma.unit.create({
            data: {
              unitNumber,
              floor: row['Floor'] ?? 0,
              type: 'VACANT',
              bedroomType: row['Bedroom Type'],
              primaryContactName: row['Primary Contact Name'] || null,
              primaryContactEmail: row['Primary Contact Email'] || null,
              primaryContactPhone: row['Primary Contact Phone'] || null,
              buildingId,
              societyId,
            },
          });

          existingSet.add(dupKey);
          created++;
        } catch (err) {
          errors++;
          job.errorDetails.push({
            row: job.rows.indexOf(row) + 2,
            reason: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    }

    job.status = 'completed';
    job.created = created;
    job.skipped = skipped;
    job.errors = errors;

    // Single summary audit entry for the entire import
    await logAudit({
      societyId,
      actorUserId: userId,
      action: 'CSV_IMPORT_COMPLETED',
      entityType: 'import',
      entityId: job.id,
      after: { created, skipped, errors, totalRows: job.totalRows },
    });
  } catch (err) {
    job.status = 'failed';
    job.errorDetails.push({ row: 0, reason: err instanceof Error ? err.message : 'Unknown error' });
  }
}

// ── GET /api/v1/import/status/:jobId ────────────────────────────────────────
// Poll job progress
router.get('/status/:jobId', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const job = jobs.get(req.params.jobId);
    if (!job || job.societyId !== req.membership!.societyId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Import job not found');
    }

    sendSuccess(res, {
      jobId: job.id,
      status: job.status,
      created: job.created,
      skipped: job.skipped,
      errors: job.errors,
      totalRows: job.totalRows,
      errorDetails: job.errorDetails,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/import/sample-csv ───────────────────────────────────────────
// Download a sample CSV with headers and example rows
router.get('/sample-csv', requireAuth, (_req, res) => {
  const sampleRows = [
    { 'Building Name': 'Tower A', 'Unit Number': '101', 'Floor': '1', 'Bedroom Type': 'TWO_BED', 'Primary Contact Name': 'John Smith', 'Primary Contact Email': 'john@example.com', 'Primary Contact Phone': '+92 300 1234567' },
    { 'Building Name': 'Tower A', 'Unit Number': '102', 'Floor': '1', 'Bedroom Type': 'ONE_BED', 'Primary Contact Name': '', 'Primary Contact Email': '', 'Primary Contact Phone': '' },
    { 'Building Name': 'Tower A', 'Unit Number': '201', 'Floor': '2', 'Bedroom Type': 'THREE_BED', 'Primary Contact Name': 'Jane Doe', 'Primary Contact Email': 'jane@example.com', 'Primary Contact Phone': '' },
    { 'Building Name': 'Tower B', 'Unit Number': 'A-101', 'Floor': '1', 'Bedroom Type': 'STUDIO', 'Primary Contact Name': '', 'Primary Contact Email': '', 'Primary Contact Phone': '' },
    { 'Building Name': 'Tower B', 'Unit Number': 'A-102', 'Floor': '1', 'Bedroom Type': 'FOUR_PLUS_BED', 'Primary Contact Name': 'Ali Khan', 'Primary Contact Email': 'ali@example.com', 'Primary Contact Phone': '+92 321 9876543' },
  ];

  const csv = Papa.unparse(sampleRows, { columns: CSV_IMPORT_HEADERS as unknown as string[] });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sample-units-import.csv"');
  res.send(csv);
});

export default router;
