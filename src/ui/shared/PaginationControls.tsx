interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  className?: string;
  ariaLabelPrefix?: string;
}

/**
 * PaginationControls: Reusable pagination UI component
 * Displays page navigation buttons and current page indicator
 */
export const PaginationControls = ({
  currentPage,
  totalPages,
  onNextPage,
  onPrevPage,
  className = '',
  ariaLabelPrefix = 'page',
}: PaginationControlsProps) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onPrevPage}
        disabled={currentPage === 0}
        aria-label={`Previous ${ariaLabelPrefix}`}
      >
        ◀
      </button>
      <span>
        {currentPage + 1} / {totalPages}
      </span>
      <button
        type="button"
        onClick={onNextPage}
        disabled={currentPage >= totalPages - 1}
        aria-label={`Next ${ariaLabelPrefix}`}
      >
        ▶
      </button>
    </div>
  );
};
