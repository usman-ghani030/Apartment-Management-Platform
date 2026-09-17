'use client';

import React from 'react';
import Link from 'next/link';
import { HelpCircle, ArrowRight, Wrench, Bell } from 'lucide-react';
import { FAQSection, RESIDENT_FAQS } from '@/components/faq-section';

export default function ResidentFaqsPage() {
  return (
    <div className="min-h-screen text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 ring-1 ring-accent-200">
            <HelpCircle className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold text-gray-900">Help and FAQs</h1>
            <p className="mt-0.5 text-body-sm text-gray-500">
              Answers to the questions residents ask most. {RESIDENT_FAQS.length} topics covered.
            </p>
          </div>
        </div>

        <FAQSection faqs={RESIDENT_FAQS} audience="residents" showHeader={false} />

        {/* Still need help */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-title-sm font-display text-gray-900">Still stuck?</h2>
              <p className="mt-1 max-w-md text-body-sm text-gray-600">
                Raise a maintenance ticket and your committee will pick it up, or check the notice board
                for anything your society has posted recently.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/dashboard/resident/tickets"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
              >
                <Wrench className="h-4 w-4" />
                Raise a ticket
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/dashboard/resident/notices"
                className="inline-flex items-center gap-2 rounded-xl border border-accent-200 bg-white px-4 py-2.5 text-body-sm font-medium text-accent-700 transition-all hover:bg-accent-50"
              >
                <Bell className="h-4 w-4" />
                Notice board
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
