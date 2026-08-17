import { describe, it, expect } from 'vitest';
import { can } from './permissions';
import type { Role } from '@apartment/shared';

describe('Permission system', () => {
  describe('Notice permissions', () => {
    it('SUPER_ADMIN can create notices', () => {
      expect(can('SUPER_ADMIN', 'create', 'notice')).toBe(true);
    });

    it('COMMITTEE_ADMIN can create notices', () => {
      expect(can('COMMITTEE_ADMIN', 'create', 'notice')).toBe(true);
    });

    it('RESIDENT cannot create notices', () => {
      expect(can('RESIDENT', 'create', 'notice')).toBe(false);
    });

    it('SECURITY_GUARD cannot create notices', () => {
      expect(can('SECURITY_GUARD', 'create', 'notice')).toBe(false);
    });

    it('RESIDENT can read notices', () => {
      expect(can('RESIDENT', 'read', 'notice')).toBe(true);
    });

    it('RESIDENT cannot delete notices', () => {
      expect(can('RESIDENT', 'delete', 'notice')).toBe(false);
    });
  });

  describe('Ticket permissions', () => {
    it('RESIDENT can create tickets', () => {
      expect(can('RESIDENT', 'create', 'ticket')).toBe(true);
    });

    it('RESIDENT can read tickets', () => {
      expect(can('RESIDENT', 'read', 'ticket')).toBe(true);
    });

    it('RESIDENT cannot delete tickets', () => {
      expect(can('RESIDENT', 'delete', 'ticket')).toBe(false);
    });

    it('COMMITTEE_ADMIN can update tickets', () => {
      expect(can('COMMITTEE_ADMIN', 'update', 'ticket')).toBe(true);
    });

    it('SECURITY_GUARD cannot update tickets', () => {
      expect(can('SECURITY_GUARD', 'update', 'ticket')).toBe(false);
    });
  });

  describe('Directory (membership read) permissions', () => {
    it('COMMITTEE_ADMIN can read memberships', () => {
      expect(can('COMMITTEE_ADMIN', 'read', 'membership')).toBe(true);
    });

    it('RESIDENT can read memberships', () => {
      expect(can('RESIDENT', 'read', 'membership')).toBe(true);
    });

    it('SECURITY_GUARD cannot read memberships', () => {
      expect(can('SECURITY_GUARD', 'read', 'membership')).toBe(false);
    });
  });

  describe('Invite permissions', () => {
    it('SUPER_ADMIN can invite members', () => {
      expect(can('SUPER_ADMIN', 'invite', 'membership')).toBe(true);
    });

    it('COMMITTEE_ADMIN can invite members', () => {
      expect(can('COMMITTEE_ADMIN', 'invite', 'membership')).toBe(true);
    });

    it('RESIDENT cannot invite members', () => {
      expect(can('RESIDENT', 'invite', 'membership')).toBe(false);
    });
  });

  describe('Analytics permissions (Phase 7)', () => {
    it('COMMITTEE_ADMIN can read analytics', () => {
      expect(can('COMMITTEE_ADMIN', 'read', 'analytics')).toBe(true);
    });

    it('SUPER_ADMIN can read analytics', () => {
      expect(can('SUPER_ADMIN', 'read', 'analytics')).toBe(true);
    });

    it('RESIDENT cannot read analytics', () => {
      expect(can('RESIDENT', 'read', 'analytics')).toBe(false);
    });

    it('SECURITY_GUARD cannot read analytics', () => {
      expect(can('SECURITY_GUARD', 'read', 'analytics')).toBe(false);
    });
  });

  describe('Vendor rating permissions (Phase 7)', () => {
    it('COMMITTEE_ADMIN can read vendor ratings', () => {
      expect(can('COMMITTEE_ADMIN', 'read', 'vendor')).toBe(true);
    });

    it('SUPER_ADMIN can read vendor ratings', () => {
      expect(can('SUPER_ADMIN', 'read', 'vendor')).toBe(true);
    });

    it('RESIDENT cannot read vendor ratings', () => {
      expect(can('RESIDENT', 'read', 'vendor')).toBe(false);
    });

    it('SECURITY_GUARD cannot read vendor ratings', () => {
      expect(can('SECURITY_GUARD', 'read', 'vendor')).toBe(false);
    });
  });

  describe('Role hierarchy', () => {
    it('SUPER_ADMIN can do anything COMMITTEE_ADMIN can do', () => {
      expect(can('SUPER_ADMIN', 'delete', 'building')).toBe(true);
    });

    it('COMMITTEE_ADMIN can do anything RESIDENT can do', () => {
      expect(can('COMMITTEE_ADMIN', 'create', 'ticket')).toBe(true);
    });
  });
});
