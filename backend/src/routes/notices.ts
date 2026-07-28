import { Router } from 'express';
import { prisma } from '../lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess, sendPaginated } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { sendNotification } from '../lib/notifications';
import { CreateNoticeSchema, UpdateNoticeSchema } from '@apartment/shared';
import type { NoticeResponse } from '@apartment/shared';

const router = Router();

type NoticeWithAuthor = Prisma.NoticeGetPayload<{ include: { author: { select: { name: true } } } }>;
type ReadReceipt = Prisma.NoticeReadReceiptGetPayload<{}>;

// Helper to format a Notice for API response
function formatNotice(notice: NoticeWithAuthor, readCount?: number, hasRead?: boolean): NoticeResponse {
  return {
    id: notice.id,
    societyId: notice.societyId,
    authorId: notice.authorId,
    authorName: notice.author?.name || 'Unknown',
    title: notice.title,
    content: notice.content,
    category: notice.category,
    publishedAt: notice.publishedAt?.toISOString() ?? null,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
    readCount,
    hasRead,
  };
}

// ── POST /api/v1/notices ───────────────────────────────────────────────────
// Admin/committee creates a new notice
router.post(
  '/',
  requireAuth,
  loadMembership,
  requireRole('create', 'notice'),
  async (req, res, next) => {
    try {
      const input = CreateNoticeSchema.parse(req.body);
      const societyId = req.membership!.societyId;

      const notice = await prisma.notice.create({
        data: {
          societyId,
          authorId: req.user!.id,
          title: input.title,
          content: input.content,
          category: input.category,
          publishedAt: input.publish ? new Date() : null,
        },
        include: { author: { select: { name: true } } },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: input.publish ? 'NOTICE_PUBLISHED' : 'NOTICE_CREATED',
        entityType: 'notice',
        entityId: notice.id,
        after: { title: notice.title, category: notice.category, published: !!input.publish },
      });

      if (input.publish) {
        await sendNotification({
          type: 'NOTICE_PUBLISHED',
          noticeId: notice.id,
          title: notice.title,
          societyId,
        });
      }

      sendSuccess(res, formatNotice(notice), 201);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/notices ────────────────────────────────────────────────────
// List notices for the current society (residents see published; admins see all)
router.get(
  '/',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const role = req.membership!.role;
      const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const where: any = {
        societyId,
        deletedAt: null,
        ...(isAdmin ? {} : { publishedAt: { not: null } }),
      };
      // For residents, only show published notices
      // For admins, show all (including drafts)

      if (cursor) {
        where.createdAt = { lt: new Date(cursor) };
      }

      const notices: NoticeWithAuthor[] = await prisma.notice.findMany({
        where,
        include: { author: { select: { name: true } } },
        orderBy: isAdmin ? { createdAt: 'desc' } : { publishedAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = notices.length > limit;
      const data = notices.slice(0, limit).map((n: NoticeWithAuthor) => formatNotice(n));

      // For residents, track read receipts
      if (!isAdmin && req.user) {
        const userId = req.user.id;
        const readReceipts: ReadReceipt[] = await prisma.noticeReadReceipt.findMany({
          where: { userId, noticeId: { in: data.map((n: NoticeResponse) => n.id) } },
        });
        const readNoticeIds = new Set(readReceipts.map((r: ReadReceipt) => r.noticeId));
        data.forEach((n: NoticeResponse) => { n.hasRead = readNoticeIds.has(n.id); });
      }

      const nextCursor = hasMore ? data[data.length - 1].createdAt : null;

      sendPaginated(res, data, nextCursor);
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/v1/notices/:id ────────────────────────────────────────────────
// Get a single notice with read receipt tracking
router.get(
  '/:id',
  requireAuth,
  loadMembership,
  async (req, res, next) => {
    try {
      const societyId = req.membership?.societyId;
      if (!societyId) {
        throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
      }

      const role = req.membership!.role;
      const isAdmin = role === 'COMMITTEE_ADMIN' || role === 'SUPER_ADMIN';

      const notice = await prisma.notice.findFirst({
        where: {
          id: req.params.id,
          societyId,
          deletedAt: null,
          ...(isAdmin ? {} : { publishedAt: { not: null } }),
        },
        include: { author: { select: { name: true } } },
      });

      if (!notice) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Notice not found');
      }

      // Get read count
      const readCount = await prisma.noticeReadReceipt.count({
        where: { noticeId: notice.id },
      });

      // Record read receipt for residents
      let hasRead = false;
      if (!isAdmin && req.user) {
        const existing = await prisma.noticeReadReceipt.findUnique({
          where: { noticeId_userId: { noticeId: notice.id, userId: req.user.id } },
        });
        if (existing) {
          hasRead = true;
        } else {
          await prisma.noticeReadReceipt.create({
            data: { noticeId: notice.id, userId: req.user.id },
          });
          hasRead = true;
        }
      }

      sendSuccess(res, formatNotice(notice, readCount, hasRead));
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/v1/notices/:id ──────────────────────────────────────────────
// Admin updates a notice
router.patch(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('update', 'notice'),
  async (req, res, next) => {
    try {
      const input = UpdateNoticeSchema.parse(req.body);
      const societyId = req.membership!.societyId;

      const existing = await prisma.notice.findFirst({
        where: { id: req.params.id, societyId, deletedAt: null },
      });
      if (!existing) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Notice not found');
      }

      const updateData: any = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.publish === true && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }

      const notice = await prisma.notice.update({
        where: { id: req.params.id },
        data: updateData,
        include: { author: { select: { name: true } } },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'NOTICE_UPDATED',
        entityType: 'notice',
        entityId: notice.id,
        before: { title: existing.title, publishedAt: existing.publishedAt?.toISOString() ?? null },
        after: { title: notice.title, publishedAt: notice.publishedAt?.toISOString() ?? null },
      });

      sendSuccess(res, formatNotice(notice));
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/v1/notices/:id ─────────────────────────────────────────────
// Admin soft-deletes a notice
router.delete(
  '/:id',
  requireAuth,
  loadMembership,
  requireRole('delete', 'notice'),
  async (req, res, next) => {
    try {
      const societyId = req.membership!.societyId;

      const existing = await prisma.notice.findFirst({
        where: { id: req.params.id, societyId, deletedAt: null },
      });
      if (!existing) {
        throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Notice not found');
      }

      await prisma.notice.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() },
      });

      await logAudit({
        societyId,
        actorUserId: req.user!.id,
        action: 'NOTICE_DELETED',
        entityType: 'notice',
        entityId: existing.id,
        before: { title: existing.title },
      });

      sendSuccess(res, { message: 'Notice deleted' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
