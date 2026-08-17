import { Router } from 'express';
import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess, sendPaginated } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { sendNotification } from '../lib/notifications';
import { CreateTicketSchema, UpdateTicketSchema, AddCommentSchema } from '@apartment/shared';
import type { TicketResponse, TicketCommentResponse } from '@apartment/shared';

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ── Multer setup for ticket photo uploads ────────────────────────────────────
const TICKET_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'tickets');
if (!fs.existsSync(TICKET_UPLOAD_DIR)) {
  fs.mkdirSync(TICKET_UPLOAD_DIR, { recursive: true });
}

const ticketStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TICKET_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'ticket-' + uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
  },
});

const uploadTicketPhoto = multer({
  storage: ticketStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per photo
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

type TicketWithIncludes = Prisma.TicketGetPayload<{
  include: {
    resident: { select: { name: true } };
    unit: { select: { unitNumber: true } };
    ratedBy: { select: { name: true } };
    _count: { select: { comments: true } };
  };
}>;

// Every ticket query includes the rating author so responses can surface it.
const TICKET_INCLUDES = {
  resident: { select: { name: true } },
  unit: { select: { unitNumber: true } },
  ratedBy: { select: { name: true } },
  _count: { select: { comments: true } },
} as const;

type CommentWithAuthor = Prisma.TicketCommentGetPayload<{ include: { author: { select: { name: true } } } }>;

function formatTicket(t: TicketWithIncludes): TicketResponse {
  return {
    id: t.id,
    societyId: t.societyId,
    unitId: t.unitId,
    unitNumber: t.unit?.unitNumber ?? null,
    residentId: t.residentId,
    residentName: t.resident.name,
    title: t.title,
    description: t.description,
    category: t.category,
    status: t.status as import('@apartment/shared').TicketStatus,
    assignedTo: t.assignedTo,
    photosUrl: t.photosUrl,
    rating: t.rating,
    ratingComment: t.ratingComment,
    ratedById: t.ratedById,
    ratedByName: t.ratedBy?.name ?? null,
    ratedAt: t.ratedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    commentCount: t._count.comments,
  };
}

function formatComment(c: CommentWithAuthor): TicketCommentResponse {
  return {
    id: c.id,
    ticketId: c.ticketId,
    authorId: c.authorId,
    authorName: c.author?.name || 'Unknown',
    content: c.content,
    createdAt: c.createdAt.toISOString(),
  };
}

// ── POST /api/v1/tickets ───────────────────────────────────────────────────
// Resident creates a maintenance ticket
router.post('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const input = CreateTicketSchema.parse(req.body);
    const societyId = req.membership!.societyId;
    const unitId = input.unitId || req.membership!.unitId;

    const ticket = await prisma.ticket.create({
      data: {
        societyId,
        residentId: req.user!.id,
        unitId: unitId || undefined,
        title: input.title,
        description: input.description,
        category: input.category,
      },
      include: TICKET_INCLUDES,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id,
      action: 'TICKET_CREATED', entityType: 'ticket', entityId: ticket.id,
      after: { title: ticket.title, category: ticket.category },
    });

    await sendNotification({
      type: 'TICKET_CREATED', ticketId: ticket.id,
      title: ticket.title, societyId, residentId: req.user!.id,
    });

    sendSuccess(res, formatTicket(ticket), 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/tickets ────────────────────────────────────────────────────
// List tickets — residents see their own, admins see all
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const role = req.membership!.role;
    const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';
    const status = req.query.status as string | undefined;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const where: any = { societyId, deletedAt: null };
    if (!isAdmin) where.residentId = req.user!.id;
    if (status) where.status = status;
    if (cursor) where.createdAt = { lt: new Date(cursor) };

    const tickets = await prisma.ticket.findMany({
      where,
      include: TICKET_INCLUDES,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = tickets.length > limit;
    const data = tickets.slice(0, limit).map(formatTicket);
    const nextCursor = hasMore ? data[data.length - 1].createdAt : null;
    sendPaginated(res, data, nextCursor);
  } catch (err) { next(err); }
});

// ── GET /api/v1/tickets/vendor-ratings ─────────────────────────────────────
// Admin-only aggregated vendor ratings (Phase 7 slice 3). Grouped by the
// ticket's assigned vendor name; used wherever vendors are shown or selected
// for assignment. Route order matters: this must precede GET /:id.
router.get(
  '/vendor-ratings',
  requireAuth,
  loadMembership,
  requireRole('read', 'vendor'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;
      const grouped = await prisma.ticket.groupBy({
        by: ['assignedTo'],
        where: {
          societyId,
          deletedAt: null,
          assignedTo: { not: null },
          rating: { not: null },
        },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const summaries = grouped
        .filter((g): g is typeof g & { assignedTo: string } => !!g.assignedTo)
        .map((g) => ({
          vendorName: g.assignedTo,
          avgRating: Math.round((g._avg.rating ?? 0) * 10) / 10,
          count: g._count.rating,
        }))
        .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

      sendSuccess(res, summaries);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/tickets/:id ────────────────────────────────────────────────
router.get('/:id', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';

    const ticket = await prisma.ticket.findFirst({
      where: { id: req.params.id, societyId, deletedAt: null },
      include: TICKET_INCLUDES,
    });
    if (!ticket) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Ticket not found');
    if (!isAdmin && ticket.residentId !== req.user!.id) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');

    // Fetch comments
    const comments = await prisma.ticketComment.findMany({
      where: { ticketId: ticket.id },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const result = { ...formatTicket(ticket), comments: comments.map(formatComment) };
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/tickets/:id ──────────────────────────────────────────────
// Admin updates ticket (status, assign, etc.)
router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'ticket'), async (req, res, next) => {
  try {
    const input = UpdateTicketSchema.parse(req.body);
    const societyId = req.membership!.societyId;

    const existing = await prisma.ticket.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Ticket not found');

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;

    // Validate status transitions (basic enforcement)
    if (input.status && input.status !== existing.status) {
      const validTransitions: Record<string, string[]> = {
        OPEN: ['ASSIGNED', 'CLOSED'],
        ASSIGNED: ['IN_PROGRESS', 'CLOSED'],
        IN_PROGRESS: ['RESOLVED', 'CLOSED'],
        RESOLVED: ['CLOSED'],
        CLOSED: [],
      };
      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(input.status)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 400,
          `Cannot transition from ${existing.status} to ${input.status}. Allowed: ${allowed.join(', ') || 'none'}`);
      }
    }

    // Vendor rating (Phase 7 slice 3): a rating may only be given when the
    // ticket is closed (or is being closed). Re-rating an already-closed
    // ticket is allowed; rating any other state is rejected.
    const isClosing = input.status === 'CLOSED' || existing.status === 'CLOSED';
    if ((input.rating !== undefined || input.ratingComment !== undefined) && !isClosing) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 400,
        'A rating can only be given when the ticket is closed');
    }
    if (input.rating !== undefined) {
      updateData.rating = input.rating;
      updateData.ratedById = req.user!.id;
      updateData.ratedAt = new Date();
    }
    if (input.ratingComment !== undefined) {
      updateData.ratingComment = input.ratingComment;
    }

    // Record the close timestamp once, on the transition into CLOSED (used by
    // analytics for resolution time; unlike updatedAt it doesn't move on re-rating).
    if (input.status === 'CLOSED' && existing.status !== 'CLOSED') {
      updateData.closedAt = new Date();
    }

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data: updateData,
      include: TICKET_INCLUDES,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'TICKET_UPDATED',
      entityType: 'ticket', entityId: ticket.id,
      before: { status: existing.status },
      after: {
        status: ticket.status,
        ...(ticket.rating !== null ? { rating: ticket.rating, ratingComment: ticket.ratingComment ?? null } : {}),
      },
    });

    if (input.status && input.status !== existing.status) {
      await sendNotification({
        type: 'TICKET_STATUS_CHANGED', ticketId: ticket.id, title: ticket.title,
        societyId, oldStatus: existing.status, newStatus: ticket.status,
      });
    }

    sendSuccess(res, formatTicket(ticket));
  } catch (err) { next(err); }
});

// ── POST /api/v1/tickets/:id/comments ──────────────────────────────────────
router.post('/:id/comments', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const input = AddCommentSchema.parse(req.body);
    const societyId = req.membership!.societyId;
    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';

    const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!ticket) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Ticket not found');
    if (!isAdmin && ticket.residentId !== req.user!.id) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');

    const comment = await prisma.ticketComment.create({
      data: { ticketId: ticket.id, authorId: req.user!.id, content: input.content },
      include: { author: { select: { name: true } } },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'TICKET_COMMENT_ADDED',
      entityType: 'ticket_comment', entityId: comment.id,
      after: { ticketId: ticket.id },
    });

    await sendNotification({
      type: 'TICKET_COMMENT_ADDED', ticketId: ticket.id, societyId, authorId: req.user!.id,
    });

    sendSuccess(res, formatComment(comment), 201);
  } catch (err) { next(err); }
});

// ── POST /api/v1/tickets/:id/photos ─────────────────────────────────────────
// Upload a photo to a ticket
router.post('/:id/photos', requireAuth, loadMembership, uploadTicketPhoto.array('photos', 5), async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';

    const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!ticket) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Ticket not found');
    if (!isAdmin && ticket.residentId !== req.user!.id) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'No photos provided');
    }

    // Build photo URLs (relative paths for download endpoint)
    const photoUrls = files.map((f) => `/api/v1/tickets/photo/${f.filename}`);

    // Append to existing photosUrl
    const existingUrls = ticket.photosUrl ? JSON.parse(ticket.photosUrl) : [];
    const allUrls = [...existingUrls, ...photoUrls];

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { photosUrl: JSON.stringify(allUrls) },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'TICKET_PHOTOS_UPLOADED',
      entityType: 'ticket', entityId: ticket.id,
      after: { photoCount: allUrls.length },
    });

    sendSuccess(res, { urls: photoUrls }, 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/tickets/photo/:filename ─────────────────────────────────────
// Serve a ticket photo file
router.get('/photo/:filename', async (req, res, next) => {
  try {
    const filePath = path.join(TICKET_UPLOAD_DIR, req.params.filename);
    if (!fs.existsSync(filePath)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Photo not found');
    }
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

export default router;
