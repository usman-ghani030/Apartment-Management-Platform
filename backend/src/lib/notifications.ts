import { prisma } from './prisma';
import { logAudit } from './audit';

type NotificationEvent =
  | { type: 'NOTICE_PUBLISHED'; noticeId: string; title: string; societyId: string }
  | { type: 'TICKET_CREATED'; ticketId: string; title: string; societyId: string; residentId: string }
  | { type: 'TICKET_STATUS_CHANGED'; ticketId: string; title: string; societyId: string; oldStatus: string; newStatus: string }
  | { type: 'TICKET_COMMENT_ADDED'; ticketId: string; societyId: string; authorId: string }
  | { type: 'PARCEL_ARRIVED'; parcelId: string; societyId: string; unitId: string; description: string }
  | { type: 'DUE_REMINDER'; invoiceId: string; invoiceNumber: string; societyId: string; title: string; amount: number; dueDate: string; daysBefore: number }
  | { type: 'PAYMENT_CONFIRMED'; invoiceId: string; societyId: string; amount: number; txnRef: string | null };

/**
 * Send a notification. In Phase 1, this logs to the audit trail and console.
 * Future phases will wire up email (Resend/Postmark) and/or push notifications.
 *
 * To integrate a real provider later:
 * 1. Add the provider SDK (e.g., @resend/node)
 * 2. Add an email sending function here
 * 3. Call it alongside the audit log
 */
export async function sendNotification(event: NotificationEvent): Promise<void> {
  // Stub: log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[NOTIFICATION] ${event.type}`, JSON.stringify(event));
  }

  // Log significant events to audit trail
  switch (event.type) {
    case 'NOTICE_PUBLISHED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null, // System-generated notification
        action: 'NOTIFICATION_NOTICE_PUBLISHED',
        entityType: 'notice',
        entityId: event.noticeId,
        after: { title: event.title },
      });
      break;

    case 'TICKET_CREATED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_TICKET_CREATED',
        entityType: 'ticket',
        entityId: event.ticketId,
        after: { title: event.title },
      });
      break;

    case 'TICKET_STATUS_CHANGED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_TICKET_STATUS_CHANGED',
        entityType: 'ticket',
        entityId: event.ticketId,
        after: { title: event.title, oldStatus: event.oldStatus, newStatus: event.newStatus },
      });
      break;

    case 'TICKET_COMMENT_ADDED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_TICKET_COMMENT_ADDED',
        entityType: 'ticket',
        entityId: event.ticketId,
      });
      break;

    case 'PARCEL_ARRIVED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_PARCEL_ARRIVED',
        entityType: 'parcel',
        entityId: event.parcelId,
        after: { description: event.description, unitId: event.unitId },
      });
      break;

    case 'DUE_REMINDER':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_DUE_REMINDER',
        entityType: 'invoice',
        entityId: event.invoiceId,
        after: { invoiceNumber: event.invoiceNumber, title: event.title, amount: event.amount, dueDate: event.dueDate, daysBefore: event.daysBefore },
      });
      break;

    case 'PAYMENT_CONFIRMED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_PAYMENT_CONFIRMED',
        entityType: 'invoice',
        entityId: event.invoiceId,
        after: { amount: event.amount, txnRef: event.txnRef },
      });
      break;
  }
}
