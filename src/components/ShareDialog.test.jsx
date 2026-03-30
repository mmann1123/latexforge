import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareDialog from './ShareDialog.jsx';

// Mock useAuth hook
vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: { uid: 'owner-uid', email: 'owner@example.com', displayName: 'Owner' },
  }),
}));

// Mock sharing functions
const mockGetCollaborators = vi.fn().mockResolvedValue({ 'collab-1': 'editor' });
const mockGetProjectInvitations = vi.fn().mockResolvedValue([
  { id: 'inv-1', invitedEmail: 'invited@example.com', role: 'viewer' },
]);
const mockInviteCollaborator = vi.fn().mockResolvedValue('new-inv-id');
const mockRemoveCollaborator = vi.fn().mockResolvedValue();
const mockCancelInvitation = vi.fn().mockResolvedValue();

vi.mock('../firebase/sharing.js', () => ({
  inviteCollaborator: (...args) => mockInviteCollaborator(...args),
  getCollaborators: (...args) => mockGetCollaborators(...args),
  getProjectInvitations: (...args) => mockGetProjectInvitations(...args),
  removeCollaborator: (...args) => mockRemoveCollaborator(...args),
  cancelInvitation: (...args) => mockCancelInvitation(...args),
}));

describe('ShareDialog', () => {
  const defaultProps = {
    projectId: 'proj-1',
    project: { name: 'Test Project' },
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCollaborators.mockResolvedValue({ 'collab-1': 'editor' });
    mockGetProjectInvitations.mockResolvedValue([
      { id: 'inv-1', invitedEmail: 'invited@example.com', role: 'viewer' },
    ]);
  });

  it('renders the dialog with header', () => {
    render(<ShareDialog {...defaultProps} />);
    expect(screen.getByText('Share Project')).toBeInTheDocument();
  });

  it('renders the invite form with email input, role select, and button', () => {
    render(<ShareDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Invite')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('loads and displays collaborators', async () => {
    render(<ShareDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Collaborators')).toBeInTheDocument();
      expect(screen.getByText('collab-1')).toBeInTheDocument();
      expect(screen.getByText('editor')).toBeInTheDocument();
    });
  });

  it('loads and displays pending invitations', async () => {
    render(<ShareDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Pending Invitations')).toBeInTheDocument();
      expect(screen.getByText('invited@example.com')).toBeInTheDocument();
      expect(screen.getByText('viewer')).toBeInTheDocument();
    });
  });

  it('calls onClose when overlay is clicked', () => {
    render(<ShareDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Share Project').closest('.share-dialog-overlay'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when X button is clicked', () => {
    render(<ShareDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('×'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('prevents self-invitation and shows error', async () => {
    render(<ShareDialog {...defaultProps} />);
    const emailInput = screen.getByPlaceholderText('Email address');
    fireEvent.change(emailInput, { target: { value: 'owner@example.com' } });
    fireEvent.submit(emailInput.closest('form'));

    await waitFor(() => {
      expect(screen.getByText("You can't invite yourself.")).toBeInTheDocument();
    });
    expect(mockInviteCollaborator).not.toHaveBeenCalled();
  });

  it('submits invitation for valid email', async () => {
    render(<ShareDialog {...defaultProps} />);
    const emailInput = screen.getByPlaceholderText('Email address');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.submit(emailInput.closest('form'));

    await waitFor(() => {
      expect(mockInviteCollaborator).toHaveBeenCalledWith(
        'proj-1',
        'Test Project',
        'new@example.com',
        'editor',
        expect.objectContaining({ uid: 'owner-uid' })
      );
    });
  });

  it('renders Cancel button for pending invitations', async () => {
    render(<ShareDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('renders Remove button for collaborators', async () => {
    render(<ShareDialog {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Remove')).toBeInTheDocument();
    });
  });
});
