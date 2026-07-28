import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { CreatePollSchema, UpdatePollSchema, CastVoteSchema } from '@apartment/shared';
import type { PollResponse, PollOption } from '@apartment/shared';

const router = Router();

/**
 * Get the unit IDs that a user belongs to in a given society.
 */
async function getUserUnitIds(userId: string, societyId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId, societyId, status: 'ACTIVE', deletedAt: null, unitId: { not: null } },
    select: { unitId: true },
  });
  return memberships.map((m) => m.unitId).filter(Boolean) as string[];
}

// ── Helper: format poll for response ───────────────────────────────────────
function formatPoll(p: any, unitIds: string[]): PollResponse {
  const options = p.options as unknown as PollOption[];
  const totalVotes = p._count?.votes ?? 0;
  const myVote = p.votes?.find((v: any) => unitIds.includes(v.unitId));

  // Calculate results
  let results: { optionIndex: number; count: number }[] | undefined;
  const canSeeResults = p.resultsVisibility === 'LIVE' ||
    (p.resultsVisibility === 'AFTER_CLOSE' && p.status === 'CLOSED');

  if (canSeeResults) {
    const counts: Record<number, number> = {};
    for (const v of p.votes || []) {
      counts[v.optionIndex] = (counts[v.optionIndex] || 0) + 1;
    }
    results = options.map((_, i) => ({ optionIndex: i, count: counts[i] || 0 }));
  }

  return {
    id: p.id, societyId: p.societyId,
    title: p.title, description: p.description || null,
    options, createdBy: p.createdBy, noticeId: p.noticeId || null,
    startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString(),
    resultsVisibility: p.resultsVisibility as import('@apartment/shared').ResultsVisibility,
    status: p.status as import('@apartment/shared').PollStatus,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
    totalVotes, myVote: myVote?.optionIndex ?? null,
    hasVoted: !!myVote,
    ...(results ? { results } : {}),
  };
}

const pollInclude = {
  _count: { select: { votes: true } },
  votes: { select: { optionIndex: true, unitId: true } },
} as const;

// ── GET /api/v1/polls — list polls ─────────────────────────────────────────
router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const status = req.query.status as string | undefined;
    const unitIds = await getUserUnitIds(req.user!.id, societyId);

    const where: any = { societyId, deletedAt: null };
    if (status) where.status = status;

    const polls = await prisma.poll.findMany({
      where,
      include: pollInclude,
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, polls.map((p) => formatPoll(p, unitIds)));
  } catch (err) { next(err); }
});

// ── POST /api/v1/polls — create poll (admin) ──────────────────────────────
router.post('/', requireAuth, loadMembership, requireRole('create', 'poll'), async (req, res, next) => {
  try {
    const input = CreatePollSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'End time must be after start time');

    const poll = await prisma.poll.create({
      data: {
        societyId,
        title: input.title,
        description: input.description || null,
        options: input.options,
        createdBy: req.user!.id,
        noticeId: input.noticeId || null,
        startsAt,
        endsAt,
        resultsVisibility: input.resultsVisibility,
      },
      include: pollInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'POLL_CREATED',
      entityType: 'poll', entityId: poll.id,
      after: { title: input.title, options: input.options },
    });

    const unitIds = await getUserUnitIds(req.user!.id, societyId);
    sendSuccess(res, formatPoll(poll, unitIds), 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/polls/:id — view a single poll ────────────────────────────
router.get('/:id', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const unitIds = await getUserUnitIds(req.user!.id, societyId);
    const poll = await prisma.poll.findFirst({
      where: { id: req.params.id, societyId },
      include: pollInclude,
    });
    if (!poll) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Poll not found');
    sendSuccess(res, formatPoll(poll, unitIds));
  } catch (err) { next(err); }
});

// ── PATCH /api/v1/polls/:id — update poll (admin) ────────────────────────
router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'poll'), async (req, res, next) => {
  try {
    const input = UpdatePollSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    const existing = await prisma.poll.findFirst({ where: { id: req.params.id, societyId } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Poll not found');

    const updateData: any = {};
    if (input.title) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description || null;
    if (input.options) updateData.options = input.options;
    if (input.startsAt) updateData.startsAt = new Date(input.startsAt);
    if (input.endsAt) updateData.endsAt = new Date(input.endsAt);
    if (input.resultsVisibility) updateData.resultsVisibility = input.resultsVisibility;
    if (input.status) updateData.status = input.status;

    const updated = await prisma.poll.update({
      where: { id: req.params.id },
      data: updateData,
      include: pollInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'POLL_UPDATED',
      entityType: 'poll', entityId: updated.id,
      before: { status: existing.status }, after: { status: updated.status },
    });

    const unitIds = await getUserUnitIds(req.user!.id, societyId);
    sendSuccess(res, formatPoll(updated, unitIds));
  } catch (err) { next(err); }
});

// ── POST /api/v1/polls/:id/activate — activate a poll (admin) ─────────────
router.post('/:id/activate', requireAuth, loadMembership, requireRole('update', 'poll'), async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
    const poll = await prisma.poll.findFirst({ where: { id: req.params.id, societyId } });
    if (!poll) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Poll not found');
    if (poll.status !== 'DRAFT') throw new AppError(ErrorCodes.CONFLICT, 409, 'Only draft polls can be activated');

    const updated = await prisma.poll.update({
      where: { id: poll.id },
      data: { status: 'ACTIVE' },
      include: pollInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'POLL_ACTIVATED',
      entityType: 'poll', entityId: poll.id,
    });

    const unitIds = await getUserUnitIds(req.user!.id, societyId);
    sendSuccess(res, formatPoll(updated, unitIds));
  } catch (err) { next(err); }
});

// ── POST /api/v1/polls/:id/close — close a poll (admin) ───────────────────
router.post('/:id/close', requireAuth, loadMembership, requireRole('update', 'poll'), async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
    const poll = await prisma.poll.findFirst({ where: { id: req.params.id, societyId } });
    if (!poll) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Poll not found');
    if (poll.status !== 'ACTIVE') throw new AppError(ErrorCodes.CONFLICT, 409, 'Only active polls can be closed');

    const updated = await prisma.poll.update({
      where: { id: poll.id },
      data: { status: 'CLOSED' },
      include: pollInclude,
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'POLL_CLOSED',
      entityType: 'poll', entityId: poll.id,
    });

    const unitIds = await getUserUnitIds(req.user!.id, societyId);
    sendSuccess(res, formatPoll(updated, unitIds));
  } catch (err) { next(err); }
});

// ── POST /api/v1/polls/:id/vote — cast a vote (resident) ──────────────────
router.post('/:id/vote', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const input = CastVoteSchema.parse(req.body);
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');

    // Look up the user's actual unit IDs from the DB (defensive — not relying on req.membership.unitId)
    const unitIds = await getUserUnitIds(req.user!.id, societyId);
    if (unitIds.length === 0) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'You must have a unit assigned to vote');
    const unitId = unitIds[0]; // Use first assigned unit for voting

    const poll = await prisma.poll.findFirst({ where: { id: req.params.id, societyId } });
    if (!poll) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Poll not found');
    if (poll.status !== 'ACTIVE') throw new AppError(ErrorCodes.CONFLICT, 409, `Poll is ${poll.status.toLowerCase()} — voting is not allowed`);
    if (new Date() < poll.startsAt) throw new AppError(ErrorCodes.CONFLICT, 409, 'Voting has not started yet');
    if (new Date() > poll.endsAt) throw new AppError(ErrorCodes.CONFLICT, 409, 'Voting has ended');

    const options = poll.options as unknown as PollOption[];
    if (input.optionIndex < 0 || input.optionIndex >= options.length) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Invalid option');
    }

    // Check if this unit has already voted (one-vote-per-unit enforcement)
    const existingVote = await prisma.vote.findUnique({
      where: { pollId_unitId: { pollId: poll.id, unitId } },
    });
    if (existingVote) throw new AppError(ErrorCodes.CONFLICT, 409, 'Your unit has already voted on this poll');

    // Cast the vote
    const vote = await prisma.vote.create({
      data: {
        societyId, pollId: poll.id, unitId, userId: req.user!.id,
        optionIndex: input.optionIndex,
      },
    });

    await logAudit({
      societyId, actorUserId: req.user!.id, action: 'VOTE_CAST',
      entityType: 'poll', entityId: poll.id,
      after: { optionIndex: input.optionIndex },
    });

    sendSuccess(res, { message: 'Vote recorded', optionIndex: vote.optionIndex }, 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/polls/:id/results — get poll results (with visibility check)
router.get('/:id/results', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership?.societyId;
    if (!societyId) throw new AppError(ErrorCodes.MEMBERSHIP_REQUIRED, 403, 'Active membership required');
    const poll = await prisma.poll.findFirst({
      where: { id: req.params.id, societyId },
      include: {
        ...pollInclude,
      },
    });
    if (!poll) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Poll not found');

    const canSeeResults = poll.resultsVisibility === 'LIVE' ||
      (poll.resultsVisibility === 'AFTER_CLOSE' && poll.status === 'CLOSED');

    if (!canSeeResults) {
      throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Results are not available yet');
    }

    const options = poll.options as unknown as PollOption[];
    const counts: Record<number, number> = {};
    for (const v of poll.votes) {
      counts[v.optionIndex] = (counts[v.optionIndex] || 0) + 1;
    }
    const results = options.map((_, i) => ({ optionIndex: i, count: counts[i] || 0 }));
    const totalVotes = poll._count.votes;

    sendSuccess(res, { results, totalVotes });
  } catch (err) { next(err); }
});

export default router;
