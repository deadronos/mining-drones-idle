import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaginationControls } from './PaginationControls';

describe('PaginationControls', () => {
  it('renders null when totalPages is 1 or less', () => {
    const { container } = render(
      <PaginationControls
        currentPage={0}
        totalPages={1}
        onNextPage={vi.fn()}
        onPrevPage={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders pagination controls when totalPages is greater than 1', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(
      <PaginationControls
        currentPage={1}
        totalPages={3}
        onNextPage={onNext}
        onPrevPage={onPrev}
      />,
    );

    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(
      <PaginationControls
        currentPage={0}
        totalPages={3}
        onNextPage={vi.fn()}
        onPrevPage={vi.fn()}
      />,
    );

    const prevButton = screen.getByLabelText('Previous page');
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <PaginationControls
        currentPage={2}
        totalPages={3}
        onNextPage={vi.fn()}
        onPrevPage={vi.fn()}
      />,
    );

    const nextButton = screen.getByLabelText('Next page');
    expect(nextButton).toBeDisabled();
  });

  it('uses custom className and ariaLabelPrefix when provided', () => {
    render(
      <PaginationControls
        currentPage={1}
        totalPages={3}
        onNextPage={vi.fn()}
        onPrevPage={vi.fn()}
        className="custom-pagination"
        ariaLabelPrefix="docking page"
      />,
    );

    expect(screen.getByLabelText('Previous docking page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next docking page')).toBeInTheDocument();
    const container = screen.getByText('2 / 3').parentElement;
    expect(container).toHaveClass('custom-pagination');
  });
});
