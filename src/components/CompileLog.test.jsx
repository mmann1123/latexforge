import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CompileLog from './CompileLog.jsx';

describe('CompileLog', () => {
  it('renders nothing when no log and success is null', () => {
    const { container } = render(<CompileLog log="" success={null} />);
    expect(container.textContent).toBe('');
  });

  it('shows success message when compilation succeeds', () => {
    render(<CompileLog log="" success={true} />);
    expect(screen.getByText('Compiled successfully.')).toBeInTheDocument();
  });

  it('shows failure message when compilation fails', () => {
    render(<CompileLog log="Some error" success={false} />);
    expect(screen.getByText('Compilation failed')).toBeInTheDocument();
  });

  it('shows log content when expanded', () => {
    render(<CompileLog log="Error on line 42" success={false} />);
    // Click to show log
    fireEvent.click(screen.getByText('show log'));
    expect(screen.getByText('Error on line 42')).toBeInTheDocument();
  });

  it('hides log when toggled', () => {
    render(<CompileLog log="Error on line 42" success={false} />);
    fireEvent.click(screen.getByText('show log'));
    expect(screen.getByText('Error on line 42')).toBeInTheDocument();
    fireEvent.click(screen.getByText('hide log'));
    expect(screen.queryByText('Error on line 42')).not.toBeInTheDocument();
  });
});
