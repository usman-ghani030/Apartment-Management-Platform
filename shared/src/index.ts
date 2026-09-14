import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMMITTEE_ADMIN: 'COMMITTEE_ADMIN',
  RESIDENT: 'RESIDENT',
  SECURITY_GUARD: 'SECURITY_GUARD',
  VENDOR: 'VENDOR',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const MembershipStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;

export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const UnitType = {
  OWNER_OCCUPIED: 'OWNER_OCCUPIED',
  RENTED: 'RENTED',
  VACANT: 'VACANT',
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const BedroomType = {
  STUDIO: 'STUDIO',
  ONE_BED: 'ONE_BED',
  TWO_BED: 'TWO_BED',
  THREE_BED: 'THREE_BED',
  FOUR_BED: 'FOUR_BED',
  FOUR_PLUS_BED: 'FOUR_PLUS_BED',
} as const;

export type BedroomType = (typeof BedroomType)[keyof typeof BedroomType];

export const BedroomTypeValues = Object.values(BedroomType);

export const BEDROOM_TYPE_LABELS: Record<BedroomType, string> = {
  STUDIO: 'Studio',
  ONE_BED: '1 Bedroom',
  TWO_BED: '2 Bedrooms',
  THREE_BED: '3 Bedrooms',
  FOUR_BED: '4 Bedrooms',
  FOUR_PLUS_BED: '4+ Bedrooms',
};

// ── Staff Types (Phase 8) ─────────────────────────────────────────────────
export const StaffRole = {
  GUARD: 'GUARD',
  CLEANER: 'CLEANER',
  MAINTENANCE: 'MAINTENANCE',
  OTHER: 'OTHER',
} as const;

export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole];

export const StaffRoleValues = Object.values(StaffRole);

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  GUARD: 'Guard',
  CLEANER: 'Cleaner',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Other',
};

export const CreateStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['GUARD', 'CLEANER', 'MAINTENANCE', 'OTHER']),
  email: z.string().email('Invalid email').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});
export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

export const UpdateStaffSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['GUARD', 'CLEANER', 'MAINTENANCE', 'OTHER']).optional(),
  email: z.string().email('Invalid email').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;

export interface StaffResponse {
  id: string;
  societyId: string;
  name: string;
  role: StaffRole;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── SOS Alert Types (Phase 8) ──────────────────────────────────────────────
export const SOSAlertStatus = {
  ACTIVE: 'ACTIVE',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
} as const;
export type SOSAlertStatus = (typeof SOSAlertStatus)[keyof typeof SOSAlertStatus];

export const SOSAlertCategory = {
  MEDICAL: 'MEDICAL',
  FIRE: 'FIRE',
  SECURITY: 'SECURITY',
  OTHER: 'OTHER',
} as const;
export type SOSAlertCategory = (typeof SOSAlertCategory)[keyof typeof SOSAlertCategory];

export const SOS_ALERT_CATEGORY_LABELS: Record<SOSAlertCategory, string> = {
  MEDICAL: 'Medical',
  FIRE: 'Fire',
  SECURITY: 'Security',
  OTHER: 'Other',
};

export const SOS_ALERT_STATUS_LABELS: Record<SOSAlertStatus, string> = {
  ACTIVE: 'Active',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVED: 'Resolved',
};

export const TriggerSOSSchema = z.object({
  category: z.enum(['MEDICAL', 'FIRE', 'SECURITY', 'OTHER']),
  unitId: z.string().uuid('Invalid unit ID'),
});
export type TriggerSOSInput = z.infer<typeof TriggerSOSSchema>;

export const ResolveSOSSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
  notes: z.string().max(500).optional(),
});
export type ResolveSOSInput = z.infer<typeof ResolveSOSSchema>;

export interface SOSAlertResponse {
  id: string;
  societyId: string;
  unitId: string;
  unitNumber: string;
  residentId: string;
  residentName: string;
  category: SOSAlertCategory;
  status: SOSAlertStatus;
  notes: string | null;
  resolvedByUserId: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Response Envelope ───────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
}

// ── Auth Schemas ────────────────────────────────────────────────────────────
export const SignupSchema = z.object({
  email: z.string().email('Invalid email address').max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be under 128 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  societyName: z.string().min(1, 'Society name is required').max(100, 'Society name must be under 100 characters'),
  societySlug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be under 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').max(200),
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const InviteResidentSchema = z.object({
  email: z.string().email('Invalid email address').max(200),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be under 100 characters'),
  unitId: z.string().uuid('Invalid unit ID').optional(),
  role: z.enum(['RESIDENT', 'SECURITY_GUARD', 'VENDOR']).default('RESIDENT'),
});

export type InviteResidentInput = z.infer<typeof InviteResidentSchema>;

// ── Google Sign-In ───────────────────────────────────────────────────────────
// `mode: 'signin'`  → log in / link an existing account (login page)
// `mode: 'signup'`  → tenant onboarding: create a new Society + first
//                     COMMITTEE_ADMIN from the signup page (requires society fields)
export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required').max(10000),
  mode: z.enum(['signin', 'signup']).default('signin'),
  // Required only when mode === 'signup' — same rules as SignupSchema
  societyName: z.string().min(1, 'Society name is required').max(100, 'Society name must be under 100 characters').optional(),
  societySlug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug must be under 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
});

export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;
export type GoogleAuthMode = GoogleAuthInput['mode'];

// Auth response for Google Sign-In — same shape as the login/signup responses
// (tokens included so the client can persist them). `linked` is true when an
// existing password-based account was just linked to the Google account
// (frontend shows a confirmation message in that case).
export interface GoogleAuthResponse extends AuthResponse {
  accessToken: string;
  refreshToken: string;
  linked?: boolean;
}

// ── Password Reset ───────────────────────────────────────────────────────────
// ForgotPasswordSchema: request a reset link by email. The endpoint ALWAYS
// returns the same generic response whether or not the email exists (prevents
// account enumeration) — see the auth route.
export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').max(200),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// ResetPasswordSchema: consume a single-use reset token and set a new password.
// Password rules mirror SignupSchema (8–128 chars).
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required').max(2000),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be under 128 characters'),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// ── Auth Response Types ─────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  name: string;
}

export interface MembershipProfile {
  id: string;
  societyId: string;
  societyName: string;
  societySlug: string;
  role: Role;
  unitId: string | null;
  status: MembershipStatus;
}

export interface AuthResponse {
  user: UserProfile;
  memberships: MembershipProfile[];
}

// ── Notice Schemas ───────────────────────────────────────────────────────────
export const CreateNoticeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content must be under 10,000 characters'),
  category: z.string().min(1, 'Category is required').max(100, 'Category must be under 100 characters').default('general'),
  publish: z.boolean().default(false), // If true, set publishedAt to now
  // Phase 8: targeted notifications
  targetType: z.enum(['ALL_UNITS', 'SPECIFIC_UNITS']).default('ALL_UNITS'),
  targetUnitIds: z.array(z.string().uuid()).optional().nullable(),
});
export type CreateNoticeInput = z.infer<typeof CreateNoticeSchema>;

export const UpdateNoticeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000, 'Content must be under 10,000 characters').optional(),
  category: z.string().min(1).max(100).optional(),
  publish: z.boolean().optional(),
  // Phase 8: targeted notifications
  targetType: z.enum(['ALL_UNITS', 'SPECIFIC_UNITS']).optional(),
  targetUnitIds: z.array(z.string().uuid()).optional().nullable(),
});
export type UpdateNoticeInput = z.infer<typeof UpdateNoticeSchema>;

export interface NoticeResponse {
  id: string;
  societyId: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  category: string;
  targetType: string;
  targetUnitIds: string[] | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readCount?: number;
  hasRead?: boolean;
}

// ── Ticket Status ────────────────────────────────────────────────────────────
export const TicketStatusValues = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TicketStatusValues)[number];

// ── Ticket Schemas ───────────────────────────────────────────────────────────
export const CreateTicketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().min(1, 'Description is required').max(5000, 'Description must be under 5,000 characters'),
  category: z.string().min(1).max(100).default('other'),
  unitId: z.string().uuid().optional(),
});
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;

export const UpdateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: z.string().min(1).max(100).optional(),
  status: z.enum(TicketStatusValues).optional(),
  assignedTo: z.string().max(100).optional().nullable(),
  // Vendor magic-link contact email. Supplied by the admin when assigning (or
  // reassigning) a ticket so the assignment email with the access link can be
  // sent. Optional — assigning without an email simply sends no link.
  vendorEmail: z.string().email('Must be a valid email').max(200).optional().nullable(),
  // Phase 7 vendor ratings: 1-5 stars + optional comment, captured when the
  // ticket transitions to CLOSED.
  rating: z.number().int().min(1).max(5).optional(),
  ratingComment: z.string().max(500).optional().nullable(),
});
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

export const AddCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000, 'Comment must be under 2,000 characters'),
});
export type AddCommentInput = z.infer<typeof AddCommentSchema>;

export interface TicketResponse {
  id: string;
  societyId: string;
  unitId: string | null;
  unitNumber: string | null;
  residentId: string;
  residentName: string;
  title: string;
  description: string;
  category: string;
  status: TicketStatus;
  assignedTo: string | null;
  /** Vendor contact email the magic link is sent to (admin-supplied). */
  vendorEmail: string | null;
  photosUrl: string | null;
  /**
   * Assignment-response hint: whether the vendor magic-link email went out.
   * Only set on the PATCH response that (re)assigned the ticket.
   */
  vendorLinkSent?: boolean;
  // Phase 7 vendor ratings
  rating: number | null;
  ratingComment: string | null;
  ratedById: string | null;
  ratedByName: string | null;
  ratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  comments?: TicketCommentResponse[];
}

/**
 * Aggregated vendor rating (Phase 7 slice 3). Grouped by the ticket's
 * assigned vendor name; avgRating is rounded to one decimal.
 */
export interface VendorRatingSummary {
  vendorName: string;
  avgRating: number;
  count: number;
}

export interface TicketCommentResponse {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ── Vendor Magic-Link Portal (public, token-secured) ─────────────────────────
// Vendors have no login accounts, so the token inside the emailed link is the
// only credential. A vendor may only push the ticket forward as far as RESOLVED
// — CLOSED is an admin action (it also captures the Phase 7 vendor rating).
export const VendorStatusUpdateValues = ['IN_PROGRESS', 'RESOLVED'] as const;
export type VendorStatusUpdate = (typeof VendorStatusUpdateValues)[number];

export const VendorStatusUpdateSchema = z.object({
  status: z.enum(VendorStatusUpdateValues),
});
export type VendorStatusUpdateInput = z.infer<typeof VendorStatusUpdateSchema>;

/**
 * The deliberately limited view of a single ticket a vendor may see through
 * their magic link: no resident name/email/phone, no financial data, no other
 * tickets, nothing admin-only.
 */
export interface VendorTicketView {
  /** Short human-readable reference (never the internal UUID). */
  ticketRef: string;
  societyName: string;
  vendorName: string;
  title: string;
  description: string;
  category: string;
  status: TicketStatus;
  unitNumber: string | null;
  /** Relative paths — the client prefixes them with the API base URL. */
  photos: string[];
  createdAt: string;
  updatedAt: string;
  /** The statuses this vendor is allowed to move the ticket to right now. */
  allowedTransitions: VendorStatusUpdate[];
}

// ── Amenity / Booking Types ──────────────────────────────────────────────────
export const BookingStatusValues = ['CONFIRMED', 'CANCELLED', 'COMPLETED'] as const;
export type BookingStatus = (typeof BookingStatusValues)[number];

export const CreateAmenitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  maxDuration: z.number().int().positive().default(120),
  advanceNotice: z.number().int().min(0).default(24),
  maxPerUnit: z.number().int().positive().default(2),
});
export type CreateAmenityInput = z.infer<typeof CreateAmenitySchema>;

export const UpdateAmenitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  maxDuration: z.number().int().positive().optional(),
  advanceNotice: z.number().int().min(0).optional(),
  maxPerUnit: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAmenityInput = z.infer<typeof UpdateAmenitySchema>;

export const CreateBookingSchema = z.object({
  amenityId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export interface AmenityResponse {
  id: string; societyId: string; name: string; description: string | null;
  maxDuration: number; advanceNotice: number; maxPerUnit: number;
  isActive: boolean; createdAt: string; updatedAt: string;
}

export interface BookingResponse {
  id: string; societyId: string; amenityId: string; amenityName: string;
  unitId: string; unitNumber: string; residentId: string; residentName: string;
  startTime: string; endTime: string; status: BookingStatus;
  createdAt: string; updatedAt: string;
}

// ── Invoice / Payment Types ──────────────────────────────────────────────────
export const InvoiceStatusValues = ['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED', 'DISPUTED'] as const;
export type InvoiceStatus = (typeof InvoiceStatusValues)[number];

export const CreateInvoiceSchema = z.object({
  unitId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().int().positive('Amount must be positive (in paisa — rupees × 100)'),
  dueDate: z.string().datetime(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  status: z.enum(InvoiceStatusValues).default('ISSUED'),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export const UpdateInvoiceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  amount: z.number().int().positive().optional(),
  dueDate: z.string().datetime().optional(),
  status: z.enum(InvoiceStatusValues).optional(),
});
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;

export const DisputeInvoiceSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});
export type DisputeInvoiceInput = z.infer<typeof DisputeInvoiceSchema>;

export interface InvoiceResponse {
  id: string;
  societyId: string;
  unitId: string;
  unitNumber: string;
  invoiceNumber: string;
  title: string;
  description: string | null;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  updatedAt: string;
  paidAmount?: number;
  paidAt?: string | null;
}

export interface PaymentResponse {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  provider?: string;
  providerSessionId?: string | null;
  providerTxnRef?: string | null;
}

// ── Visitor / Gate Log Types ──────────────────────────────────────────────────
export const VisitorPassStatusValues = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED'] as const;
export type VisitorPassStatus = (typeof VisitorPassStatusValues)[number];

export const CreateVisitorPassSchema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required').max(100),
  visitorPhone: z.string().min(1, 'Phone is required').max(30, 'Phone must be under 30 characters'),
  visitorEmail: z.string().email('Invalid email address').max(200).optional().or(z.literal('')),
  vehicleNumber: z.string().max(30).optional().or(z.literal('')),
  purpose: z.string().max(200).optional().or(z.literal('')),
  expectedArrival: z.string().datetime().optional(),
  expectedDeparture: z.string().datetime().optional(),
});
export type CreateVisitorPassInput = z.infer<typeof CreateVisitorPassSchema>;

export const UpdateVisitorPassSchema = z.object({
  visitorName: z.string().min(1).max(100).optional(),
  visitorPhone: z.string().min(1).max(30).optional(),
  visitorEmail: z.string().email('Invalid email address').max(200).optional().or(z.literal('')),
  vehicleNumber: z.string().max(30).optional().or(z.literal('')),
  purpose: z.string().max(200).optional().or(z.literal('')),
  expectedArrival: z.string().datetime().optional(),
  expectedDeparture: z.string().datetime().optional(),
  status: z.enum(VisitorPassStatusValues).optional(),
});
export type UpdateVisitorPassInput = z.infer<typeof UpdateVisitorPassSchema>;

export const GateLogActionValues = ['ENTRY', 'EXIT'] as const;
export type GateLogAction = (typeof GateLogActionValues)[number];

export interface VisitorPassResponse {
  id: string;
  societyId: string;
  unitId: string;
  unitNumber: string;
  residentId: string;
  residentName: string;
  visitorName: string;
  visitorPhone: string;
  visitorEmail: string | null;
  vehicleNumber: string | null;
  purpose: string | null;
  expectedArrival: string | null;
  expectedDeparture: string | null;
  status: VisitorPassStatus;
  qrToken: string;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GateLogResponse {
  id: string;
  societyId: string;
  visitorPassId: string;
  unitId: string | null;
  unitNumber: string | null;
  visitorName: string;
  action: GateLogAction;
  guardId: string | null;
  guardName: string | null;
  notes: string | null;
  createdAt: string;
}

// ── Poll / Vote Types ───────────────────────────────────────────────────────
export const PollStatusValues = ['DRAFT', 'ACTIVE', 'CLOSED'] as const;
export type PollStatus = (typeof PollStatusValues)[number];

export const ResultsVisibilityValues = ['LIVE', 'AFTER_CLOSE', 'NEVER'] as const;
export type ResultsVisibility = (typeof ResultsVisibilityValues)[number];

export interface PollOption {
  label: string;
  description?: string;
}

export const CreatePollSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  options: z.array(z.object({
    label: z.string().min(1, 'Option label is required').max(100, 'Option label must be under 100 characters'),
    description: z.string().max(300).optional().or(z.literal('')),
  })).min(2, 'At least 2 options required').max(10, 'Maximum 10 options allowed'),
  noticeId: z.string().uuid().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  resultsVisibility: z.enum(ResultsVisibilityValues).default('AFTER_CLOSE'),
});
export type CreatePollInput = z.infer<typeof CreatePollSchema>;

export const UpdatePollSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  options: z.array(z.object({
    label: z.string().min(1).max(100),
    description: z.string().max(300).optional().or(z.literal('')),
  })).min(2).max(10).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  resultsVisibility: z.enum(ResultsVisibilityValues).optional(),
  status: z.enum(PollStatusValues).optional(),
});
export type UpdatePollInput = z.infer<typeof UpdatePollSchema>;

export const CastVoteSchema = z.object({
  optionIndex: z.number().int().min(0, 'Invalid option'),
});
export type CastVoteInput = z.infer<typeof CastVoteSchema>;

export interface PollResponse {
  id: string;
  societyId: string;
  title: string;
  description: string | null;
  options: PollOption[];
  createdBy: string;
  noticeId: string | null;
  startsAt: string;
  endsAt: string;
  resultsVisibility: ResultsVisibility;
  status: PollStatus;
  createdAt: string;
  updatedAt: string;
  totalVotes?: number;
  myVote?: number | null; // optionIndex of current user's vote, if any
  results?: { optionIndex: number; count: number }[];
  hasVoted?: boolean;
}

// ── Document Types ──────────────────────────────────────────────────────────
export const CreateDocumentFolderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  parentId: z.string().uuid().optional().nullable(),
});
export type CreateDocumentFolderInput = z.infer<typeof CreateDocumentFolderSchema>;

export const UpdateDocumentFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().optional().nullable(),
});
export type UpdateDocumentFolderInput = z.infer<typeof UpdateDocumentFolderSchema>;

export const CreateDocumentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  folderId: z.string().uuid().optional().nullable(),
});
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

export const UpdateDocumentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
});
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

export interface DocumentFolderResponse {
  id: string;
  societyId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentResponse {
  id: string;
  societyId: string;
  folderId: string | null;
  folderName: string | null;
  name: string;
  description: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
  updatedAt: string;
}

// ── Audit Log Types ─────────────────────────────────────────────────────────
export interface AuditLogResponse {
  id: string;
  societyId: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
}

// ── Parcel Types ──────────────────────────────────────────────────────────────────
export const ParcelStatusValues = ['ARRIVED', 'COLLECTED'] as const;
export type ParcelStatus = (typeof ParcelStatusValues)[number];

export const CreateParcelSchema = z.object({
  unitId: z.string().uuid(),
  description: z.string().min(1, 'Description is required').max(500),
  photoUrl: z.string().optional().nullable(),
});
export type CreateParcelInput = z.infer<typeof CreateParcelSchema>;

export const UpdateParcelSchema = z.object({
  status: z.enum(ParcelStatusValues).optional(),
  description: z.string().min(1).max(500).optional(),
  photoUrl: z.string().optional().nullable(),
});
export type UpdateParcelInput = z.infer<typeof UpdateParcelSchema>;

export interface ParcelResponse {
  id: string;
  societyId: string;
  unitId: string;
  unitNumber: string;
  loggedByUserId: string;
  loggedByUserName: string;
  collectedByUserId: string | null;
  collectedByUserName: string | null;
  description: string;
  photoUrl: string | null;
  status: ParcelStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Recurring Billing Types (Phase 8) ───────────────────────────────────────
export const UpdateBillingSettingsSchema = z.object({
  billingDayOfMonth: z.number().int().min(1).max(28).nullable(),
});
export type UpdateBillingSettingsInput = z.infer<typeof UpdateBillingSettingsSchema>;

// ── CSV Import Types (Bulk Unit/Building Import) ─────────────────────────────
// CSV column headers map to these keys. The schema reuses the same validation
// rules as the manual unit creation form so the importer and the form always
// accept exactly the same data.
// Helper: convert empty string to undefined so optional/nullable works for CSV cells
const csvOptionalString = (max?: number) => {
  let schema = z.string().transform((v) => (v === '' ? undefined : v));
  if (max) schema = z.string().max(max).transform((v) => (v === '' ? undefined : v)) as any;
  return schema.optional().nullable();
};

export const CSVUnitRowSchema = z.object({
  'Building Name': z.string().min(1, 'Building Name is required').max(100, 'Building Name must be under 100 characters'),
  'Unit Number': z.string().min(1, 'Unit Number is required').max(20, 'Unit Number must be under 20 characters'),
  'Floor': z.coerce.number().int().min(0).max(500, 'Floor must be between 0 and 500').optional().default(0),
  'Bedroom Type': z.enum(['STUDIO', 'ONE_BED', 'TWO_BED', 'THREE_BED', 'FOUR_BED', 'FOUR_PLUS_BED'], {
    errorMap: () => ({ message: 'Bedroom Type must be one of: STUDIO, ONE_BED, TWO_BED, THREE_BED, FOUR_BED, FOUR_PLUS_BED' }),
  }),
  'Primary Contact Name': z.string().max(100).transform((v) => (v === '' ? undefined : v)).optional().nullable(),
  'Primary Contact Email': z.string().max(200).transform((v) => (v === '' ? undefined : v)).optional().nullable().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email address'),
  'Primary Contact Phone': z.string().max(30).transform((v) => (v === '' ? undefined : v)).optional().nullable(),
});
export type CSVUnitRow = z.infer<typeof CSVUnitRowSchema>;

export const CSV_IMPORT_MAX_ROWS = 1000;
export const CSV_IMPORT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const CSV_IMPORT_HEADERS = [
  'Building Name',
  'Unit Number',
  'Floor',
  'Bedroom Type',
  'Primary Contact Name',
  'Primary Contact Email',
  'Primary Contact Phone',
] as const;

// Response types for the two-step import flow
export interface CSVValidateResult {
  toCreate: CSVUnitRow[];
  toSkip: { row: number; buildingName: string; unitNumber: string; reason: string }[];
  errors: { row: number; reason: string }[];
  totalRows: number;
}

export interface CSVImportJobResult {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  created: number;
  skipped: number;
  errors: number;
  totalRows: number;
}

// ── Legacy ──────────────────────────────────────────────────────────────────
export const PingSchema = z.object({
  message: z.string(),
});

export type Ping = z.infer<typeof PingSchema>;

// ── Platform Billing (Phase 9, ADR 006) ─────────────────────────────────────
// Societies paying the PLATFORM. Entirely separate from the resident dues
// Invoice/Payment system above — different payer, different recipient.

export const PlatformInvoiceStatusValues = ['PENDING', 'PAID', 'OVERDUE'] as const;
export type PlatformInvoiceStatus = (typeof PlatformInvoiceStatusValues)[number];

/** One line of the progressive calculation stored on each invoice. */
export interface PlatformBandLine {
  label: string; // e.g. "Units 16–50"
  units: number;
  ratePerUnit: number;
  subtotal: number; // Rs
}

export interface PlatformInvoiceResponse {
  id: string;
  societyId: string;
  societyName: string;
  billingPeriod: string; // "YYYY-MM"
  unitCountSnapshot: number;
  breakdown: PlatformBandLine[]; // progressive calculation detail
  totalAmountRupees: number;
  totalAmountPaisa: number;
  dueDate: string;
  status: PlatformInvoiceStatus;
  generatedAt: string;
  paidAt: string | null;
  markedPaidBySuperAdminName: string | null;
}

export interface PlatformCustomQuoteFlagResponse {
  id: string;
  societyId: string;
  societyName: string;
  billingPeriod: string;
  unitCountSnapshot: number;
  note: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PlatformBillingRunResult {
  dryRun: boolean;
  scannedSocieties: number;
  created: number;
  skippedFree: number; // ≤15 units — no invoice (no zero-amount noise)
  skippedExisting: number; // idempotent skips
  customQuoteFlags: number; // 501+ units — flagged, not invoiced
  errors: string[];
}

export interface PlatformOverdueResult {
  scanned: number;
  markedOverdue: number;
  remindersSent: number;
  errors: string[];
}

export const MarkPlatformInvoicePaidSchema = z.object({
  note: z.string().max(500).optional(),
});
export type MarkPlatformInvoicePaidInput = z.infer<typeof MarkPlatformInvoicePaidSchema>;

/** Where a society stands today: unit count, free-tier flag, estimated fee. */
export interface PlatformBillingStatus {
  societyName: string;
  unitCount: number;
  freeUnitThreshold: number;
  autoInvoiceCap: number;
  isFreeTier: boolean;
  isCustomQuote: boolean;
  /** Progressive fee if billed right now (0 on the free tier). */
  estimatedTotalRupees: number;
  estimatedBreakdown: PlatformBandLine[];
}
