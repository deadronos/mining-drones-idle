import type { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export const SidebarSection = ({
  title,
  description,
  defaultOpen = true,
  children,
}: SidebarSectionProps) => {
  return (
    <details className="sidebar-section" open={defaultOpen}>
      <summary className="sidebar-section__summary">
        <div className="sidebar-section__title">
          <span>{title}</span>
          {description ? (
            <span className="sidebar-section__description">{description}</span>
          ) : null}
        </div>
        <span className="sidebar-section__chevron" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div className="sidebar-section__content">{children}</div>
    </details>
  );
};
