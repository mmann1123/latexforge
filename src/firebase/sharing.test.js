import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore functions
const mockAddDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((...args) => args.join('/')),
  doc: vi.fn((...args) => args.join('/')),
  addDoc: (...args) => mockAddDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  deleteField: vi.fn(() => 'DELETE_FIELD_SENTINEL'),
  arrayUnion: vi.fn((val) => `ARRAY_UNION:${val}`),
  serverTimestamp: vi.fn(() => 'mock-ts'),
  query: vi.fn((...args) => args[0]),
  where: vi.fn(),
  setDoc: (...args) => mockSetDoc(...args),
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
  isEmailAllowed,
} from './sharing.js';

describe('sharing module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('inviteCollaborator', () => {
    it('creates invitation, sends email, and updates allowlist', async () => {
      mockAddDoc.mockResolvedValue({ id: 'inv-1' });
      // Mock allowlist getDoc (addToAllowlist checks if doc exists)
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ emails: [] }) });
      mockUpdateDoc.mockResolvedValue();

      const user = { uid: 'owner-1', displayName: 'Owner', email: 'owner@test.com' };
      const id = await inviteCollaborator('proj-1', 'My Project', 'Friend@Test.com', 'editor', user);

      expect(id).toBe('inv-1');
      // Should create invitation doc and mail doc
      expect(mockAddDoc).toHaveBeenCalledTimes(2);

      // Invitation doc
      const invData = mockAddDoc.mock.calls[0][1];
      expect(invData.invitedEmail).toBe('friend@test.com'); // lowercased
      expect(invData.role).toBe('editor');
      expect(invData.status).toBe('pending');
      expect(invData.projectId).toBe('proj-1');

      // Mail doc
      const mailData = mockAddDoc.mock.calls[1][1];
      expect(mailData.to).toBe('friend@test.com');
      expect(mailData.message.subject).toContain('My Project');
    });

    it('defaults role to editor when not specified', async () => {
      mockAddDoc.mockResolvedValue({ id: 'inv-2' });
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ emails: [] }) });
      mockUpdateDoc.mockResolvedValue();

      const user = { uid: 'u1', email: 'a@b.com' };
      await inviteCollaborator('proj-1', 'P', 'x@y.com', null, user);

      const invData = mockAddDoc.mock.calls[0][1];
      expect(invData.role).toBe('editor');
    });

    it('uses user email as inviterName when displayName is missing', async () => {
      mockAddDoc.mockResolvedValue({ id: 'inv-3' });
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ emails: [] }) });
      mockUpdateDoc.mockResolvedValue();

      const user = { uid: 'u1', email: 'fallback@test.com', displayName: '' };
      await inviteCollaborator('proj-1', 'P', 'x@y.com', 'viewer', user);

      const invData = mockAddDoc.mock.calls[0][1];
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

      // Invitation status update
      expect(mockUpdateDoc.mock.calls[1][1]).toEqual({ status: 'accepted' });
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
    it('returns pending invitations for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'inv-1', data: () => ({ invitedEmail: 'a@b.com', status: 'pending' }) },
        ],
      });

      const invites = await getProjectInvitations('proj-1');
      expect(invites).toHaveLength(1);
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

  describe('isEmailAllowed', () => {
    it('returns true when email is in the allowlist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ emails: ['allowed@test.com', 'other@test.com'] }),
      });

      expect(await isEmailAllowed('allowed@test.com')).toBe(true);
    });

    it('returns false when email is not in the allowlist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ emails: ['other@test.com'] }),
      });

      expect(await isEmailAllowed('nothere@test.com')).toBe(false);
    });

    it('returns false when allowlist doc does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      expect(await isEmailAllowed('any@test.com')).toBe(false);
    });

    it('returns false on Firestore error', async () => {
      mockGetDoc.mockRejectedValue(new Error('network error'));
      expect(await isEmailAllowed('any@test.com')).toBe(false);
    });

    it('checks case-insensitively', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ emails: ['user@test.com'] }),
      });

      expect(await isEmailAllowed('USER@TEST.COM')).toBe(true);
    });
  });
});
