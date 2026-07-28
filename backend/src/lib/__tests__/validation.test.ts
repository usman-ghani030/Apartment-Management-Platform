import { describe, it, expect } from 'vitest';
import {
  CreateNoticeSchema,
  UpdateNoticeSchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  AddCommentSchema,
  SignupSchema,
  LoginSchema,
  InviteResidentSchema,
} from '@apartment/shared';

describe('Notice validation schemas', () => {
  describe('CreateNoticeSchema', () => {
    it('should accept valid notice input', () => {
      const result = CreateNoticeSchema.safeParse({
        title: 'Test Notice',
        content: 'This is a test notice.',
        category: 'general',
        publish: false,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = CreateNoticeSchema.safeParse({
        title: '',
        content: 'Content',
        category: 'general',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty content', () => {
      const result = CreateNoticeSchema.safeParse({
        title: 'Test',
        content: '',
        category: 'general',
      });
      expect(result.success).toBe(false);
    });

    it('should default category to "general"', () => {
      const result = CreateNoticeSchema.safeParse({
        title: 'Test',
        content: 'Content',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('general');
      }
    });

    it('should default publish to false', () => {
      const result = CreateNoticeSchema.safeParse({
        title: 'Test',
        content: 'Content',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.publish).toBe(false);
      }
    });

    it('should reject title over 200 characters', () => {
      const result = CreateNoticeSchema.safeParse({
        title: 'x'.repeat(201),
        content: 'Content',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateNoticeSchema', () => {
    it('should accept partial update', () => {
      const result = UpdateNoticeSchema.safeParse({ title: 'Updated' });
      expect(result.success).toBe(true);
    });

    it('should accept publish flag', () => {
      const result = UpdateNoticeSchema.safeParse({ publish: true });
      expect(result.success).toBe(true);
    });

    it('should reject empty title when provided', () => {
      const result = UpdateNoticeSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Ticket validation schemas', () => {
  describe('CreateTicketSchema', () => {
    it('should accept valid ticket input', () => {
      const result = CreateTicketSchema.safeParse({
        title: 'Leaky faucet',
        description: 'Kitchen sink is leaking.',
        category: 'plumbing',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = CreateTicketSchema.safeParse({
        title: '',
        description: 'Desc',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty description', () => {
      const result = CreateTicketSchema.safeParse({
        title: 'Test',
        description: '',
      });
      expect(result.success).toBe(false);
    });

    it('should default category to "other"', () => {
      const result = CreateTicketSchema.safeParse({
        title: 'Test',
        description: 'Desc',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('other');
      }
    });
  });

  describe('UpdateTicketSchema', () => {
    it('should accept status update', () => {
      const result = UpdateTicketSchema.safeParse({ status: 'IN_PROGRESS' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status value', () => {
      const result = UpdateTicketSchema.safeParse({ status: 'INVALID' });
      expect(result.success).toBe(false);
    });

    it('should accept null assignedTo', () => {
      const result = UpdateTicketSchema.safeParse({ assignedTo: null });
      expect(result.success).toBe(true);
    });

    it('should accept partial update with just category', () => {
      const result = UpdateTicketSchema.safeParse({ category: 'electrical' });
      expect(result.success).toBe(true);
    });
  });

  describe('AddCommentSchema', () => {
    it('should accept valid comment', () => {
      const result = AddCommentSchema.safeParse({ content: 'Working on it.' });
      expect(result.success).toBe(true);
    });

    it('should reject empty comment', () => {
      const result = AddCommentSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Auth validation schemas', () => {
  describe('SignupSchema', () => {
    it('should accept valid signup input', () => {
      const result = SignupSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        societyName: 'Test Society',
        societySlug: 'test-society',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = SignupSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
        name: 'Test',
        societyName: 'Test',
        societySlug: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = SignupSchema.safeParse({
        email: 'test@example.com',
        password: '123',
        name: 'Test',
        societyName: 'Test',
        societySlug: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('should reject slug with uppercase letters', () => {
      const result = SignupSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test',
        societyName: 'Test',
        societySlug: 'Test-Society',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoginSchema', () => {
    it('should accept valid login', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('InviteResidentSchema', () => {
    it('should accept valid invite', () => {
      const result = InviteResidentSchema.safeParse({
        email: 'resident@example.com',
        name: 'New Resident',
        unitId: '00000000-0000-0000-0000-000000000001',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid unit UUID', () => {
      const result = InviteResidentSchema.safeParse({
        email: 'resident@example.com',
        name: 'New Resident',
        unitId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });
  });
});
