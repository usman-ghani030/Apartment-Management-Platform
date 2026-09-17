'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle, ArrowRight, Wrench, ScrollText } from 'lucide-react';
import { FAQSection, ADMIN_FAQS } from '@/components/faq-section';

export default function AdminFaqsPage() {
  return (
    <div className="min-h-screen bg-[#f6f8fc] text-gray-900">
      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200">
            <HelpCircle className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Help and FAQs</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Answers to the questions committee admins ask most. {ADMIN_FAQS.length} topics covered.
            </p>
          </div>
        </div>

        <FAQSection faqs={ADMIN_FAQS} audience="committee admins" showHeader={false} />

        {/* Still need help */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-title-sm font-display text-gray-900">Still need a hand?</h2>
              <p className="mt-1 max-w-md text-body-sm text-gray-600">
                Most day to day tasks live on two pages: the maintenance board for work on units, and the
                audit trail when you need to know who changed what.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/dashboard/admin/tickets"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
              >
                <Wrench className="h-4 w-4" />
                Maintenance board
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/admin/audit-log"
                className="inline-flex items-center gap-2 rounded-xl border border-accent-200 bg-white px-4 py-2.5 text-body-sm font-medium text-accent-700 transition-all hover:bg-accent-50"
              >
                <ScrollText className="h-4 w-4" />
                Audit trail
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
