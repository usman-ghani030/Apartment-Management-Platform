import { prisma } from './prisma';
import { logAudit } from './audit';

type NotificationEvent =
  | { type: 'NOTICE_PUBLISHED'; noticeId: string; title: string; societyId: string }
  | { type: 'TICKET_CREATED'; ticketId: string; title: string; societyId: string; residentId: string }
  | { type: 'TICKET_STATUS_CHANGED'; ticketId: string; title: string; societyId: string; oldStatus: string; newStatus: string }
  | { type: 'TICKET_COMMENT_ADDED'; ticketId: string; societyId: string; authorId: string }
  | { type: 'PARCEL_ARRIVED'; parcelId: string; societyId: string; unitId: string; description: string }
  | { type: 'DUE_REMINDER'; invoiceId: string; invoiceNumber: string; societyId: string; title: string; amount: number; dueDate: string; daysBefore: number }
  | { type: 'PAYMENT_CONFIRMED'; invoiceId: string; societyId: string; amount: number; txnRef: string | null }
  | { type: 'SOS_ALERT_TRIGGERED'; sosAlertId: string; societyId: string; unitId: string; residentId: string; category: string }
  | { type: 'SOS_ALERT_ACKNOWLEDGED'; sosAlertId: string; societyId: string; acknowledgedBy: string }
  | { type: 'SOS_ALERT_RESOLVED'; sosAlertId: string; societyId: string; resolvedBy: string }
  | { type: 'RECURRING_BILLING_GENERATED'; invoiceId: string; invoiceNumber: string; societyId: string; unitId: string; unitNumber: string; billingPeriod: string }
  // ADR 008 - manual payment proofs. SUBMITTED goes to the society's admins,
  // APPROVED/REJECTED go back to the resident who submitted the proof.
  | { type: 'PAYMENT_PROOF_SUBMITTED'; proofId: string; invoiceId: string; invoiceNumber: string; societyId: string; unitNumber: string; residentName: string; claimedAmount: number; paymentMethod: string }
  | { type: 'PAYMENT_PROOF_APPROVED'; proofId: string; invoiceId: string; invoiceNumber: string; societyId: string; residentId: string; claimedAmount: number }
  | { type: 'PAYMENT_PROOF_REJECTED'; proofId: string; invoiceId: string; invoiceNumber: string; societyId: string; residentId: string; claimedAmount: number; rejectionReason: string };


/**
 * Send a notification. In Phase 1, this logs to the audit trail and console.
 * Future phases will wire up email and/or push notifications.
 *
 * Email must go through the shared provider (ADR 004): import `sendEmail` from
 * `./email` and call it alongside the audit log - never a provider SDK directly,
 * so a future provider switch stays contained.
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

    case 'SOS_ALERT_TRIGGERED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: event.residentId,
        action: 'SOS_ALERT_TRIGGERED',
        entityType: 'sos_alert',
        entityId: event.sosAlertId,
        after: { unitId: event.unitId, category: event.category },
      });
      break;

    case 'SOS_ALERT_ACKNOWLEDGED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'SOS_ALERT_ACKNOWLEDGED',
        entityType: 'sos_alert',
        entityId: event.sosAlertId,
        after: { acknowledgedBy: event.acknowledgedBy },
      });
      break;

    case 'SOS_ALERT_RESOLVED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'SOS_ALERT_RESOLVED',
        entityType: 'sos_alert',
        entityId: event.sosAlertId,
        after: { resolvedBy: event.resolvedBy },
      });
      break;

    case 'PAYMENT_PROOF_SUBMITTED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_PAYMENT_PROOF_SUBMITTED',
        entityType: 'payment_proof',
        entityId: event.proofId,
        after: {
          invoiceId: event.invoiceId,
          invoiceNumber: event.invoiceNumber,
          unitNumber: event.unitNumber,
          residentName: event.residentName,
          claimedAmount: event.claimedAmount,
          paymentMethod: event.paymentMethod,
        },
      });
      break;

    case 'PAYMENT_PROOF_APPROVED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_PAYMENT_PROOF_APPROVED',
        entityType: 'payment_proof',
        entityId: event.proofId,
        after: {
          invoiceId: event.invoiceId,
          invoiceNumber: event.invoiceNumber,
          residentId: event.residentId,
          claimedAmount: event.claimedAmount,
        },
      });
      break;

    case 'PAYMENT_PROOF_REJECTED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'NOTIFICATION_PAYMENT_PROOF_REJECTED',
        entityType: 'payment_proof',
        entityId: event.proofId,
        after: {
          invoiceId: event.invoiceId,
          invoiceNumber: event.invoiceNumber,
          residentId: event.residentId,
          claimedAmount: event.claimedAmount,
          rejectionReason: event.rejectionReason,
        },
      });
      break;

    case 'RECURRING_BILLING_GENERATED':
      await logAudit({
        societyId: event.societyId,
        actorUserId: null,
        action: 'RECURRING_BILLING_GENERATED',
        entityType: 'invoice',
        entityId: event.invoiceId,
        after: {
          invoiceNumber: event.invoiceNumber,
          unitId: event.unitId,
          unitNumber: event.unitNumber,
          billingPeriod: event.billingPeriod,
        },
      });
      break;
  }
}
