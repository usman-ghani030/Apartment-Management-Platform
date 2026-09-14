'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// FAQ section used on the admin / resident / guard dashboards.
//
// Answers describe behaviour that actually exists in the app — keep them in
// sync with the backend when a feature changes (e.g. the vendor job link flow).
// ─────────────────────────────────────────────────────────────────────────────

export interface FAQ {
  q: string;
  a: string;
}

function FAQItem({ q, a }: FAQ) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-xl border transition-all duration-300 overflow-hidden ${
        open
          ? 'border-accent-200 bg-accent-50/50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-accent-200 hover:shadow-sm'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left"
      >
        <span className={`text-body-sm font-semibold transition-colors ${open ? 'text-accent-800' : 'text-gray-800'}`}>
          {q}
        </span>
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
            open ? 'bg-accent-600 text-white rotate-180' : 'bg-accent-50 text-accent-600'
          }`}
        >
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[28rem] opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-4 pb-4 text-body-sm text-gray-700 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export function FAQSection({
  faqs,
  audience,
  showHeader = true,
  className = '',
}: {
  faqs: FAQ[];
  /** Used in the intro line, e.g. "committee admins". */
  audience: string;
  /** Off on pages that already have their own page header (the /faqs pages). */
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <section className={className} aria-labelledby={showHeader ? 'faq-heading' : undefined}>
      {showHeader && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-4 h-4 text-accent-600" />
            </div>
            <h2 id="faq-heading" className="text-title-sm text-gray-900">
              Frequently asked questions
            </h2>
          </div>
          <p className="text-body-sm text-gray-700 mb-4">
            Quick answers to what {audience} ask most.
          </p>
        </>
      )}
      <div className="space-y-2">
        {faqs.map((faq) => (
          <FAQItem key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </div>
    </section>
  );
}

// ── Content per audience ────────────────────────────────────────────────────

export const ADMIN_FAQS: FAQ[] = [
  {
    q: 'How do I add all my buildings and units quickly?',
    a: 'Open Units and choose Import CSV. The sample template gives you the exact columns (building name, unit number, floor, bedroom type and primary contact). Units that already exist are skipped, so re-importing the same file is safe.',
  },
  {
    q: 'How does the monthly billing run work?',
    a: 'On the Invoices page, set a day of the month (1–28) under Recurring billing and save. On that day OmniHome creates an invoice for every active unit and notifies the residents. New invoices start at zero, so set the amounts once they appear. This is separate from Automated dues reminders, which chase invoices that already exist a few days before their due date.',
  },
  {
    q: 'How do I assign a ticket to a vendor — do they need an account?',
    a: 'No account is needed. Open the ticket, enter the vendor’s name and email, then click Assign. They receive an email with a personal link that opens the job without a login, where they can mark it In progress and Resolved. Reassigning to a different vendor disables the previous link straight away, and closing the ticket (which is also where you rate the vendor) ends their access.',
  },
  {
    q: 'How do I move a resident out or transfer a unit?',
    a: 'Open the unit and choose Transfer / Move-Out. It lists any unpaid invoices and blocks the transfer until they are settled, then deactivates the memberships and clears the primary contact so the unit is cleanly ready for the next occupant.',
  },
  {
    q: 'Can I send a notice to only some units?',
    a: 'Yes. When you create or edit a notice, set Target audience to Specific units and pick the ones you want. Leave it on All units to reach the whole society. Residents only ever see notices addressed to them.',
  },
  {
    q: 'Where can I see everything that has happened in my society?',
    a: 'The Audit trail page records every action with who did it and what changed, and is searchable and filterable. Analytics summarises the bigger picture: dues collection over time, average ticket resolution time, ticket volume by category, and vendor performance.',
  },
  {
    q: 'Who receives an SOS alert?',
    a: 'Every active committee admin, plus security guards who have an account for your society. Active alerts also appear as a high-priority card on your dashboard until they are acknowledged and resolved.',
  },
];

export const RESIDENT_FAQS: FAQ[] = [
  {
    q: 'How do I report a maintenance problem?',
    a: 'Go to Tickets and raise one with a category and description, attaching up to five photos. You can follow it from Open through Assigned, In progress and Resolved to Closed, and add comments at any point.',
  },
  {
    q: 'How do I let a visitor into the society?',
    a: 'Go to Visitors, create a pass and share the QR code with your guest. The guard scans it at the gate for check-in and check-out. You can cancel a pass any time before it is used.',
  },
  {
    q: 'How do I pay my maintenance dues?',
    a: 'Payments lists every invoice and its due date. If your society has online payments enabled you can pay directly from there; otherwise your committee records the payment and the invoice updates automatically.',
  },
  {
    q: 'How do I book an amenity like the clubhouse?',
    a: 'Go to Amenities, pick a date and a time slot. Your society’s rules — maximum duration, how far in advance you can book, how many bookings per day — are applied automatically, and overlapping bookings are rejected.',
  },
  {
    q: 'How do I vote in a society poll?',
    a: 'Polls shows every active poll; you can cast one vote per unit. Whether you see the results live, only after the poll closes, or not at all is decided by your committee when they create it.',
  },
  {
    q: 'How do I know when a package arrives for me?',
    a: 'Packages lists parcels logged at the gate by the guard, with an optional photo. Open it and mark the parcel as collected once you have picked it up.',
  },
  {
    q: 'I forgot my password — what do I do?',
    a: 'Choose Forgot password on the login page and enter your email. If your account was created with Google Sign-In, we will email you a link to sign in with Google instead, because those accounts have no password to reset.',
  },
  {
    q: 'What does the SOS button do?',
    a: 'Tap SOS Emergency on your dashboard, choose Medical, Fire, Security or Other, and confirm. It immediately alerts every committee admin and on-duty guard. Please use it only for genuine emergencies.',
  },
];

export const GUARD_FAQS: FAQ[] = [
  {
    q: 'How do I check a visitor in?',
    a: 'Scan the QR code on their pass, or type the token it shows, then confirm the visitor’s name, unit and vehicle match before tapping Check In. When they leave, scan again and tap Check Out.',
  },
  {
    q: 'The QR code will not scan — what now?',
    a: 'Ask the visitor to read out the token shown on their pass and type it into the box. A pass must be Approved or Pending to check in. If you get “not found”, the resident may have cancelled it — call them before letting anyone through.',
  },
  {
    q: 'How do I log a package for a resident?',
    a: 'Open Parcels, choose the unit, add a short description and optionally a photo, then tap Log Arrival. The resident sees it on their Packages page and marks it collected when they pick it up.',
  },
  {
    q: 'Can I see residents’ personal information?',
    a: 'Your account is limited to gate-related work — visitor passes and parcels. Resident contact details, invoices, notices and polls are not available from the guard screens.',
  },
  {
    q: 'What if I am also a committee admin?',
    a: 'An Admin dashboard shortcut appears in your sidebar, which takes you to the full committee admin screens for your society.',
  },
];
