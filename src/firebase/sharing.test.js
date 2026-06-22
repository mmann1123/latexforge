import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore functions
const mockAddDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => args.join('/')),
  doc: vi.fn((...args) => args.join('/')),
  addDoc: (...args) => mockAddDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  deleteField: vi.fn(() => 'DELETE_FIELD_SENTINEL'),
  serverTimestamp: vi.fn(() => 'mock-ts'),
  query: vi.fn((...args) => args[0]),
  where: vi.fn(),
}));

vi.mock('./config.js', () => ({
  db: 'mock-db',
}));

import {
  inviteCollaborator,
  getInvitation,
  getPendingInvitations,
  acceptInvitation,
  declineInvitation,
  removeCollaborator,
  getCollaborators,
  getProjectInvitations,
  cancelInvitation,
  baseDomainEmail,
  invitedEmailFromId,
} from './sharing.js';

describe('sharing module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('inviteCollaborator', () => {
    it('creates invitation with a deterministic ID and sends email', async () => {
      const user = { uid: 'owner-1', displayName: 'Owner', email: 'owner@test.com' };
      const id = await inviteCollaborator('proj-1', 'My Project', 'Friend@Test.com', 'editor', user);

      // ID is baseDomain(email)_projectId
      expect(id).toBe('friend@test.com_proj-1');

      // Invitation written via setDoc at the deterministic ID
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const invData = mockSetDoc.mock.calls[0][1];
      expect(invData.invitedEmail).toBe('friend@test.com'); // lowercased
      expect(invData.role).toBe('editor');
      expect(invData.status).toBe('pending');
      expect(invData.projectId).toBe('proj-1');

      // Mail doc created via addDoc
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const mailData = mockAddDoc.mock.calls[0][1];
      expect(mailData.to).toBe('friend@test.com');
      expect(mailData.message.subject).toContain('My Project');
    });

    it('uses the base domain in the ID for subdomain emails', async () => {
      const user = { uid: 'owner-1', email: 'owner@test.com' };
      const id = await inviteCollaborator('proj-9', 'P', 'jane@cs.stanford.edu', 'viewer', user);
      expect(id).toBe('jane@stanford.edu_proj-9');
    });

    it('defaults role to editor when not specified', async () => {
      const user = { uid: 'u1', email: 'a@b.com' };
      await inviteCollaborator('proj-1', 'P', 'x@y.com', null, user);

      const invData = mockSetDoc.mock.calls[0][1];
      expect(invData.role).toBe('editor');
    });

    it('uses user email as inviterName when displayName is missing', async () => {
      const user = { uid: 'u1', email: 'fallback@test.com', displayName: '' };
      await inviteCollaborator('proj-1', 'P', 'x@y.com', 'viewer', user);

      const invData = mockSetDoc.mock.calls[0][1];
      expect(invData.invitedByName).toBe('fallback@test.com');
    });
  });

  describe('getInvitation', () => {
    it('returns invitation when it exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'inv-1',
        data: () => ({ invitedEmail: 'a@b.com', status: 'pending' }),
      });

      const inv = await getInvitation('inv-1');
      expect(inv).toEqual({ id: 'inv-1', invitedEmail: 'a@b.com', status: 'pending' });
    });

    it('returns null when invitation does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      expect(await getInvitation('missing')).toBeNull();
    });
  });

  describe('getPendingInvitations', () => {
    it('returns pending invitations for an email', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'inv-1', data: () => ({ invitedEmail: 'user@test.com', status: 'pending' }) },
        ],
      });

      const invites = await getPendingInvitations('User@Test.com');
      expect(invites).toHaveLength(1);
    });

    it('returns empty array for null email', async () => {
      const result = await getPendingInvitations(null);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty email', async () => {
      const result = await getPendingInvitations('');
      expect(result).toEqual([]);
    });
  });

  describe('acceptInvitation', () => {
    it('adds user as collaborator and marks invitation accepted', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          invitedEmail: 'user@test.com',
          role: 'editor',
          projectId: 'proj-1',
        }),
      });
      mockUpdateDoc.mockResolvedValue();

      await acceptInvitation('inv-1', 'user-uid', 'user@test.com');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);

      // Project collaborator update
      expect(mockUpdateDoc.mock.calls[0][1]).toHaveProperty('collaborators.user-uid', 'editor');

      // Invitation status update records the accepting uid
      expect(mockUpdateDoc.mock.calls[1][1]).toEqual({ status: 'accepted', acceptedBy: 'user-uid' });
    });

    it('throws when invitation not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await expect(acceptInvitation('missing', 'u1', 'a@b.com')).rejects.toThrow(
        'Invitation not found'
      );
    });

    it('throws when email does not match', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          invitedEmail: 'correct@test.com',
          role: 'editor',
          projectId: 'proj-1',
        }),
      });

      await expect(
        acceptInvitation('inv-1', 'u1', 'wrong@test.com')
      ).rejects.toThrow('not for your account');
    });

    it('accepts when emails match via base domain (subdomain variant)', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          invitedEmail: 'user@gwmail.gwu.edu',
          role: 'editor',
          projectId: 'proj-1',
        }),
      });
      mockUpdateDoc.mockResolvedValue();

      await acceptInvitation('inv-1', 'user-uid', 'user@gwu.edu');
      expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('declineInvitation', () => {
    it('marks invitation as declined', async () => {
      mockUpdateDoc.mockResolvedValue();
      await declineInvitation('inv-1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { status: 'declined' });
    });
  });

  describe('removeCollaborator', () => {
    it('removes collaborator field from project', async () => {
      mockUpdateDoc.mockResolvedValue();
      await removeCollaborator('proj-1', 'collab-uid');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'collaborators.collab-uid': 'DELETE_FIELD_SENTINEL' })
      );
    });
  });

  describe('getCollaborators', () => {
    it('returns collaborators map', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ collaborators: { u1: 'editor', u2: 'viewer' } }),
      });

      const collabs = await getCollaborators('proj-1');
      expect(collabs).toEqual({ u1: 'editor', u2: 'viewer' });
    });

    it('returns empty object when project not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      expect(await getCollaborators('missing')).toEqual({});
    });

    it('returns empty object when no collaborators field', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });
      expect(await getCollaborators('proj-1')).toEqual({});
    });
  });

  describe('getProjectInvitations', () => {
    it('returns all invitations for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'inv-1', data: () => ({ invitedEmail: 'a@b.com', status: 'pending' }) },
          { id: 'inv-2', data: () => ({ invitedEmail: 'c@d.com', status: 'accepted', acceptedBy: 'uid-2' }) },
        ],
      });

      const invites = await getProjectInvitations('proj-1');
      expect(invites).toHaveLength(2);
      expect(invites[0].id).toBe('inv-1');
    });
  });

  describe('cancelInvitation', () => {
    it('deletes the invitation document', async () => {
      mockDeleteDoc.mockResolvedValue();
      await cancelInvitation('inv-1');
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('baseDomainEmail', () => {
    it('strips subdomain from 3-part domain', () => {
      expect(baseDomainEmail('user@gwmail.gwu.edu')).toBe('user@gwu.edu');
    });

    it('strips subdomain from email.gwu.edu', () => {
      expect(baseDomainEmail('user@email.gwu.edu')).toBe('user@gwu.edu');
    });

    it('returns as-is for 2-part domain', () => {
      expect(baseDomainEmail('user@gwu.edu')).toBe('user@gwu.edu');
    });

    it('handles deeply nested subdomains', () => {
      expect(baseDomainEmail('user@cs.dept.harvard.edu')).toBe('user@harvard.edu');
    });

    it('lowercases the result', () => {
      expect(baseDomainEmail('User@GWmail.GWU.EDU')).toBe('user@gwu.edu');
    });
  });

  describe('invitedEmailFromId', () => {
    it('extracts the invited email from a deterministic ID', () => {
      expect(invitedEmailFromId('jane@stanford.edu_PROJabc123')).toBe('jane@stanford.edu');
    });

    it('handles underscores in the local part (last underscore is the separator)', () => {
      expect(invitedEmailFromId('jane_doe@gwu.edu_PROJabc123')).toBe('jane_doe@gwu.edu');
    });

    it('returns empty string for legacy random IDs without an underscore', () => {
      expect(invitedEmailFromId('SwvmMtgGdCPUrY2cDut')).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(invitedEmailFromId('')).toBe('');
      expect(invitedEmailFromId(null)).toBe('');
    });
  });

});
