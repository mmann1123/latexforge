import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase modules before importing
const mockCreateUser = vi.fn();
const mockSignIn = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockUpdateProfile = vi.fn();
const mockSetDoc = vi.fn();
const mockIsEmailAllowed = vi.fn();

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...args) => mockCreateUser(...args),
  signInWithEmailAndPassword: (...args) => mockSignIn(...args),
  signInWithPopup: (...args) => mockSignInWithPopup(...args),
  GoogleAuthProvider: vi.fn(),
  signOut: (...args) => mockSignOut(...args),
  updateProfile: (...args) => mockUpdateProfile(...args),
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

vi.mock('./sharing.js', () => ({
  isEmailAllowed: (...args) => mockIsEmailAllowed(...args),
}));

describe('auth module', () => {
  let registerWithEmail, loginWithEmail, loginWithGoogle, logout;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockIsEmailAllowed.mockResolvedValue(false);
    // Re-import to get fresh module
    const mod = await import('./auth.js');
    registerWithEmail = mod.registerWithEmail;
    loginWithEmail = mod.loginWithEmail;
    loginWithGoogle = mod.loginWithGoogle;
    logout = mod.logout;
  });

  describe('registerWithEmail', () => {
    it('succeeds for hardcoded allowed email', async () => {
      const mockUser = { uid: 'u1', email: 'mmann1123@gmail.com' };
      mockCreateUser.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue();
      mockSetDoc.mockResolvedValue();

      const user = await registerWithEmail('mmann1123@gmail.com', 'password', 'Test User');
      expect(user).toEqual(mockUser);
      expect(mockCreateUser).toHaveBeenCalled();
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'Test User' });
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('succeeds for Firestore-allowlisted email', async () => {
      mockIsEmailAllowed.mockResolvedValue(true);
      const mockUser = { uid: 'u2', email: 'allowed@test.com' };
      mockCreateUser.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue();
      mockSetDoc.mockResolvedValue();

      const user = await registerWithEmail('allowed@test.com', 'pw', 'Allowed');
      expect(user).toEqual(mockUser);
    });

    it('rejects non-allowed email', async () => {
      mockIsEmailAllowed.mockResolvedValue(false);
      await expect(
        registerWithEmail('hacker@evil.com', 'pw', 'Bad')
      ).rejects.toThrow('Access denied');
    });

    it('checks allowlist case-insensitively', async () => {
      const mockUser = { uid: 'u1', email: 'MMANN1123@gmail.com' };
      mockCreateUser.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue();
      mockSetDoc.mockResolvedValue();

      // uppercase version of hardcoded email should still pass
      const user = await registerWithEmail('MMANN1123@GMAIL.COM', 'pw', 'Name');
      expect(user).toEqual(mockUser);
    });
  });

  describe('loginWithEmail', () => {
    it('succeeds for allowed email', async () => {
      const mockUser = { uid: 'u1', email: 'mmann1123@gmail.com' };
      mockSignIn.mockResolvedValue({ user: mockUser });

      const user = await loginWithEmail('mmann1123@gmail.com', 'pw');
      expect(user).toEqual(mockUser);
      expect(mockSignIn).toHaveBeenCalled();
    });

    it('rejects non-allowed email', async () => {
      await expect(
        loginWithEmail('unauthorized@test.com', 'pw')
      ).rejects.toThrow('Access denied');
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });

  describe('loginWithGoogle', () => {
    it('succeeds for allowed Google account', async () => {
      const mockUser = { uid: 'g1', email: 'mmann1123@gmail.com', displayName: 'Google User' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      const user = await loginWithGoogle();
      expect(user).toEqual(mockUser);
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('rejects non-allowed Google account', async () => {
      const mockUser = { uid: 'g2', email: 'notallowed@gmail.com', displayName: 'Bad' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });

      await expect(loginWithGoogle()).rejects.toThrow('Access denied');
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
