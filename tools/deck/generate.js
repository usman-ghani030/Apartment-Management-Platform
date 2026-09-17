// OmniHome Project Presentation Generator
// pptxgenjs build script. Office-safe fonts (Calibri). Layout: 13.333 x 7.5 wide.
const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'OmniHome';
pres.title = 'OmniHome  -  Residential Community Management';

// ── Constants ────────────────────────────────────────────────────────────
const W = 13.333, H = 7.5;
const ML = 0.62, MR = 0.62, CW = W - ML - MR;   // content width
const F = 'Calibri';
const ACC = '2563EB', ACC_LT = 'EFF6FF', ACC_DK = '1D4ED8';
const INK = '1C1917', SUB = '57534E', MUTED = 'A8A29E', BORDER = 'E7E5E4';
const BG = 'FFFFFF', ALT = 'FAF9F8', TINT = 'EFF6FF';
const SUCCESS = '10B981';
const ICONS = path.join(__dirname, 'assets', 'icons');

// ── Helpers ──────────────────────────────────────────────────────────────
function shd() { return { type: 'outer', blur: 4, offset: 1, angle: 90, color: '000000', opacity: 0.04 }; }

function header(s, eyebrow, title, sub) {
  if (eyebrow) s.addText(eyebrow.toUpperCase(), { x: ML, y: 0.42, w: CW, h: 0.22, fontSize: 10, fontFace: F, color: ACC, bold: true, charSpacing: 3 });
  s.addText(title, { x: ML, y: 0.66, w: CW, h: 0.56, fontSize: 28, fontFace: F, color: INK, bold: true });
  if (sub) s.addText(sub, { x: ML, y: 1.22, w: CW, h: 0.42, fontSize: 12.5, fontFace: F, color: SUB });
}

function foot(s, n) {
  s.addText('OmniHome', { x: ML, y: 7.05, w: 2, h: 0.3, fontSize: 8, fontFace: F, color: MUTED });
  s.addText(String(n), { x: W - MR - 1, y: 7.05, w: 1, h: 0.3, fontSize: 8, fontFace: F, color: MUTED, align: 'right' });
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    rectRadius: 0.08, x, y, w, h,
    fill: { color: opts.fill || BG },
    line: { color: opts.border || BORDER, width: opts.lw || 0.75 },
    shadow: shd(),
  });
}

function oval(s, x, y, sz, fill) {
  s.addShape(pres.shapes.OVAL, { x, y, w: sz, h: sz, fill: { color: fill || TINT } });
}

function ico(s, name, x, y, sz) {
  const p = path.join(ICONS, `ic-${name}.png`);
  if (fs.existsSync(p)) s.addImage({ path: p, x, y, w: sz, h: sz });
}

function brand(s, name, x, y, w, h) {
  const p = path.join(ICONS, `${name}.png`);
  if (fs.existsSync(p)) s.addImage({ path: p, x, y, w, h });
}

function arrow(s, x1, y1, x2, y2, opts = {}) {
  s.addShape(pres.shapes.LINE, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color: opts.color || MUTED, width: opts.lw || 1.25, endArrowType: opts.arrow || 'triangle' },
  });
}

function label(s, txt, x, y, w, opts = {}) {
  s.addText(txt, { x, y, w, h: opts.h || 0.28, fontSize: opts.fs || 9, fontFace: F, color: opts.color || MUTED, italic: opts.italic !== false });
}

function notes(s, txt) { s.addNotes(txt); }

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1  -  Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  notes(s, 'OmniHome is a multi-tenant SaaS platform for residential society management. This deck walks through the problem it solves, what was built across Phases 0 through 9, and the technology behind it.');

  // eyebrow
  s.addText('PROJECT PRESENTATION', { x: 0.9, y: 0.45, w: 5, h: 0.22, fontSize: 10, fontFace: F, color: ACC, bold: true, charSpacing: 3 });

  // logo mark (small, left-aligned)
  brand(s, 'omnihome-logo', 0.9, 0.88, 0.72, 0.65);

  // wordmark
  s.addText('OmniHome', { x: 1.8, y: 0.86, w: 5.5, h: 0.78, fontSize: 46, fontFace: F, color: INK, bold: true, valign: 'bottom' });

  // one-liner
  s.addText('Residential community management for apartment societies. Notices, maintenance, dues, bookings, visitors, and voting in one platform, with an isolated workspace per society.', {
    x: 0.9, y: 1.72, w: 6.4, h: 0.9, fontSize: 14, fontFace: F, color: SUB, lineSpacingMultiple: 1.3, valign: 'top',
  });

  // meta line
  s.addText('Phases 0 through 9 complete  ·  Live on Vercel and Render  ·  Free for societies up to 15 units', {
    x: 0.9, y: 2.78, w: 6.4, h: 0.32, fontSize: 10.5, fontFace: F, color: MUTED,
  });

  // Right panel: role cards
  card(s, 8.1, 0.72, 4.4, 5.95, { fill: TINT, border: 'D6E4FA' });
  s.addText('Three role-based views, one shared record', { x: 8.3, y: 0.92, w: 4.0, h: 0.28, fontSize: 10, fontFace: F, color: ACC_DK, bold: true });

  const roles = [
    { title: 'Committee admin', desc: 'Runs the society: posts notices, assigns tickets, collects dues, sees everything.', icon: 'clipboard-check', y: 1.35 },
    { title: 'Resident', desc: 'Raises tickets with photos, pays dues, books amenities, votes in polls.', icon: 'megaphone', y: 3.15 },
    { title: 'Security guard', desc: 'Scans QR visitor passes at the gate, logs check-in and check-out.', icon: 'shield-check', y: 4.95 },
  ];
  for (const r of roles) {
    card(s, 8.35, r.y, 3.9, 1.55, { fill: BG });
    oval(s, 8.55, r.y + 0.18, 0.42, TINT);
    ico(s, r.icon, 8.63, r.y + 0.26, 0.26);
    s.addText(r.title, { x: 9.15, y: r.y + 0.16, w: 2.9, h: 0.3, fontSize: 13, fontFace: F, color: INK, bold: true });
    s.addText(r.desc, { x: 9.15, y: r.y + 0.5, w: 2.9, h: 0.85, fontSize: 11, fontFace: F, color: SUB, lineSpacingMultiple: 1.25 });
  }

  // subtle bottom divider line in the panel
  s.addShape(pres.shapes.LINE, { x: 8.5, y: 6.35, w: 3.8, h: 0, line: { color: 'D6E4FA', width: 0.75 } });
  s.addText('Admin manages  ·  Resident uses  ·  Guard verifies', { x: 8.35, y: 6.42, w: 3.9, h: 0.22, fontSize: 9, fontFace: F, color: MUTED, align: 'center' });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2  -  The Problem
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, 'The problem', 'Societies run on WhatsApp, paper, and memory', 'How apartment committees actually operate today.');
  foot(s, 2);
  notes(s, 'The plan starts from how societies actually run: WhatsApp for announcements, a paper gate register, a spreadsheet for dues. Each of these works alone and fails together. The five consequences below come directly from the original problem statement.');

  // Lead-in card (left)
  card(s, ML, 1.82, 4.35, 1.55, { fill: ALT });
  s.addText([
    { text: 'One WhatsApp group carries every announcement.', options: { fontSize: 12.5, fontFace: F, color: INK, bold: true, breakLine: true, paraSpaceAfter: 6 } },
    { text: 'A paper register sits at the gate. The treasurer tracks dues in a spreadsheet that only makes sense to the treasurer.', options: { fontSize: 11.5, fontFace: F, color: SUB } },
  ], { x: ML + 0.12, y: 1.95, w: 4.1, h: 1.3, valign: 'top' });

  // Five consequence rows (right)
  const cons = [
    { lead: 'Notices get buried.', desc: 'An announcement posted at 2pm is unread by evening, lost under a hundred chat messages.', icon: 'megaphone' },
    { lead: 'Maintenance has no owner.', desc: 'A complaint raised verbally has no status, no history, and no one accountable.', icon: 'wrench' },
    { lead: 'The gate runs on handwriting.', desc: 'Entry logs are incomplete, and verifying a visitor slows the line.', icon: 'shield-check' },
    { lead: 'Payments invite disputes.', desc: 'Residents and the committee keep different records of what was paid and when.', icon: 'credit-card' },
    { lead: 'Records leave with the committee.', desc: 'When members rotate, minutes and financial history go with them.', icon: 'scroll-text' },
  ];
  const ry0 = 1.88, rh = 0.88, gap = 0.12;
  cons.forEach((c, i) => {
    const y = ry0 + i * (rh + gap);
    oval(s, 5.2, y + 0.14, 0.42, TINT);
    ico(s, c.icon, 5.28, y + 0.22, 0.26);
    s.addText(c.lead, { x: 5.8, y: y + 0.06, w: 6.6, h: 0.26, fontSize: 12, fontFace: F, color: INK, bold: true });
    s.addText(c.desc, { x: 5.8, y: y + 0.36, w: 6.6, h: 0.42, fontSize: 11, fontFace: F, color: SUB, lineSpacingMultiple: 1.2 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3  -  The Solution
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, 'The solution', 'One workspace per society, three role-based views', 'Everything a committee already does, moved onto a shared record with clear roles.');
  foot(s, 3);
  notes(s, 'Each mapping below comes from the real feature set: published notices replace WhatsApp blasts, invoices replace spreadsheet dues, QR visitor passes replace the paper register, and tickets replace verbal complaints.');

  const maps = [
    { icon: 'megaphone', was: 'A WhatsApp blast nobody can search', now: 'Published notices with read receipts and unit-level targeting' },
    { icon: 'credit-card', was: 'Dues tracked in a private spreadsheet', now: 'Invoices with online payment, reminders, and shared history' },
    { icon: 'scan-line', was: 'A paper register at the gate', now: 'QR visitor passes scanned and time-stamped at the gate' },
    { icon: 'wrench', was: 'Complaints raised verbally in passing', now: 'Tickets with photos, an assignee, and a visible status' },
  ];
  const cw2 = (CW - 0.25) / 2, ch = 1.78, cgap = 0.22;
  maps.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = ML + col * (cw2 + 0.25);
    const y = 1.82 + row * (ch + cgap);
    card(s, x, y, cw2, ch);
    oval(s, x + 0.14, y + 0.14, 0.4, TINT);
    ico(s, m.icon, x + 0.21, y + 0.21, 0.26);
    // "was" label
    s.addText(m.was, { x: x + 0.66, y: y + 0.14, w: cw2 - 0.84, h: 0.32, fontSize: 11, fontFace: F, color: MUTED, italic: true });
    // arrow
    s.addText('→', { x: x + 0.66, y: y + 0.54, w: 0.3, h: 0.32, fontSize: 16, fontFace: F, color: ACC, bold: true });
    // "now" label
    s.addText(m.now, { x: x + 0.66, y: y + 0.88, w: cw2 - 0.84, h: 0.7, fontSize: 12, fontFace: F, color: INK, bold: true, lineSpacingMultiple: 1.2, valign: 'top' });
  });

  // Bottom note
  s.addText('Admins, residents, and guards each see what their role needs, backed by the same data.', {
    x: ML, y: 5.9, w: CW, h: 0.32, fontSize: 11.5, fontFace: F, color: SUB, italic: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4  -  What's Built
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, "What's built", 'What ships today', null);
  foot(s, 4);
  notes(s, 'A quick inventory of what shipped across Phases 0 through 9, grouped by the daily problem each module solves.');

  const groups = [
    { title: 'Communication', icon: 'megaphone', items: ['Notices with drafts, read receipts, and unit-level targeting', 'Resident directory with unit and contact detail', 'Document folders for bylaws and meeting minutes'] },
    { title: 'Operations', icon: 'wrench', items: ['Maintenance tickets with photos, comments, and status lifecycle', 'Amenity bookings with conflict prevention and rules', 'Parcels logged on arrival, collected with a tap', 'QR visitor passes with gate check-in and check-out'] },
    { title: 'Money', icon: 'credit-card', items: ['Invoices per unit with online Safepay checkout', 'Automated reminders before due dates', 'Recurring monthly billing on a configurable schedule', 'Dispute flags with admin resolution'] },
    { title: 'Governance & safety', icon: 'shield-check', items: ['Polls with one vote per unit enforced in the schema', 'SOS alerts that reach admins and guards instantly', 'Staff directory with on-duty visibility', 'Transfer clearance that blocks on unpaid dues'] },
  ];
  const gcw = (CW - 0.24) / 2, gch = 2.28, ggap = 0.22;
  groups.forEach((g, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = ML + col * (gcw + 0.24);
    const y = 1.66 + row * (gch + ggap);
    card(s, x, y, gcw, gch);
    oval(s, x + 0.14, y + 0.14, 0.4, TINT);
    ico(s, g.icon, x + 0.21, y + 0.21, 0.26);
    s.addText(g.title, { x: x + 0.66, y: y + 0.14, w: gcw - 0.85, h: 0.3, fontSize: 13, fontFace: F, color: INK, bold: true });
    g.items.forEach((item, j) => {
      s.addText('·  ' + item, { x: x + 0.22, y: y + 0.58 + j * 0.38, w: gcw - 0.44, h: 0.36, fontSize: 11, fontFace: F, color: SUB, lineSpacingMultiple: 1.15, valign: 'top' });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5  -  Tech Stack
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, 'Tech stack', 'Mainstream parts, chosen for boring reliability', 'Every layer uses widely documented, widely hired-for technology.');
  foot(s, 5);
  notes(s, 'The backend is Express on Node.js with TypeScript. The database is PostgreSQL with Prisma ORM. Redis handles BullMQ job queues. Payments go through Safepay behind a provider interface. Email is Nodemailer over Gmail SMTP. Deployed on Vercel and Render.');

  const layers = [
    { label: 'FRONTEND', items: [{ slug: 'nextjs', name: 'Next.js' }, { slug: 'typescript', name: 'TypeScript' }, { slug: 'tailwindcss', name: 'Tailwind CSS' }] },
    { label: 'BACKEND', items: [{ slug: 'nodedotjs', name: 'Node.js' }, { slug: 'express', name: 'Express' }] },
    { label: 'DATA & JOBS', items: [{ slug: 'postgresql', name: 'PostgreSQL' }, { slug: 'prisma', name: 'Prisma' }, { slug: 'redis', name: 'Redis' }, { slug: null, name: 'BullMQ' }] },
    { label: 'SERVICES', items: [{ slug: 'safepay', name: 'Safepay' }, { slug: 'cloudinary', name: 'Cloudinary' }, { slug: 'google', name: 'Google sign-in' }, { slug: 'gmail', name: 'Gmail SMTP' }] },
    { label: 'HOSTING', items: [{ slug: 'vercel', name: 'Vercel' }, { slug: 'render', name: 'Render' }] },
  ];
  const lw = (CW - 0.2) / 5, lh = 3.7, ly = 1.82;
  layers.forEach((layer, i) => {
    const lx = ML + i * (lw + 0.04);
    card(s, lx, ly, lw, lh, { fill: ALT });
    s.addText(layer.label, { x: lx + 0.1, y: ly + 0.12, w: lw - 0.2, h: 0.24, fontSize: 9, fontFace: F, color: ACC, bold: true, charSpacing: 2 });
    layer.items.forEach((item, j) => {
      const iy = ly + 0.5 + j * 0.68;
      if (item.slug) {
        brand(s, item.slug, lx + (lw - 0.42) / 2, iy, 0.42, 0.38);
      } else {
        // text-only chip for items without logos
        oval(s, lx + (lw - 0.42) / 2, iy, 0.42, TINT);
        s.addText(item.name.charAt(0), { x: lx + (lw - 0.42) / 2, y: iy, w: 0.42, h: 0.42, fontSize: 14, fontFace: F, color: ACC, bold: true, align: 'center', valign: 'middle' });
      }
      s.addText(item.name, { x: lx + 0.06, y: iy + 0.44, w: lw - 0.12, h: 0.22, fontSize: 10, fontFace: F, color: SUB, align: 'center' });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6  -  Architecture
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, 'Architecture', 'How the pieces connect', null);
  foot(s, 6);
  notes(s, 'A simplified request path: the browser talks to Express over HTTPS with JWT in HTTP-only cookies. Every request passes Zod validation, a permission check, tenant-scoped database access, and an audit log write before a response goes out.');

  // Boxes
  // 1. Browser
  card(s, 0.62, 2.0, 3.15, 1.85, { fill: BG });
  s.addText([
    { text: 'Next.js frontend', options: { fontSize: 13, fontFace: F, color: INK, bold: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Admin, resident, and guard views', options: { fontSize: 10.5, fontFace: F, color: SUB, breakLine: true, paraSpaceAfter: 3 } },
    { text: 'Deployed on Vercel', options: { fontSize: 10, fontFace: F, color: MUTED } },
  ], { x: 0.78, y: 2.15, w: 2.8, h: 1.55, valign: 'top', margin: 0 });

  // 2. API (center, tinted)
  card(s, 4.45, 1.85, 3.55, 2.8, { fill: TINT, border: ACC });
  s.addText([
    { text: 'Express API', options: { fontSize: 14, fontFace: F, color: INK, bold: true, breakLine: true, paraSpaceAfter: 2 } },
    { text: 'Deployed on Render', options: { fontSize: 10, fontFace: F, color: SUB, breakLine: true, paraSpaceAfter: 8 } },
    { text: 'Zod validation', options: { fontSize: 10, fontFace: F, color: SUB, breakLine: true, paraSpaceAfter: 3 } },
    { text: 'can() permission check', options: { fontSize: 10, fontFace: F, color: SUB, breakLine: true, paraSpaceAfter: 3 } },
    { text: 'Tenant-scoped query', options: { fontSize: 10, fontFace: F, color: SUB, breakLine: true, paraSpaceAfter: 3 } },
    { text: 'Audit log entry', options: { fontSize: 10, fontFace: F, color: SUB } },
  ], { x: 4.6, y: 1.98, w: 3.25, h: 2.55, valign: 'top', margin: 0 });

  // 3. DB
  card(s, 8.65, 1.95, 3.7, 1.35, { fill: BG });
  s.addText([
    { text: 'PostgreSQL via Prisma', options: { fontSize: 12.5, fontFace: F, color: INK, bold: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'societyId on every table, soft deletes', options: { fontSize: 10.5, fontFace: F, color: SUB } },
  ], { x: 8.8, y: 2.08, w: 3.4, h: 1.1, valign: 'top', margin: 0 });

  // 4. Redis
  card(s, 8.65, 3.55, 3.7, 1.25, { fill: BG });
  s.addText([
    { text: 'Redis + BullMQ', options: { fontSize: 12.5, fontFace: F, color: INK, bold: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Dues reminders, recurring billing, platform billing, overdue checks', options: { fontSize: 10, fontFace: F, color: SUB } },
  ], { x: 8.8, y: 3.66, w: 3.4, h: 1.02, valign: 'top', margin: 0 });

  // 5. Services
  card(s, 4.45, 5.05, 7.9, 1.15, { fill: BG });
  s.addText([
    { text: 'Third-party services', options: { fontSize: 12, fontFace: F, color: INK, bold: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: 'Safepay hosted checkout and webhook   ·   Gmail SMTP notifications   ·   Google sign-in', options: { fontSize: 10.5, fontFace: F, color: SUB } },
  ], { x: 4.6, y: 5.14, w: 7.6, h: 0.95, valign: 'top', margin: 0 });

  // Arrows
  // Browser → API
  arrow(s, 3.77, 2.92, 4.45, 2.92);
  label(s, 'JWT in HTTP-only cookies', 3.7, 2.52, 1.85);

  // API → DB
  arrow(s, 8.0, 2.62, 8.65, 2.62);
  label(s, 'Prisma, societyId scoping', 7.7, 2.2, 1.8);

  // API → Redis (vertical down)
  arrow(s, 6.22, 4.65, 6.22, 5.05, { arrow: 'triangle' });
  label(s, 'Scheduled jobs', 6.5, 4.65, 1.1);

  // Services → API (webhook up)
  arrow(s, 5.8, 5.05, 5.8, 4.65, { arrow: 'triangle' });
  label(s, 'Safepay webhook', 6.1, 4.82, 1.2);

  // Bottom annotation
  s.addText('Nothing reads the database except the API, and every write passes the same four gates.', {
    x: ML, y: 6.45, w: CW, h: 0.3, fontSize: 10.5, fontFace: F, color: SUB, italic: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7  -  What Makes It Different
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, 'What makes it different', 'Beyond a basic CRUD app', null);
  foot(s, 7);
  notes(s, 'Four things that push this past a basic CRUD app: structural tenant isolation, an audit trail as infrastructure, vendor ratings tied to ticket outcomes, and soft-deleted records that preserve history.');

  const diffs = [
    { title: 'Tenant isolation is structural', desc: 'Reads and writes go through one tenant-scoped repository layer. Cross-society access is not a missing WHERE clause waiting to happen.', icon: 'layers' },
    { title: 'Audit trail is infrastructure', desc: 'Every create, update, and status change records who, what, before, and after. Searchable in the admin UI, exportable at handover.', icon: 'clipboard-check' },
    { title: 'Vendors are rated on outcomes', desc: 'Closing a ticket captures a 1 to 5 rating with a comment. Average ratings appear when the next ticket is assigned. Vendors update work through revocable magic links, no accounts.', icon: 'star' },
    { title: 'History is never destroyed', desc: 'Records are soft deleted. Anything behind an audit entry or a financial record cannot silently vanish.', icon: 'database' },
  ];
  const dw = (CW - 0.24) / 2, dh = 2.3, dgap = 0.22;
  diffs.forEach((d, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = ML + col * (dw + 0.24);
    const y = 1.66 + row * (dh + dgap);
    card(s, x, y, dw, dh);
    oval(s, x + 0.14, y + 0.14, 0.42, TINT);
    ico(s, d.icon, x + 0.21, y + 0.21, 0.26);
    s.addText(d.title, { x: x + 0.68, y: y + 0.15, w: dw - 0.88, h: 0.3, fontSize: 13.5, fontFace: F, color: INK, bold: true });
    s.addText(d.desc, { x: x + 0.2, y: y + 0.62, w: dw - 0.4, h: 1.5, fontSize: 11.5, fontFace: F, color: SUB, lineSpacingMultiple: 1.3, valign: 'top' });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8  -  Security & Data Handling
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, 'Security & data handling', 'Decisions made once, enforced everywhere', null);
  foot(s, 8);
  notes(s, 'Security decisions made once and enforced everywhere: five roles with one permission gate, hashed tokens at rest, Zod validation at every boundary, and Google sign-in verified server side.');

  const secs = [
    { title: 'One permission gate', desc: 'Every route asks can(user, action, resource). Role rules live in one helper, never scattered through handlers.', icon: 'fingerprint' },
    { title: 'Sessions that can be revoked', desc: 'JWT access and refresh tokens in HTTP-only cookies. A password reset bumps the token version and kills every other session.', icon: 'lock' },
    { title: 'Secrets stored as hashes', desc: 'Reset and vendor tokens are 256-bit random values stored only as SHA-256 hashes. Single use for resets, revocable for vendors, rate limited at the boundary.', icon: 'key-round' },
    { title: 'Input validated at the boundary', desc: 'Every request body passes a Zod schema before business logic runs. Limits mirror in the UI, but the server is the source of truth.', icon: 'badge-check' },
    { title: 'Third-party identity verified server side', desc: 'Google sign-in verifies the ID token with Google\'s own library, then issues the app\'s own session. Google\'s token never becomes the session.', icon: 'shield-check' },
  ];
  const sw = (CW - 0.2) / 2, sh = 1.6, sgap = 0.16;
  secs.forEach((item, i) => {
    const col = i < 3 ? 0 : 1, row = i < 3 ? i : i - 3;
    const x = ML + col * (sw + 0.2);
    const y = 1.66 + row * (sh + sgap);
    card(s, x, y, sw, sh);
    oval(s, x + 0.12, y + 0.12, 0.38, TINT);
    ico(s, item.icon, x + 0.18, y + 0.18, 0.24);
    s.addText(item.title, { x: x + 0.62, y: y + 0.12, w: sw - 0.8, h: 0.28, fontSize: 12.5, fontFace: F, color: INK, bold: true });
    s.addText(item.desc, { x: x + 0.16, y: y + 0.5, w: sw - 0.32, h: 1.0, fontSize: 11, fontFace: F, color: SUB, lineSpacingMultiple: 1.25, valign: 'top' });
  });

  // Callout card (bottom-right)
  card(s, ML + sw + 0.2, 1.66 + 2 * (sh + sgap), sw, 1.3, { fill: TINT, border: ACC });
  s.addText([
    { text: 'From the project plan:', options: { fontSize: 10, fontFace: F, color: ACC, bold: true, breakLine: true, paraSpaceAfter: 4 } },
    { text: '"Cross-tenant data access is a critical bug, not a feature request."', options: { fontSize: 12, fontFace: F, color: INK, italic: true } },
  ], { x: ML + sw + 0.36, y: 1.66 + 2 * (sh + sgap) + 0.12, w: sw - 0.32, h: 1.06, valign: 'top', margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9  -  Status & What's Next
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  header(s, 'Current status', 'Phases 0 through 9 built, tested, deployed', null);
  foot(s, 9);
  notes(s, 'Phases 0 through 9 are complete, each shipped with automated tests and a manual test guide before the next started. Phase 10, the AI layer, is the next major piece of work.');

  // Phase checklist (left, 2 columns)
  const phases = [
    'Phase 0  -  Foundation',
    'Phase 1  -  Core MVP',
    'Phase 2  -  Money',
    'Phase 3  -  Bookings',
    'Phase 4  -  Visitors & gate',
    'Phase 5  -  Governance',
    'Phase 6  -  Documents & audit',
    'Phase 7  -  Engagement & accountability',
    'Phase 8  -  Safety, staff & billing',
    'Phase 9  -  Platform billing',
  ];
  const pw = (CW - 4.9 - 0.25) / 2, ph = 0.36, pgap = 0.08;
  phases.forEach((p, i) => {
    const col = i < 5 ? 0 : 1, row = i < 5 ? i : i - 5;
    const x = ML + col * (pw + 0.1);
    const y = 1.68 + row * (ph + pgap);
    ico(s, 'badge-check', x, y + 0.02, 0.26);
    s.addText(p, { x: x + 0.36, y: y, w: pw - 0.36, h: ph, fontSize: 11, fontFace: F, color: INK, valign: 'middle' });
  });

  // "Each phase shipped..." note
  s.addText('Each phase shipped end to end: schema, API, UI, tests, and a manual test guide before the next started.', {
    x: ML, y: 4.0, w: CW - 4.9 - 0.25, h: 0.55, fontSize: 10.5, fontFace: F, color: SUB, lineSpacingMultiple: 1.2,
  });

  // What's next card (right)
  card(s, ML + CW - 4.7, 1.66, 4.7, 3.7, { fill: TINT, border: ACC });
  s.addText("What's next", { x: ML + CW - 4.55, y: 1.82, w: 4.4, h: 0.28, fontSize: 13, fontFace: F, color: ACC_DK, bold: true });
  const nextItems = [
    'Phase 10: the AI layer',
    'Separate FastAPI service',
    'pgvector for semantic search over tickets and documents',
    'Vendor assignment suggestions',
    'Anomaly detection on payments and maintenance costs',
  ];
  nextItems.forEach((item, i) => {
    s.addText('·  ' + item, { x: ML + CW - 4.55, y: 2.22 + i * 0.38, w: 4.4, h: 0.36, fontSize: 11, fontFace: F, color: SUB });
  });

  // Open items (right card, lower)
  card(s, ML + CW - 4.7, 4.15, 4.7, 1.45, { fill: BG });
  s.addText('Also open', { x: ML + CW - 4.55, y: 4.28, w: 4.4, h: 0.26, fontSize: 11, fontFace: F, color: INK, bold: true });
  const openItems = [
    'Cloudinary swap for local file storage',
    'Redis-backed rate limiting (in-memory today)',
    'Native mobile app (responsive web now)',
  ];
  openItems.forEach((item, i) => {
    s.addText('·  ' + item, { x: ML + CW - 4.55, y: 4.62 + i * 0.3, w: 4.4, h: 0.28, fontSize: 10.5, fontFace: F, color: SUB });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10  -  Closing
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  notes(s, 'A clean close with the key facts: one workspace per society, live demo available, free for up to 15 units.');

  // full-bleed accent background
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: ACC } });

  // subtle decorative elements
  s.addShape(pres.shapes.OVAL, { x: -1.5, y: -1.2, w: 4.5, h: 4.5, fill: { color: ACC_DK, transparency: 70 } });
  s.addShape(pres.shapes.OVAL, { x: 10.5, y: 4.5, w: 4, h: 4, fill: { color: ACC_DK, transparency: 70 } });

  // wordmark
  s.addText('OmniHome', { x: 0.9, y: 2.0, w: 7, h: 1.0, fontSize: 48, fontFace: F, color: BG, bold: true });

  // tagline
  s.addText('One workspace per society.', { x: 0.9, y: 3.1, w: 7, h: 0.5, fontSize: 19, fontFace: F, color: 'FFFFFF', lineSpacingMultiple: 1.15 });

  // demo note
  s.addText('Live demo runs on a seeded society with committee, resident, and guard accounts.', {
    x: 0.9, y: 4.05, w: 7, h: 0.35, fontSize: 12.5, fontFace: F, color: 'FFFFFF', transparency: 15,
  });

  // pricing note
  s.addText('Free for up to 15 units, every feature included, no card required.', {
    x: 0.9, y: 4.5, w: 7, h: 0.35, fontSize: 12.5, fontFace: F, color: 'FFFFFF', transparency: 15,
  });

  // bottom tech line
  s.addText('Next.js  ·  Express  ·  PostgreSQL  ·  Prisma  ·  Redis  ·  Safepay', {
    x: 0.9, y: 6.2, w: 7, h: 0.28, fontSize: 10, fontFace: F, color: 'FFFFFF', transparency: 35,
  });

  // closing line
  s.addText('Questions welcome.', { x: 0.9, y: 6.6, w: 7, h: 0.35, fontSize: 13, fontFace: F, color: 'FFFFFF', transparency: 20 });
}

// ── Write file ───────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', '..', 'OmniHome-Presentation.pptx');
pres.writeFile({ fileName: outPath })
  .then(() => console.log('Wrote', outPath))
  .catch(e => { console.error('FAILED:', e); process.exit(1); });
