'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, CreditCard, CalendarRange,
  Users, QrCode, BarChart3, Lock,
  Folder,
  CheckCircle, ChevronRight, ChevronDown, ArrowRight,
  Menu, X, Wrench, Star, Check,
} from 'lucide-react';


// ── ScrollReveal ──────────────────────────────────────────────────────────
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Feature Row (alternating editorial layout) ────────────────────────────
function FeatureRow({
  index,
  icon: Icon,
  label,
  headline,
  description,
  bullets,
  visual,
}: {
  index: number;
  icon: React.ElementType;
  label: string;
  headline: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
}) {
  const isReversed = index % 2 === 1;

  const content = (
    <>
      {/* Label with icon */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-accent-50 flex items-center justify-center text-accent-600">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <span className="text-body-sm font-semibold text-accent-600">{label}</span>
      </div>

      {/* Headline */}
      <h3 className="text-display-sm lg:text-display font-display text-gray-900 mb-4 leading-tight">{headline}</h3>

      {/* Description */}
      <p className="text-body text-gray-700 mb-5 leading-relaxed max-w-md">{description}</p>

      {/* Bullet list — plain dots, not icons */}
      <ul className="space-y-2.5 mb-6">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-body-sm text-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500 mt-2 flex-shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      {/* Learn more link */}
      <button className="inline-flex items-center gap-1 text-body-sm font-semibold text-accent-600 hover:text-accent-700 transition-colors group">
        Learn more
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </>
  );

  const visualCard = (
    <div className="rounded-2xl p-6 lg:p-8 bg-gradient-to-br from-accent-50 via-accent-50/60 to-white border border-accent-100 shadow-sm min-h-[280px] flex items-center justify-center">
      {visual}
    </div>
  );

  return (
    <FadeIn delay={index * 100}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center mb-24">
        {/* Text column */}
        <div className={isReversed ? 'lg:order-2' : 'lg:order-1'}>
          {content}
        </div>
        {/* Visual column */}
        <div className={isReversed ? 'lg:order-1' : 'lg:order-2'}>
          {visualCard}
        </div>
      </div>
    </FadeIn>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl overflow-hidden transition-all duration-300 bg-white border border-gray-200 hover:border-accent-300">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-body-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {q}
        <ChevronDown className={`w-4 h-4 text-gray-700 transition-transform duration-300 flex-shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-5 pb-4 text-body-sm text-gray-700 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// ── Pricing Card ──────────────────────────────────────────────────────────
function PricingCard({
  name, price, description, features, popular = false, cta, onCta,
}: {
  name: string; price: string; description: string; features: string[]; popular?: boolean; cta: string; onCta: () => void;
}) {
  return (
    <div className={`relative rounded-2xl p-8 border-2 transition-all duration-300 ${
      popular
        ? 'border-accent-500 bg-white shadow-elevated'
        : 'border-gray-200 bg-white hover:border-accent-300'
    }`}>
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent-600 text-white text-caption-xs font-semibold px-4 py-1 rounded-full shadow-sm">
          Most popular
        </span>
      )}
      <h3 className="text-title font-display text-gray-900 mb-1">{name}</h3>
      <p className="text-body-sm text-gray-700 mb-5">{description}</p>
      <div className="mb-6">
        <span className="text-display-lg font-display text-gray-900">{price}</span>
        {price !== 'Free' && <span className="text-body-sm text-gray-700 ml-1">/month</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3 text-body-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-accent-500 mt-0.5 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onCta}
        className={`w-full py-2.5 rounded-lg text-body-sm font-semibold transition-all ${
          popular
            ? 'bg-accent-600 hover:bg-accent-700 text-white shadow-button'
            : 'bg-gray-50 border border-gray-200 text-gray-700 hover:border-accent-300'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const testimonials = [
    { name: 'Sarah Chen', role: 'Committee Admin, Sunrise Apartments', quote: 'OmniHome transformed how we manage our 200-unit complex. What used to take hours now takes minutes.', rating: 5 },
    { name: 'Raj Patel', role: 'Resident, Green Valley', quote: 'Paying maintenance and booking the clubhouse is finally painless. The app is beautiful too!', rating: 5 },
    { name: 'Emily Brooks', role: 'Property Manager, Urban Heights', quote: 'The audit trail alone is worth it. Finally, full transparency for our homeowners association.', rating: 5 },
  ];

  const faqs = [
    { q: 'How long does it take to set up my society?', a: 'You can create your society and be fully operational in under 10 minutes. Adding buildings, units, and inviting residents is quick and intuitive.' },
    { q: 'Is my data secure and isolated?', a: 'Absolutely. Every society has a fully isolated database context. Role-based access control ensures only authorized users see specific data. All connections use encryption.' },
    { q: 'Can residents pay maintenance online?', a: 'Yes! We integrate with Stripe for secure online payments. Residents can pay with credit or debit cards. We also support offline payment tracking for societies that prefer cash or bank transfers.' },
    { q: 'What happens when the committee changes?', a: 'We offer a one-click committee transition export. All financial records, audit logs, and documents are packaged into a downloadable archive for the new committee.' },
    { q: 'Do you offer white-label options?', a: 'Enterprise plans include white-label options — your society name, colors, and logo, no OmniHome branding.' },
    { q: 'Is there a mobile app?', a: 'OmniHome is fully responsive and works beautifully on all devices — mobile, tablet, and desktop. A native mobile app is planned for a future release.' },
  ];

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-surface">
      {/* ── Background effect ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-accent-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-accent-800/[0.02] rounded-full blur-[150px]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white border-b border-gray-200 ${
        scrolled ? 'shadow-sm' : ''
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="bg-accent-600 p-2 rounded-lg text-white shadow-sm group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-title-sm font-display text-gray-900">
              Omni<span className="text-accent-600">Home</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.href.slice(1))}
                className="flex items-center gap-1 px-3 py-2 text-body-sm text-gray-500 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-50"
              >
                {link.label}
              </button>
            ))}
            <div className="flex items-center gap-3 ml-6">
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-2 rounded-full text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm"
              >
                Log in
              </button>
              <button
                onClick={() => router.push('/signup')}
                className="px-5 py-2 rounded-full text-body-sm font-semibold text-accent-600 border-2 border-accent-600 hover:bg-accent-600 hover:text-white transition-all"
              >
                Sign up
              </button>
            </div>
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-6 pb-5 space-y-2 bg-white border-b border-gray-200">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollTo(link.href.slice(1))}
                className="flex items-center justify-between w-full text-left text-body-sm text-gray-500 hover:text-gray-900 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {link.label}
              </button>
            ))}
            <hr className="border-gray-200" />
            <button onClick={() => router.push('/login')} className="w-full text-left text-body-sm text-gray-500 hover:text-gray-900 py-2.5 px-3 transition-colors">Log in</button>
            <button onClick={() => router.push('/signup')} className="w-full btn-primary justify-center">Sign up</button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left column */}
            <div>
              <FadeIn>                  <p className="text-body-sm font-semibold text-accent-600 mb-5">
                    Property management software
                  </p>
              </FadeIn>

              <FadeIn delay={100}>
                <h1 className="text-display-lg md:text-5xl lg:text-6xl font-display tracking-tight leading-[1.08] text-gray-900 max-w-xl">
                  The operating system for{' '}
                  <span className="text-accent-600">residential communities</span>
                </h1>
              </FadeIn>

              <FadeIn delay={200}>
                <p className="text-body md:text-lg text-gray-700 mt-5 max-w-md leading-relaxed">
                  Replace WhatsApp groups, paper notices, and spreadsheets with one connected platform — for committees, residents, and security.
                </p>
              </FadeIn>

              <FadeIn delay={300}>
                <div className="mt-8">
                  <button
                    onClick={() => router.push('/signup')}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-body-sm font-semibold text-white bg-accent-600 hover:bg-accent-700 transition-all shadow-sm hover:shadow-md"
                  >
                    Get started free
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="flex items-center gap-1.5 text-caption text-gray-700 mt-3">
                    <Check className="w-3.5 h-3.5 text-accent-500" />
                    14-day free trial · No credit card required
                  </p>
                </div>
              </FadeIn>
            </div>

            {/* Right column — modern apartment building image */}
            <FadeIn delay={200}>
              <div className="rounded-2xl overflow-hidden aspect-[4/3] w-full shadow-xl ring-1 ring-gray-200">
                <img
                  src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=1200&auto=format&fit=crop"
                  alt="Modern apartment building — residential community management"
                  className="w-full h-full object-cover"
                  
                />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────────────── */}
      <section className="pb-16 md:pb-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { name: 'Capterra', stars: 5 },
              { name: 'G2', stars: 5 },
              { name: 'Trustpilot', stars: 5 },
              { name: 'Google', stars: 5 },
            ].map((platform) => (
              <FadeIn key={platform.name} delay={300}>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-0.5 mb-1.5">
                    {Array.from({ length: platform.stars }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-accent-500 text-accent-500" />
                    ))}
                  </div>
                  <p className="text-caption-xs font-semibold text-gray-700 uppercase tracking-wider">{platform.name}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Everything your community needs
            </h2>
            <p className="text-body text-gray-700 max-w-lg mx-auto mt-4">
              From dues to visitors, one platform connects every part of community life.
            </p>
          </div>

          {/* Row 1: Payments — text left */}
          <FeatureRow
            index={0}
            icon={CreditCard}
            label="Payments"
            headline="Collect dues, effortlessly"
            description="Generate invoices, accept online payments via Stripe, and track every transaction. No more chasing residents for monthly maintenance."
            bullets={[
              'Automated monthly invoice generation',
              'Stripe integration for card payments',
              'Real-time payment reconciliation',
            ]}
            visual={
              <div className="space-y-3">
                <div className="flex items-center justify-between text-caption-xs text-gray-700 px-4">
                  <span>Resident</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                {[
                  { name: 'Unit 101', amount: '$120', status: 'Paid', paid: true },
                  { name: 'Unit 102', amount: '$120', status: 'Overdue', paid: false },
                  { name: 'Unit 103', amount: '$120', status: 'Paid', paid: true },
                  { name: 'Unit 104', amount: '$120', status: 'Pending', paid: false },
                ].map((row, ri) => (
                  <div key={ri} className="flex items-center justify-between bg-white/60 rounded-lg px-4 py-2.5 text-body-sm">
                    <span className="text-gray-700 font-medium">{row.name}</span>
                    <span className="text-gray-700">{row.amount}</span>
                    <span className={`text-caption-xs font-medium ${row.paid ? 'text-accent-600' : 'text-amber-600'}`}>{row.status}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-accent-500/10 rounded-lg px-4 py-2.5 text-body-sm font-semibold text-accent-700">
                  <span>Total collected</span>
                  <span>$480</span>
                  <span>2 / 4 paid</span>
                </div>
              </div>
            }
          />

          {/* Row 2: Maintenance — text right */}
          <FeatureRow
            index={1}
            icon={Wrench}
            label="Maintenance"
            headline="Track repairs, start to finish"
            description="Residents submit tickets with photo attachments. Assign, track status, and resolve — all in one place."
            bullets={[
              'Photo attachments with each ticket',
              'Real-time status tracking (Open → In Progress → Resolved)',
              'Assignment & priority management',
            ]}
            visual={
              <div className="space-y-3">
                {[
                  { title: 'Leaking faucet', unit: 'Unit 201', status: 'In Progress', urgent: false },
                  { title: 'AC not cooling', unit: 'Unit 105', status: 'Open', urgent: true },
                  { title: 'Light fixture broken', unit: 'Unit 304', status: 'Resolved', urgent: false },
                  { title: 'Gate sensor issue', unit: 'Common', status: 'Assigned', urgent: false },
                ].map((ticket, ti) => (
                  <div key={ti} className="flex items-center gap-3 bg-white/60 rounded-lg px-4 py-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ticket.urgent ? 'bg-amber-500' : 'bg-accent-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-medium text-gray-700 truncate">{ticket.title}</p>
                      <p className="text-caption-xs text-gray-700">{ticket.unit}</p>
                    </div>
                    <span className={`text-caption-xs font-medium px-2 py-0.5 rounded-full ${
                      ticket.status === 'Resolved' ? 'bg-accent-50 text-accent-600' :
                      ticket.status === 'Open' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-100 text-gray-700'
                    }`}>{ticket.status}</span>
                  </div>
                ))}
              </div>
            }
          />

          {/* Row 3: Visitors — text left */}
          <FeatureRow
            index={2}
            icon={QrCode}
            label="Visitors"
            headline="Gate access, reimagined"
            description="Residents create digital visitor passes with QR codes. Security scans at the gate. Auto-expire on check-out."
            bullets={[
              'QR-coded digital visitor passes',
              'Security guard verification at gate',
              'Auto-revoke on resident move-out',
            ]}
            visual={
              <div className="max-w-sm mx-auto">
                {/* Visitor pass mockup */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-accent-50 flex items-center justify-center">
                      <QrCode className="w-5 h-5 text-accent-600" />
                    </div>
                    <div>
                      <p className="text-body-sm font-semibold text-gray-900">Visitor Pass</p>
                      <p className="text-caption-xs text-gray-700">Valid for today</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-20 h-20 bg-accent-50 rounded-lg flex items-center justify-center">
                      <div className="w-14 h-14 border-2 border-dashed border-accent-300 rounded" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-caption-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Visitor</span>
                      <span className="text-gray-700 font-medium">John Doe</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Unit</span>
                      <span className="text-gray-700 font-medium">Unit 201</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Purpose</span>
                      <span className="text-gray-700 font-medium">Family visit</span>
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          {/* Row 4: Amenities — text right */}
          <FeatureRow
            index={3}
            icon={CalendarRange}
            label="Amenities"
            headline="Book facilities, no conflicts"
            description="Real-time calendar for clubhouse, gym, pool, and more. Automatic conflict detection prevents double-bookings."
            bullets={[
              'Real-time availability calendar',
              'Automatic conflict prevention',
              'Advance notice & duration limits',
            ]}
            visual={
              <div className="max-w-sm mx-auto">
                {/* Calendar mini grid */}
                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                  {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d, di) => (
                    <span key={di} className="text-caption-xs text-gray-700 font-medium py-1">{d}</span>
                  ))}
                  {Array.from({ length: 30 }).map((_, ddi) => {
                    const isBooked = [5, 6, 12, 13, 19, 20].includes(ddi);
                    const isToday = ddi === 14;
                    return (
                      <span key={ddi} className={`text-caption-xs py-1.5 rounded ${
                        isToday ? 'bg-accent-600 text-white font-semibold' :
                        isBooked ? 'bg-accent-50 text-accent-600' :
                        'text-gray-700'
                      }`}>{ddi + 1}</span>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {[
                    { time: '09:00 - 11:00', amenity: 'Clubhouse', status: 'Booked' },
                    { time: '14:00 - 16:00', amenity: 'Tennis Court', status: 'Booked' },
                    { time: '17:00 - 19:00', amenity: 'Swimming Pool', status: 'Available' },
                  ].map((slot, si) => (
                    <div key={si} className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-caption-xs font-medium text-gray-700">{slot.amenity}</p>
                        <p className="text-caption-xs text-gray-700">{slot.time}</p>
                      </div>
                      <span className={`text-caption-xs font-medium ${
                        slot.status === 'Available' ? 'text-accent-600' : 'text-gray-700'
                      }`}>{slot.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            }
          />
        </div>
      </section>

      {/* ── Secondary features (pastel-tinted cards) ──────────────────── */}
      <section className="py-24 md:py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Plus, everything else your<br className="hidden sm:block" /> community needs
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Community Polls — light teal */}
            <FadeIn delay={0}>
              <div className="rounded-2xl p-6 bg-teal-50/70 border border-teal-100/80 h-full">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-teal-600 mb-4">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="text-title-sm font-display text-gray-900 mb-2">Community polls</h3>
                <p className="text-body-sm text-gray-700 leading-relaxed">
                  One-click e-voting with transparent results. Replace paper ballots and show-of-hands with digital democracy.
                </p>
              </div>
            </FadeIn>

            {/* Card 2: Resident Directory — light lavender */}
            <FadeIn delay={100}>
              <div className="rounded-2xl p-6 bg-purple-50/70 border border-purple-100/80 h-full">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-purple-600 mb-4">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-title-sm font-display text-gray-900 mb-2">Resident directory</h3>
                <p className="text-body-sm text-gray-700 leading-relaxed">
                  Searchable, building-grouped directory. Know your neighbors and build real community connections.
                </p>
              </div>
            </FadeIn>

            {/* Card 3: Role-Based Access — light blue */}
            <FadeIn delay={200}>
              <div className="rounded-2xl p-6 bg-blue-50/70 border border-blue-100/80 h-full">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-600 mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-title-sm font-display text-gray-900 mb-2">Role-based access</h3>
                <p className="text-body-sm text-gray-700 leading-relaxed">
                  Granular permissions for admins, residents, and guards. Complete audit trail for every action.
                </p>
              </div>
            </FadeIn>

            {/* Card 4: Document Storage — light mint */}
            <FadeIn delay={300}>
              <div className="rounded-2xl p-6 bg-emerald-50/70 border border-emerald-100/80 h-full">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-600 mb-4">
                  <Folder className="w-5 h-5" />
                </div>
                <h3 className="text-title-sm font-display text-gray-900 mb-2">Document storage</h3>
                <p className="text-body-sm text-gray-700 leading-relaxed">
                  Bylaws, meeting minutes, vendor contracts — all in one secure, organized place.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              What communities say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 120}>
                <div className="rounded-2xl p-6 bg-white border border-gray-200 hover:border-accent-300 transition-all duration-300 h-full flex flex-col shadow-sm">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} className="w-3.5 h-3.5 fill-accent-500 text-accent-500" />
                    ))}
                  </div>
                  <p className="text-body-sm text-gray-700 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-body-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-caption text-gray-700">{t.role}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 md:py-32 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Plans for every community
            </h2>
            <p className="text-body text-gray-700 mt-4">
              Start free. Upgrade when you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FadeIn delay={0}>
              <PricingCard
                name="Starter"
                price="Free"
                description="Perfect for small societies getting started."
                features={[
                  'Up to 50 units',
                  'Notices & announcements',
                  'Maintenance ticketing',
                  'Resident directory',
                  'Basic visitor passes',
                  'Email support',
                ]}
                cta="Get started"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
            <FadeIn delay={120}>
              <PricingCard
                name="Pro"
                price="$29"
                description="For growing communities with advanced needs."
                features={[
                  'Up to 200 units',
                  'Everything in Starter',
                  'Automated billing & invoices',
                  'Stripe payment integration',
                  'Amenity booking system',
                  'Community polls & voting',
                  'QR code visitor management',
                  'Priority support',
                ]}
                popular
                cta="Start free trial"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
            <FadeIn delay={240}>
              <PricingCard
                name="Enterprise"
                price="$79"
                description="For large complexes and multi-society groups."
                features={[
                  'Unlimited units',
                  'Everything in Pro',
                  'Document management',
                  'Audit trail & export',
                  'Multi-society management',
                  'Custom roles & permissions',
                  'Dedicated account manager',
                  'API access',
                  'White-label option',
                ]}
                cta="Contact sales"
                onCta={() => router.push('/signup')}
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 md:py-32 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-display lg:text-display-lg font-display text-gray-900">
              Frequently asked questions
            </h2>
          </div>

          <FadeIn delay={120}>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-28 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <div className="rounded-2xl bg-accent-600 p-10 md:p-16 text-center">
              <h2 className="text-display lg:text-display-lg font-display text-white mb-4">
                Ready to transform your community?
              </h2>
              <p className="text-body md:text-lg text-accent-100 max-w-lg mx-auto mb-8">
                Join thousands of communities already using OmniHome. Start your free trial today — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => router.push('/signup')}
                  className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-gray-100 text-accent-700 rounded-xl text-body-sm font-semibold transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
                >
                  Start free trial
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
                <button
                  onClick={() => router.push('/login')}
                  className="px-7 py-3.5 bg-transparent hover:bg-white rounded-xl text-body-sm font-semibold text-white hover:text-accent-600 border-2 border-white/40 hover:border-white transition-all"
                >
                  Sign in
                </button>
              </div>
              <p className="text-caption text-accent-200 mt-4">Free forever for small communities. No credit card needed.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white pt-16 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-accent-600 p-1.5 rounded-lg text-white">
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-body font-bold font-display text-gray-900">
                  Omni<span className="text-accent-600">Home</span>
                </span>
              </div>
              <p className="text-caption text-gray-700 leading-relaxed max-w-xs">
                The premium platform for residential community management. Purpose-built for apartment complexes, HOAs, and gated communities.
              </p>
            </div>

            {[
              { title: 'Product', links: ['Features', 'Pricing', 'FAQ', 'Changelog'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Legal', links: ['Privacy policy', 'Terms of service', 'Cookie policy', 'GDPR'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-caption-xs font-semibold text-gray-700 mb-4 uppercase tracking-widest">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button className="text-caption text-gray-700 hover:text-accent-600 transition-colors">
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-caption text-gray-700">
              &copy; {new Date().getFullYear()} OmniHome. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
