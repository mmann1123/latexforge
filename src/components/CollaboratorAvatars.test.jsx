import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import CollaboratorAvatars from './CollaboratorAvatars.jsx';

function createMockAwareness(states = new Map()) {
  const listeners = {};
  return {
    clientID: 1,
    getStates: () => states,
    on: (event, fn) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    off: (event, fn) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== fn);
      }
    },
    _emit: (event) => {
      (listeners[event] || []).forEach((fn) => fn());
    },
  };
}

describe('CollaboratorAvatars', () => {
  it('returns null when no peers are connected', () => {
    const awareness = createMockAwareness(new Map([[1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }]]));
    const { container } = render(
      <CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />
    );
    // Only self in states → skip self → no peers → returns null
    expect(container.firstChild).toBeNull();
  });

  it('returns null when awareness is null', () => {
    const { container } = render(
      <CollaboratorAvatars awareness={null} currentUser={{ uid: 'me' }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders peer avatars with initials', () => {
    const states = new Map([
      [1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }],
      [2, { user: { uid: 'peer1', displayName: 'John Doe', color: '#e06c75' } }],
    ]);
    const awareness = createMockAwareness(states);

    render(<CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByTitle('John Doe')).toBeInTheDocument();
  });

  it('deduplicates peers with same uid (multiple tabs)', () => {
    const states = new Map([
      [1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }],
      [2, { user: { uid: 'peer1', displayName: 'Alice B', color: '#61afef' } }],
      [3, { user: { uid: 'peer1', displayName: 'Alice B', color: '#61afef' } }],
    ]);
    const awareness = createMockAwareness(states);

    render(<CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />);
    const avatars = screen.getAllByText('AB');
    expect(avatars).toHaveLength(1);
  });

  it('shows multiple distinct peers', () => {
    const states = new Map([
      [1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }],
      [2, { user: { uid: 'peer1', displayName: 'Alice B', color: '#61afef' } }],
      [3, { user: { uid: 'peer2', displayName: 'Charlie D', color: '#98c379' } }],
    ]);
    const awareness = createMockAwareness(states);

    render(<CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText('CD')).toBeInTheDocument();
  });

  it('applies peer color as background', () => {
    const states = new Map([
      [1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }],
      [2, { user: { uid: 'peer1', displayName: 'Zara', color: '#e06c75' } }],
    ]);
    const awareness = createMockAwareness(states);

    render(<CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />);
    const avatar = screen.getByTitle('Zara');
    expect(avatar.style.backgroundColor).toBe('rgb(224, 108, 117)');
  });

  it('updates when awareness emits change event', () => {
    const states = new Map([
      [1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }],
    ]);
    const awareness = createMockAwareness(states);

    const { container } = render(
      <CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />
    );
    expect(container.firstChild).toBeNull();

    // Add a new peer and emit change
    act(() => {
      states.set(2, { user: { uid: 'new', displayName: 'New User', color: '#ccc' } });
      awareness._emit('change');
    });

    expect(screen.getByText('NU')).toBeInTheDocument();
  });

  it('handles single-name peers (one initial)', () => {
    const states = new Map([
      [1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }],
      [2, { user: { uid: 'p', displayName: 'Madonna', color: '#ccc' } }],
    ]);
    const awareness = createMockAwareness(states);

    render(<CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('falls back to Anonymous when no displayName', () => {
    const states = new Map([
      [1, { user: { uid: 'me', displayName: 'Me', color: '#aaa' } }],
      [2, { user: { uid: 'anon', color: '#ccc' } }],
    ]);
    const awareness = createMockAwareness(states);

    render(<CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />);
    // Peer without displayName → state.user exists but displayName is undefined
    // The component does: state.user.displayName || 'Anonymous' → 'Anonymous' → 'A'
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('cleans up listener on unmount', () => {
    const awareness = createMockAwareness(new Map());
    const offSpy = vi.spyOn(awareness, 'off');

    const { unmount } = render(
      <CollaboratorAvatars awareness={awareness} currentUser={{ uid: 'me' }} />
    );
    unmount();
    expect(offSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
