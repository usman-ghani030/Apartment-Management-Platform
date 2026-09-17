'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, Search, X, ListFilter, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// FAQ section used on the admin / resident / guard dashboards.
//
// Answers describe behaviour that actually exists in the app - keep them in
// sync with the backend when a feature changes (e.g. the vendor job link flow).
// ─────────────────────────────────────────────────────────────────────────────

export interface FAQ {
  q: string;
  a: string;
  /** Groups related answers behind a filter chip, e.g. "Billing". */
  category?: string;
}

function FAQItem({
  faq,
  open,
  onToggle,
}: {
  faq: FAQ;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        open
          ? 'border-accent-200 bg-accent-50/40 shadow-[0_8px_24px_-14px_rgba(37,99,235,0.45)]'
          : 'border-gray-200/80 bg-white hover:border-accent-200 hover:shadow-[0_8px_24px_-16px_rgba(37,99,235,0.4)]'
      }`}
    >
      <span
        className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
          open ? 'bg-accent-500' : 'bg-transparent'
        }`}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          {faq.category && (
            <span className={`mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${open ? 'text-accent-600' : 'text-gray-400'}`}>
              {faq.category}
            </span>
          )}
          <span className={`block text-body font-medium transition-colors ${open ? 'text-accent-800' : 'text-gray-800'}`}>
            {faq.q}
          </span>
        </span>
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            open ? 'rotate-180 bg-accent-600 text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-accent-50 group-hover:text-accent-600'
          }`}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[40rem] opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="border-t border-accent-100/70 px-5 pb-5 pt-4 text-body-sm leading-relaxed text-gray-600">
          {faq.a}
        </p>
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
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const categories = useMemo(() => {
    const seen: string[] = [];
    faqs.forEach((f) => {
      if (f.category && !seen.includes(f.category)) seen.push(f.category);
    });
    return seen;
  }, [faqs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => {
      const matchesCategory = category === 'ALL' || f.category === category;
      if (!matchesCategory) return false;
      if (!q) return true;
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    });
  }, [faqs, query, category]);

  const allOpen = filtered.length > 0 && filtered.every((f) => openKeys.includes(f.q));
  const filtersActive = Boolean(query.trim() || category !== 'ALL');

  const toggle = (key: string) =>
    setOpenKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const toggleAll = () => {
    if (allOpen) {
      setOpenKeys((prev) => prev.filter((k) => !filtered.some((f) => f.q === k)));
    } else {
      setOpenKeys((prev) => Array.from(new Set([...prev, ...filtered.map((f) => f.q)])));
    }
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('ALL');
  };

  return (
    <section className={className} aria-labelledby={showHeader ? 'faq-heading' : undefined}>
      {showHeader && (
        <>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-accent-50">
              <HelpCircle className="h-4 w-4 text-accent-600" />
            </div>
            <h2 id="faq-heading" className="text-title-sm font-display text-gray-900">
              Frequently asked questions
            </h2>
          </div>
          <p className="mb-4 text-body-sm text-gray-500">
            Quick answers to what {audience} ask most.
          </p>
        </>
      )}

      {/* Search + category filters */}
      <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${faqs.length} answers...`}
              aria-label="Search the FAQs"
              className="w-full rounded-xl border border-gray-200/80 bg-gray-50 py-2.5 pl-10 pr-10 text-body-sm text-gray-900 placeholder-gray-400 transition-all focus:border-accent-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-accent-500/10"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {filtered.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-body-sm font-medium text-gray-600 transition-all hover:border-accent-200 hover:bg-accent-50 hover:text-accent-700"
            >
              {allOpen ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          )}
        </div>

        {categories.length > 1 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              <ListFilter className="h-3 w-3" />
              Topic
            </span>
            {['ALL', ...categories].map((c) => {
              const active = category === c;
              const count = c === 'ALL' ? faqs.length : faqs.filter((f) => f.category === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption-xs font-medium transition-all duration-200 ${
                    active
                      ? 'bg-accent-600 text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,1)]'
                      : 'bg-gray-50 text-gray-600 ring-1 ring-gray-200/80 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {c === 'ALL' ? 'All topics' : c}
                  <span className={`tabular-nums ${active ? 'text-white/75' : 'text-gray-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-50">
            <HelpCircle className="h-6 w-6 text-accent-500" />
          </div>
          <h3 className="mb-1.5 text-title-sm font-display text-gray-900">No answers matched</h3>
          <p className="mx-auto max-w-sm text-body-sm text-gray-500">
            Try fewer words, or browse another topic.
          </p>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-2.5 text-body-sm font-medium text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)] transition-all hover:bg-accent-700"
            >
              <X className="h-4 w-4" /> Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {filtered.map((faq) => (
              <FAQItem
                key={faq.q}
                faq={faq}
                open={openKeys.includes(faq.q)}
                onToggle={() => toggle(faq.q)}
              />
            ))}
          </div>
          <p className="mt-3 text-caption-xs text-gray-400">
            Showing {filtered.length} of {faqs.length} answer{faqs.length === 1 ? '' : 's'}
            {filtersActive ? ' for the current filters' : ''}.
          </p>
        </>
      )}
    </section>
  );
}

// ── Content per audience ────────────────────────────────────────────────────

export const ADMIN_FAQS: FAQ[] = [
  {
    category: 'Getting started',
    q: 'How do I add all my buildings and units quickly?',
    a: 'Open Units and choose Import CSV. The sample template gives you the exact columns (building name, unit number, floor, bedroom type and primary contact). Units that already exist are skipped, so re-importing the same file is safe.',
  },
  {
    category: 'Billing',
    q: 'How does the monthly billing run work?',
    a: 'On the Invoices page, set a day of the month (1-28) under Recurring billing and save. On that day OmniHome creates an invoice for every active unit and notifies the residents. New invoices start at zero, so set the amounts once they appear. This is separate from Automated dues reminders, which chase invoices that already exist a few days before their due date.',
  },
  {
    category: 'Billing',
    q: 'How is the OmniHome platform fee calculated?',
    a: 'It is progressive, like income tax brackets. The first 15 units are free for every society, units 16 to 50 cost Rs 20 each, 51 to 200 cost Rs 12 each and 201 to 500 cost Rs 8 each. A 100 unit society therefore pays Rs 1,300 a month, not 100 times one rate. Your Platform billing page always shows the full breakdown for each invoice.',
  },
  {
    category: 'Maintenance',
    q: 'How do I assign a ticket to a vendor - do they need an account?',
    a: 'No account is needed. Open the ticket, enter the vendor\u2019s name and email, then click Assign. They receive an email with a personal link that opens the job without a login, where they can mark it In progress and Resolved. Reassigning to a different vendor disables the previous link straight away, and closing the ticket (which is also where you rate the vendor) ends their access.',
  },
  {
    category: 'Units & residents',
    q: 'How do I move a resident out or transfer a unit?',
    a: 'Open the unit and choose Transfer / Move-Out. It lists any unpaid invoices and blocks the transfer until they are settled, then deactivates the memberships and clears the primary contact so the unit is cleanly ready for the next occupant.',
  },
  {
    category: 'Units & residents',
    q: 'How do I invite a resident and what do they receive?',
    a: 'On the Residents page, invite someone with their name, email and role. For residents you also pick the unit they belong to. If they have no OmniHome account yet, a temporary password is shown once after inviting - share it with them so they can sign in and change it. Without a valid invite or unit, nobody gains access to your society.',
  },
  {
    category: 'Communication',
    q: 'Can I send a notice to only some units?',
    a: 'Yes. When you create or edit a notice, set Target audience to Specific units and pick the ones you want. Leave it on All units to reach the whole society. Residents only ever see notices addressed to them.',
  },
  {
    category: 'Reporting',
    q: 'Where can I see everything that has happened in my society?',
    a: 'The Audit trail page records every action with who did it and what changed, and is searchable and filterable. Analytics summarises the bigger picture: dues collection over time, average ticket resolution time, ticket volume by category, and vendor performance.',
  },
  {
    category: 'Safety',
    q: 'Who receives an SOS alert?',
    a: 'Every active committee admin, plus security guards who have an account for your society. Active alerts also appear as a high-priority card on your dashboard until they are acknowledged and resolved.',
  },
];

export const RESIDENT_FAQS: FAQ[] = [
  {
    category: 'Maintenance',
    q: 'How do I report a maintenance problem?',
    a: 'Go to Tickets and raise one with a category and description, attaching up to five photos. You can follow it from Open through Assigned, In progress and Resolved to Closed, and add comments at any point.',
  },
  {
    category: 'Visitors',
    q: 'How do I let a visitor into the society?',
    a: 'Go to Visitors, create a pass and share the QR code with your guest. The guard scans it at the gate for check-in and check-out. You can cancel a pass any time before it is used.',
  },
  {
    category: 'Payments',
    q: 'How do I pay my maintenance dues?',
    a: 'Payments lists every invoice and its due date. If your society has online payments enabled you can pay directly from there; otherwise your committee records the payment and the invoice updates automatically.',
  },
  {
    category: 'Amenities',
    q: 'How do I book an amenity like the clubhouse?',
    a: 'Go to Amenities, pick a date and a time slot. Your society\u2019s rules - maximum duration, how far in advance you can book, how many bookings per day - are applied automatically, and overlapping bookings are rejected.',
  },
  {
    category: 'Polls',
    q: 'How do I vote in a society poll?',
    a: 'Polls shows every active poll; you can cast one vote per unit. Whether you see the results live, only after the poll closes, or not at all is decided by your committee when they create it.',
  },
  {
    category: 'Packages',
    q: 'How do I know when a package arrives for me?',
    a: 'Packages lists parcels logged at the gate by the guard, with an optional photo. Open it and mark the parcel as collected once you have picked it up.',
  },
  {
    category: 'Account',
    q: 'I forgot my password - what do I do?',
    a: 'Choose Forgot password on the login page and enter your email. If your account was created with Google Sign-In, we will email you a link to sign in with Google instead, because those accounts have no password to reset.',
  },
  {
    category: 'Safety',
    q: 'What does the SOS button do?',
    a: 'Tap SOS Emergency on your dashboard, choose Medical, Fire, Security or Other, and confirm. It immediately alerts every committee admin and on-duty guard. Please use it only for genuine emergencies.',
  },
];

export const GUARD_FAQS: FAQ[] = [
  {
    category: 'Visitors',
    q: 'How do I check a visitor in?',
    a: 'Scan the QR code on their pass, or type the token it shows, then confirm the visitor\u2019s name, unit and vehicle match before tapping Check In. When they leave, scan again and tap Check Out.',
  },
  {
    category: 'Visitors',
    q: 'The QR code will not scan - what now?',
    a: 'Ask the visitor to read out the token shown on their pass and type it into the box. A pass must be Approved or Pending to check in. If you get \u201cnot found\u201d, the resident may have cancelled it - call them before letting anyone through.',
  },
  {
    category: 'Packages',
    q: 'How do I log a package for a resident?',
    a: 'Open Parcels, choose the unit, add a short description and optionally a photo, then tap Log Arrival. The resident sees it on their Packages page and marks it collected when they pick it up.',
  },
  {
    category: 'Privacy',
    q: 'Can I see residents\u2019 personal information?',
    a: 'Your account is limited to gate-related work - visitor passes and parcels. Resident contact details, invoices, notices and polls are not available from the guard screens.',
  },
  {
    category: 'Account',
    q: 'What if I am also a committee admin?',
    a: 'An Admin dashboard shortcut appears in your sidebar, which takes you to the full committee admin screens for your society.',
  },
];
