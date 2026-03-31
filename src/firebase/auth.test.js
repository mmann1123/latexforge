import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase modules before importing
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockSetDoc = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args) => mockSignInWithPopup(...args),
  GoogleAuthProvider: vi.fn(),
  signOut: (...args) => mockSignOut(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  setDoc: (...args) => mockSetDoc(...args),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('./config.js', () => ({
  auth: { currentUser: null },
  db: {},
}));

describe('auth module', () => {
  let loginWithGoogle, logout;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./auth.js');
    loginWithGoogle = mod.loginWithGoogle;
    logout = mod.logout;
  });

  describe('loginWithGoogle', () => {
    it('succeeds for admin Gmail account', async () => {
      const mockUser = { uid: 'g1', email: 'mmann1123@gmail.com', displayName: 'Admin' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('succeeds for .edu email', async () => {
      const mockUser = { uid: 'g2', email: 'student@gwu.edu', displayName: 'Student' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
    });

    it('succeeds for .edu subdomain email', async () => {
      const mockUser = { uid: 'g3', email: 'student@email.gwu.edu', displayName: 'Student' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
    });

    it('succeeds for .org email', async () => {
      const mockUser = { uid: 'g4', email: 'user@nonprofit.org', displayName: 'Org User' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
    });

    it('rejects non-allowed domain', async () => {
      const mockUser = { uid: 'g5', email: 'random@gmail.com', displayName: 'Random' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });

      await expect(loginWithGoogle()).rejects.toThrow(
        'Access is limited to .edu and .org Google accounts'
      );
    });

    it('rejects .com domain', async () => {
      const mockUser = { uid: 'g6', email: 'user@company.com', displayName: 'Corp' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });

      await expect(loginWithGoogle()).rejects.toThrow(
        'Access is limited to .edu and .org Google accounts'
      );
    });

    it('checks domain case-insensitively', async () => {
      const mockUser = { uid: 'g7', email: 'STUDENT@GWU.EDU', displayName: 'Caps' };
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
