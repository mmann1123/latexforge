import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase modules before importing
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args) => mockSignInWithPopup(...args),
  GoogleAuthProvider: vi.fn(),
  signOut: (...args) => mockSignOut(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('./config.js', () => ({
  auth: { currentUser: null },
  db: {},
}));

describe('auth module', () => {
  let loginWithGoogle, logout, isEmailPermitted;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: Firestore exceptions list is empty
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const mod = await import('./auth.js');
    loginWithGoogle = mod.loginWithGoogle;
    logout = mod.logout;
    isEmailPermitted = mod.isEmailPermitted;
  });

  describe('isEmailPermitted', () => {
    it('permits admin email', async () => {
      expect(await isEmailPermitted('mmann1123@gmail.com')).toBe(true);
    });

    it('permits .edu email', async () => {
      expect(await isEmailPermitted('student@gwu.edu')).toBe(true);
    });

    it('permits .edu subdomain email', async () => {
      expect(await isEmailPermitted('student@email.gwu.edu')).toBe(true);
    });

    it('permits .org email', async () => {
      expect(await isEmailPermitted('user@nonprofit.org')).toBe(true);
    });

    it('permits email in Firestore exceptions list', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ emails: ['friend@gmail.com'] }),
      });
      expect(await isEmailPermitted('friend@gmail.com')).toBe(true);
    });

    it('rejects non-allowed email not in exceptions', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ emails: ['other@gmail.com'] }),
      });
      expect(await isEmailPermitted('random@gmail.com')).toBe(false);
    });

    it('rejects when Firestore doc does not exist', async () => {
      expect(await isEmailPermitted('random@gmail.com')).toBe(false);
    });

    it('rejects gracefully when Firestore errors', async () => {
      mockGetDoc.mockRejectedValue(new Error('network'));
      expect(await isEmailPermitted('random@gmail.com')).toBe(false);
    });

    it('checks case-insensitively', async () => {
      expect(await isEmailPermitted('STUDENT@GWU.EDU')).toBe(true);
    });

    it('checks Firestore list case-insensitively', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ emails: ['friend@gmail.com'] }),
      });
      expect(await isEmailPermitted('FRIEND@GMAIL.COM')).toBe(true);
    });
  });

  describe('loginWithGoogle', () => {
    it('succeeds for admin Gmail account', async () => {
      const mockUser = { uid: 'g1', email: 'mmann1123@gmail.com', displayName: 'Admin', getIdToken: vi.fn() };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('succeeds for .edu email', async () => {
      const mockUser = { uid: 'g2', email: 'student@gwu.edu', displayName: 'Student', getIdToken: vi.fn() };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
    });

    it('succeeds for Firestore-excepted email', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ emails: ['friend@gmail.com'] }),
      });
      const mockUser = { uid: 'g8', email: 'friend@gmail.com', displayName: 'Friend', getIdToken: vi.fn() };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
    });

    it('rejects non-allowed domain not in exceptions', async () => {
      const mockUser = { uid: 'g5', email: 'random@gmail.com', displayName: 'Random' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });

      await expect(loginWithGoogle()).rejects.toThrow(
        'Access is limited to .edu and .org Google accounts'
      );
    });

    it('checks domain case-insensitively', async () => {
      const mockUser = { uid: 'g7', email: 'STUDENT@GWU.EDU', displayName: 'Caps', getIdToken: vi.fn() };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
    });
  });

  describe('logout', () => {
    it('calls signOut', async () => {
      mockSignOut.mockResolvedValue();
      await logout();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
