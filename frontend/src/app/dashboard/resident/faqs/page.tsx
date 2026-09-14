'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { FAQSection, RESIDENT_FAQS } from '@/components/faq-section';

export default function ResidentFaqsPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6 animate-fade-in-up">
        <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0">
          <HelpCircle className="w-4.5 h-4.5 text-accent-600" />
        </div>
        <div>
          <h1 className="text-display-sm text-gray-900">Help &amp; FAQs</h1>
          <p className="text-body-sm text-gray-700">Answers to the questions residents ask most.</p>
        </div>
      </div>

      <FAQSection faqs={RESIDENT_FAQS} audience="residents" showHeader={false} />
    </div>
  );
}
