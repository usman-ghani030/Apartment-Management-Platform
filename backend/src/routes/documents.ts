import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { CreateDocumentFolderSchema, UpdateDocumentFolderSchema, CreateDocumentSchema } from '@apartment/shared';
import type { DocumentFolderResponse, DocumentResponse } from '@apartment/shared';

const router = Router();

// ── Multer setup ───────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// ── Helpers ────────────────────────────────────────────────────────────────
function formatFolder(f: any): DocumentFolderResponse {
  return {
    id: f.id, societyId: f.societyId, name: f.name,
    parentId: f.parentId || null,
    createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString(),
  };
}

function formatDoc(d: any): DocumentResponse {
  return {
    id: d.id, societyId: d.societyId, folderId: d.folderId || null,
    folderName: d.folder?.name || null, name: d.name, description: d.description || null,
    fileUrl: `/api/v1/documents/${d.id}/download`,
    fileSize: d.fileSize, mimeType: d.mimeType, uploadedBy: d.uploadedBy,
    uploaderName: d.uploader?.name || 'Unknown',
    createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
  };
}

const docInclude = {
  folder: { select: { name: true } },
  uploader: { select: { id: true, name: true, email: true } },
} as const;

// ── FOLDER ROUTES ──────────────────────────────────────────────────────────

// GET /api/v1/documents/folders — list folders
router.get('/folders', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const folders = await prisma.documentFolder.findMany({
      where: { societyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, folders.map(formatFolder));
  } catch (err) { next(err); }
});

// POST /api/v1/documents/folders — create folder
router.post('/folders', requireAuth, loadMembership, requireRole('create', 'document'), async (req, res, next) => {
  try {
    const input = CreateDocumentFolderSchema.parse(req.body);
    const societyId = req.membership!.societyId;

    const folder = await prisma.documentFolder.create({
      data: { societyId, name: input.name, parentId: input.parentId || null },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'DOCUMENT_FOLDER_CREATED',
      entityType: 'document_folder', entityId: folder.id,
      after: { name: input.name },
    });

    sendSuccess(res, formatFolder(folder), 201);
  } catch (err) { next(err); }
});

// PATCH /api/v1/documents/folders/:id — update folder
router.patch('/folders/:id', requireAuth, loadMembership, requireRole('update', 'document'), async (req, res, next) => {
  try {
    const input = UpdateDocumentFolderSchema.parse(req.body);
    const societyId = req.membership!.societyId;

    const existing = await prisma.documentFolder.findFirst({ where: { id: req.params.id, societyId } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Folder not found');

    const updated = await prisma.documentFolder.update({
      where: { id: req.params.id },
      data: { name: input.name, parentId: input.parentId },
    });

    sendSuccess(res, formatFolder(updated));
  } catch (err) { next(err); }
});

// DELETE /api/v1/documents/folders/:id — delete folder
router.delete('/folders/:id', requireAuth, loadMembership, requireRole('delete', 'document'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const existing = await prisma.documentFolder.findFirst({ where: { id: req.params.id, societyId } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Folder not found');

    await prisma.documentFolder.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    // Also soft-delete documents in this folder
    await prisma.document.updateMany({
      where: { folderId: req.params.id, societyId },
      data: { deletedAt: new Date() },
    });

    sendSuccess(res, { message: 'Folder deleted' });
  } catch (err) { next(err); }
});

// ── DOCUMENT ROUTES ─────────────────────────────────────────────────────────

// GET /api/v1/documents — list documents
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const folderId = req.query.folderId as string | undefined;

    const where: any = { societyId, deletedAt: null };
    if (folderId) where.folderId = folderId;

    const docs = await prisma.document.findMany({
      where,
      include: docInclude,
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, docs.map(formatDoc));
  } catch (err) { next(err); }
});

// POST /api/v1/documents/upload — upload document
router.post('/upload', requireAuth, loadMembership, requireRole('create', 'document'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'No file provided');
    const societyId = req.membership!.societyId;

    const input = CreateDocumentSchema.parse(req.body);

    const doc = await prisma.document.create({
      data: {
        societyId,
        folderId: input.folderId || null,
        name: input.name || req.file.originalname,
        description: input.description || null,
        fileUrl: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user!.id,
      },
      include: docInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'DOCUMENT_UPLOADED',
      entityType: 'document', entityId: doc.id,
      after: { name: doc.name, fileSize: doc.fileSize, mimeType: doc.mimeType },
    });

    sendSuccess(res, formatDoc(doc), 201);
  } catch (err) { next(err); }
});

// GET /api/v1/documents/:id/download — download document file
router.get('/:id/download', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const doc = await prisma.document.findFirst({ where: { id: req.params.id, societyId } });
    if (!doc) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Document not found');

    const filePath = path.join(UPLOAD_DIR, doc.fileUrl);
    if (!fs.existsSync(filePath)) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'File not found on disk');

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.name}"`);
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

// PATCH /api/v1/documents/:id — update document metadata
router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'document'), async (req, res, next) => {
  try {
    const { name, description, folderId } = req.body as { name?: string; description?: string; folderId?: string | null };
    const societyId = req.membership!.societyId;

    const existing = await prisma.document.findFirst({ where: { id: req.params.id, societyId } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Document not found');

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (folderId !== undefined) updateData.folderId = folderId || null;

    const updated = await prisma.document.update({
      where: { id: req.params.id },
      data: updateData,
      include: docInclude,
    });

    sendSuccess(res, formatDoc(updated));
  } catch (err) { next(err); }
});

// DELETE /api/v1/documents/:id — delete document
router.delete('/:id', requireAuth, loadMembership, requireRole('delete', 'document'), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const doc = await prisma.document.findFirst({ where: { id: req.params.id, societyId } });
    if (!doc) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Document not found');

    // Soft delete
    await prisma.document.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });

    // Optionally delete the file from disk
    const filePath = path.join(UPLOAD_DIR, doc.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'DOCUMENT_DELETED',
      entityType: 'document', entityId: doc.id,
      before: { name: doc.name },
    });

    sendSuccess(res, { message: 'Document deleted' });
  } catch (err) { next(err); }
});

export default router;
