import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase modules before importing
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockSetCustomParameters = vi.fn();

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    constructor() { this.setCustomParameters = mockSetCustomParameters; }
  }
  return {
    signInWithPopup: (...args) => mockSignInWithPopup(...args),
    GoogleAuthProvider: MockGoogleAuthProvider,
    signOut: (...args) => mockSignOut(...args),
  };
});

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
  let loginWithGoogle, logout, isEmailPermitted, getAuthCheckPromise;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue();
    // Default: Firestore exceptions list is empty
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const mod = await import('./auth.js');
    loginWithGoogle = mod.loginWithGoogle;
    logout = mod.logout;
    isEmailPermitted = mod.isEmailPermitted;
    getAuthCheckPromise = mod.getAuthCheckPromise;
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

    it('permits .ac.uk email (UK academic)', async () => {
      expect(await isEmailPermitted('student@cam.ac.uk')).toBe(true);
    });

    it('permits .ac.uk subdomain email', async () => {
      expect(await isEmailPermitted('user@cs.ox.ac.uk')).toBe(true);
    });

    it('permits .edu.br email (Brazil academic)', async () => {
      expect(await isEmailPermitted('aluno@usp.edu.br')).toBe(true);
    });

    it('permits .ca email (Canadian institution)', async () => {
      expect(await isEmailPermitted('student@ubc.ca')).toBe(true);
    });

    it('permits .edu.eu email (European academic)', async () => {
      expect(await isEmailPermitted('user@university.edu.eu')).toBe(true);
    });

    it('permits .edu.mx email (Mexico academic)', async () => {
      expect(await isEmailPermitted('alumno@unam.edu.mx')).toBe(true);
    });

    it('permits .ac.jp email (Japan academic)', async () => {
      expect(await isEmailPermitted('student@u-tokyo.ac.jp')).toBe(true);
    });

    it('rejects non-academic country domain', async () => {
      expect(await isEmailPermitted('user@company.co.uk')).toBe(false);
    });

    it('rejects non-academic .com domain', async () => {
      expect(await isEmailPermitted('user@google.com')).toBe(false);
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
        'Access is limited to academic and nonprofit Google accounts'
      );
    });

    it('signs out rejected users', async () => {
      const mockUser = { uid: 'g5', email: 'random@gmail.com', displayName: 'Random' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });

      await expect(loginWithGoogle()).rejects.toThrow();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('forces Google account chooser via select_account', async () => {
      const mockUser = { uid: 'g1', email: 'mmann1123@gmail.com', displayName: 'Admin', getIdToken: vi.fn() };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      await loginWithGoogle();
      expect(mockSetCustomParameters).toHaveBeenCalledWith({ prompt: 'select_account' });
    });

    it('resolves auth gate with permitted:true on success', async () => {
      const mockUser = { uid: 'g1', email: 'mmann1123@gmail.com', displayName: 'Admin', getIdToken: vi.fn() };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });
      mockSetDoc.mockResolvedValue();

      // Start login — gate promise should exist during the call
      const loginPromise = loginWithGoogle();
      const gatePromise = getAuthCheckPromise();
      expect(gatePromise).not.toBeNull();

      await loginPromise;
      // After login completes, gate should be cleared
      expect(getAuthCheckPromise()).toBeNull();
    });

    it('resolves auth gate with permitted:false on rejection', async () => {
      const mockUser = { uid: 'g5', email: 'random@gmail.com', displayName: 'Random' };
      mockSignInWithPopup.mockResolvedValue({ user: mockUser });

      const loginPromise = loginWithGoogle().catch(() => {});
      const gatePromise = getAuthCheckPromise();
      expect(gatePromise).not.toBeNull();

      // The gate should resolve with permitted: false
      const result = await gatePromise;
      expect(result).toEqual({ permitted: false });

      await loginPromise;
      expect(getAuthCheckPromise()).toBeNull();
    });

    it('clears auth gate even if signInWithPopup fails', async () => {
      mockSignInWithPopup.mockRejectedValue(new Error('popup closed'));

      await expect(loginWithGoogle()).rejects.toThrow('popup closed');
      expect(getAuthCheckPromise()).toBeNull();
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
