import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, ErrorCodes } from '../lib/app-error';
import { sendSuccess } from '../lib/response';
import { requireAuth, loadMembership } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { logAudit } from '../lib/audit';
import { CreateAmenitySchema, UpdateAmenitySchema, CreateBookingSchema } from '@apartment/shared';
import type { AmenityResponse, BookingResponse } from '@apartment/shared';

const router = Router();

// ── Amenity CRUD ──────────────────────────────────────────────────────────

router.get('/', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const amenities = await prisma.amenity.findMany({
      where: { societyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, amenities.map((a) => ({
      id: a.id, societyId: a.societyId, name: a.name, description: a.description,
      maxDuration: a.maxDuration, advanceNotice: a.advanceNotice, maxPerUnit: a.maxPerUnit,
      isActive: a.isActive, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
    } as AmenityResponse)));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, loadMembership, requireRole('create', 'amenity'), async (req, res, next) => {
  try {
    const input = CreateAmenitySchema.parse(req.body);
    const societyId = req.membership!.societyId;
    const amenity = await prisma.amenity.create({
      data: { societyId, ...input },
    });
    await logAudit({ societyId, actorUserId: req.user!.id, action: 'AMENITY_CREATED', entityType: 'amenity', entityId: amenity.id, after: { name: amenity.name } });
    sendSuccess(res, { ...amenity, createdAt: amenity.createdAt.toISOString(), updatedAt: amenity.updatedAt.toISOString() } as AmenityResponse, 201);
  } catch (err) { next(err); }
});

router.patch('/:id', requireAuth, loadMembership, requireRole('update', 'amenity'), async (req, res, next) => {
  try {
    const input = UpdateAmenitySchema.parse(req.body);
    const societyId = req.membership!.societyId;
    const existing = await prisma.amenity.findFirst({ where: { id: req.params.id, societyId, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Amenity not found');
    const updated = await prisma.amenity.update({ where: { id: req.params.id }, data: input });
    sendSuccess(res, { ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() } as AmenityResponse);
  } catch (err) { next(err); }
});

// ── Booking CRUD ──────────────────────────────────────────────────────────

router.post('/book', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const input = CreateBookingSchema.parse(req.body);
    const societyId = req.membership!.societyId;
    const unitId = req.membership!.unitId;
    if (!unitId) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'You must have a unit assigned to make bookings');

    const amenity = await prisma.amenity.findFirst({ where: { id: input.amenityId, societyId, isActive: true, deletedAt: null } });
    if (!amenity) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Amenity not found');

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    const durationMin = (end.getTime() - start.getTime()) / 60000;

    if (durationMin <= 0) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'End time must be after start time');
    if (durationMin > amenity.maxDuration) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, `Booking cannot exceed ${amenity.maxDuration} minutes`);

    const minStart = new Date(Date.now() + amenity.advanceNotice * 3600000);
    if (start < minStart) throw new AppError(ErrorCodes.VALIDATION_ERROR, 400, `Must book at least ${amenity.advanceNotice} hours in advance`);

    // Conflict check: overlapping confirmed bookings for the same amenity
    const conflict = await prisma.booking.findFirst({
      where: {
        amenityId: input.amenityId,
        status: 'CONFIRMED',
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
    if (conflict) throw new AppError(ErrorCodes.CONFLICT, 409, 'This time slot is already booked');

    // Per-unit daily limit
    const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const dailyCount = await prisma.booking.count({
      where: { unitId, amenityId: input.amenityId, status: 'CONFIRMED', startTime: { gte: dayStart, lt: dayEnd } },
    });
    if (dailyCount >= amenity.maxPerUnit) throw new AppError(ErrorCodes.CONFLICT, 409, `Maximum ${amenity.maxPerUnit} booking(s) per day for this amenity`);

    const booking = await prisma.booking.create({
      data: { societyId, amenityId: input.amenityId, unitId, residentId: req.user!.id, startTime: start, endTime: end },
      include: { amenity: { select: { name: true } }, unit: { select: { unitNumber: true } }, resident: { select: { name: true } } },
    });

    await logAudit({ societyId, actorUserId: req.user!.id, action: 'BOOKING_CREATED', entityType: 'booking', entityId: booking.id, after: { amenityId: input.amenityId, startTime: input.startTime } });

    sendSuccess(res, {
      id: booking.id, societyId: booking.societyId, amenityId: booking.amenityId,
      amenityName: booking.amenity.name, unitId: booking.unitId, unitNumber: booking.unit.unitNumber,
      residentId: booking.residentId, residentName: booking.resident.name,
      startTime: booking.startTime.toISOString(), endTime: booking.endTime.toISOString(),
      status: booking.status, createdAt: booking.createdAt.toISOString(), updatedAt: booking.updatedAt.toISOString(),
    } as BookingResponse, 201);
  } catch (err) { next(err); }
});

// ── GET /api/v1/amenities/bookings ────────────────────────────────────────
router.get('/bookings', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';
    const amenityId = req.query.amenityId as string | undefined;
    const date = req.query.date as string | undefined;

    const where: any = { societyId };
    if (!isAdmin && req.membership!.unitId) where.unitId = req.membership!.unitId;
    if (amenityId) where.amenityId = amenityId;
    if (date) {
      const d = new Date(date);
      where.startTime = { gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()), lt: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: { amenity: { select: { name: true } }, unit: { select: { unitNumber: true } }, resident: { select: { name: true } } },
      orderBy: { startTime: 'asc' },
    });

    sendSuccess(res, bookings.map((b) => ({
      id: b.id, societyId: b.societyId, amenityId: b.amenityId, amenityName: b.amenity.name,
      unitId: b.unitId, unitNumber: b.unit.unitNumber, residentId: b.residentId, residentName: b.resident.name,
      startTime: b.startTime.toISOString(), endTime: b.endTime.toISOString(),
      status: b.status as import('@apartment/shared').BookingStatus,
      createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
    } as BookingResponse)));
  } catch (err) { next(err); }
});

// ── POST /api/v1/amenities/bookings/:id/cancel ────────────────────────────
router.post('/bookings/:id/cancel', requireAuth, loadMembership, async (req, res, next) => {
  try {
    const societyId = req.membership!.societyId;
    const isAdmin = req.membership!.role === 'COMMITTEE_ADMIN' || req.membership!.role === 'SUPER_ADMIN';

    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, societyId } });
    if (!booking) throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Booking not found');
    if (!isAdmin && booking.unitId !== req.membership!.unitId) throw new AppError(ErrorCodes.FORBIDDEN, 403, 'Access denied');
    if (booking.status !== 'CONFIRMED') throw new AppError(ErrorCodes.CONFLICT, 409, 'Only confirmed bookings can be cancelled');

    await prisma.booking.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    await logAudit({ societyId, actorUserId: req.user!.id, action: 'BOOKING_CANCELLED', entityType: 'booking', entityId: booking.id });
    sendSuccess(res, { message: 'Booking cancelled' });
  } catch (err) { next(err); }
});

export default router;
