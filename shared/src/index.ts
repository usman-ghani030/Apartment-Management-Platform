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
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  societyName: z.string().min(1, 'Society name is required'),
  societySlug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const InviteResidentSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  unitId: z.string().uuid('Invalid unit ID').optional(),
  role: z.enum(['RESIDENT', 'SECURITY_GUARD', 'VENDOR']).default('RESIDENT'),
});

export type InviteResidentInput = z.infer<typeof InviteResidentSchema>;

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
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required').default('general'),
  publish: z.boolean().default(false), // If true, set publishedAt to now
});

export type CreateNoticeInput = z.infer<typeof CreateNoticeSchema>;

export const UpdateNoticeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  publish: z.boolean().optional(),
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
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1).default('other'),
  unitId: z.string().uuid().optional(),
});
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;

export const UpdateTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  status: z.enum(TicketStatusValues).optional(),
  assignedTo: z.string().optional().nullable(),
});
export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

export const AddCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty'),
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
  photosUrl: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  comments?: TicketCommentResponse[];
}

export interface TicketCommentResponse {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

// ── Amenity / Booking Types ──────────────────────────────────────────────────
export const BookingStatusValues = ['CONFIRMED', 'CANCELLED', 'COMPLETED'] as const;
export type BookingStatus = (typeof BookingStatusValues)[number];

export const CreateAmenitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  maxDuration: z.number().int().positive().default(120),
  advanceNotice: z.number().int().min(0).default(24),
  maxPerUnit: z.number().int().positive().default(2),
});
export type CreateAmenityInput = z.infer<typeof CreateAmenitySchema>;

export const UpdateAmenitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
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
  description: z.string().optional(),
  amount: z.number().int().positive('Amount must be positive (in cents)'),
  dueDate: z.string().datetime(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  status: z.enum(InvoiceStatusValues).default('ISSUED'),
});
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;

export const UpdateInvoiceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
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
}

// ── Visitor / Gate Log Types ──────────────────────────────────────────────────
export const VisitorPassStatusValues = ['PENDING', 'APPROVED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED'] as const;
export type VisitorPassStatus = (typeof VisitorPassStatusValues)[number];

export const CreateVisitorPassSchema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required').max(100),
  visitorPhone: z.string().min(1, 'Phone is required'),
  visitorEmail: z.string().email().optional().or(z.literal('')),
  vehicleNumber: z.string().optional().or(z.literal('')),
  purpose: z.string().optional().or(z.literal('')),
  expectedArrival: z.string().datetime().optional(),
  expectedDeparture: z.string().datetime().optional(),
});
export type CreateVisitorPassInput = z.infer<typeof CreateVisitorPassSchema>;

export const UpdateVisitorPassSchema = z.object({
  visitorName: z.string().min(1).max(100).optional(),
  visitorPhone: z.string().min(1).optional(),
  visitorEmail: z.string().email().optional().or(z.literal('')),
  vehicleNumber: z.string().optional().or(z.literal('')),
  purpose: z.string().optional().or(z.literal('')),
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
  description: z.string().optional().or(z.literal('')),
  options: z.array(z.object({
    label: z.string().min(1, 'Option label is required'),
    description: z.string().optional().or(z.literal('')),
  })).min(2, 'At least 2 options required').max(10, 'Maximum 10 options allowed'),
  noticeId: z.string().uuid().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  resultsVisibility: z.enum(ResultsVisibilityValues).default('AFTER_CLOSE'),
});
export type CreatePollInput = z.infer<typeof CreatePollSchema>;

export const UpdatePollSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().or(z.literal('')),
  options: z.array(z.object({
    label: z.string().min(1),
    description: z.string().optional().or(z.literal('')),
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
  description: z.string().optional().or(z.literal('')),
  folderId: z.string().uuid().optional().nullable(),
});
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

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

// ── Legacy ──────────────────────────────────────────────────────────────────
export const PingSchema = z.object({
  message: z.string(),
});

export type Ping = z.infer<typeof PingSchema>;
