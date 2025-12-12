/**
 * Props for the PaginationControls component
 */
interface PaginationControlsProps {
  /** Current page index (0-based) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback to navigate to the next page */
  onNextPage: () => void;
  /** Callback to navigate to the previous page */
  onPrevPage: () => void;
  /** Optional CSS class name for styling */
  className?: string;
  /** Optional prefix for aria-label (e.g., "docking page" results in "Next docking page") */
  ariaLabelPrefix?: string;
}

/**
 * PaginationControls: Reusable pagination UI component
 * 
 * Displays page navigation buttons with previous/next controls and current page indicator.
 * Automatically hides when totalPages is 1 or less.
 * 
 * @example
 * ```tsx
 * <PaginationControls
 *   currentPage={0}
 *   totalPages={5}
 *   onNextPage={handleNext}
 *   onPrevPage={handlePrev}
 *   className="my-pagination"
 *   ariaLabelPrefix="results page"
 * />
 * ```
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
