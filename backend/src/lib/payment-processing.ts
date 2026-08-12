import { prisma } from './prisma';
import { logAudit } from './audit';
import { sendNotification } from './notifications';

/**
 * Mark an invoice paid from a VERIFIED successful payment.
 *
 * Idempotent AND race-safe: the payment is claimed atomically with
 * `updateMany({ where: { id, status: 'pending' } })`, so a duplicate or
 * concurrent webhook delivery can never double-count, double-audit, or send
 * duplicate confirmation notifications. Returns false when already processed.
 */
export async function recordSuccessfulPayment(params: {
  paymentId: string;
  invoiceId: string;
  societyId: string;
  amount: number;
  txnRef: string | null;
}): Promise<boolean> {
  const claim = await prisma.payment.updateMany({
    where: { id: params.paymentId, status: 'pending' },
    data: { status: 'succeeded', paidAt: new Date(), providerTxnRef: params.txnRef ?? undefined },
  });
  if (claim.count === 0) return false; // Already terminal — nothing to do.

  await prisma.invoice.updateMany({
    where: { id: params.invoiceId, status: { not: 'PAID' } },
    data: { status: 'PAID' },
  });

  await logAudit({
    societyId: params.societyId,
    actorUserId: null,
    action: 'PAYMENT_CONFIRMED',
    entityType: 'payment',
    entityId: params.paymentId,
    after: { invoiceId: params.invoiceId, amount: params.amount, method: 'safepay', txnRef: params.txnRef },
  });

  await sendNotification({
    type: 'PAYMENT_CONFIRMED',
    invoiceId: params.invoiceId,
    societyId: params.societyId,
    amount: params.amount,
    txnRef: params.txnRef,
  });

  return true;
}
