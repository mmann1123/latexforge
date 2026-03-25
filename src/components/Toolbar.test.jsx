import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from './Toolbar.jsx';

describe('Toolbar', () => {
  it('renders formatting buttons', () => {
    render(<Toolbar onInsert={vi.fn()} />);
    expect(screen.getByTitle('Bold (\\\\textbf)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (\\\\textit)')).toBeInTheDocument();
    expect(screen.getByTitle('Section (\\\\section)')).toBeInTheDocument();
  });

  it('renders math buttons', () => {
    render(<Toolbar onInsert={vi.fn()} />);
    expect(screen.getByTitle('Display math ($$...$$)')).toBeInTheDocument();
    expect(screen.getByTitle('Inline math ($...$)')).toBeInTheDocument();
  });

  it('calls onInsert with bold command when B is clicked', () => {
    const onInsert = vi.fn();
    render(<Toolbar onInsert={onInsert} />);
    fireEvent.click(screen.getByTitle('Bold (\\\\textbf)'));
    expect(onInsert).toHaveBeenCalledWith('\\textbf{}');
  });

  it('calls onInsert with italic command when I is clicked', () => {
    const onInsert = vi.fn();
    render(<Toolbar onInsert={onInsert} />);
    fireEvent.click(screen.getByTitle('Italic (\\\\textit)'));
    expect(onInsert).toHaveBeenCalledWith('\\textit{}');
  });

  it('calls onInsert with section command', () => {
    const onInsert = vi.fn();
    render(<Toolbar onInsert={onInsert} />);
    fireEvent.click(screen.getByTitle('Section (\\\\section)'));
    expect(onInsert).toHaveBeenCalledWith('\\section{}');
  });

  it('shows figure dropdown on click', () => {
    render(<Toolbar onInsert={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Insert figure environment'));
    expect(screen.getByText('Insert Figure')).toBeInTheDocument();
  });

  it('shows table dropdown on click', () => {
    render(<Toolbar onInsert={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Insert table environment'));
    expect(screen.getByText('Insert Table')).toBeInTheDocument();
  });

  it('inserts figure snippet and closes dropdown', () => {
    const onInsert = vi.fn();
    render(<Toolbar onInsert={onInsert} />);
    fireEvent.click(screen.getByTitle('Insert figure environment'));
    fireEvent.click(screen.getByText('Insert Figure'));
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert.mock.calls[0][0]).toContain('\\begin{figure}');
    // Dropdown should close
    expect(screen.queryByText('Insert Figure')).not.toBeInTheDocument();
  });
});
