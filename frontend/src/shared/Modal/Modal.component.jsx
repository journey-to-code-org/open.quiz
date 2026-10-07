import { useEffect, useId, useRef } from "react";

const variantStyles = {
  default: {
    dialog:
      "max-w-xl rounded-3xl border border-neutral-200 bg-surface-app text-foreground shadow-xl backdrop:bg-black/50",
    header: "flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-6",
    title: "font-heading text-h4 font-bold text-heading",
    description: "mt-1 text-small text-neutral-600",
    closeButton:
      "h-11 w-11 rounded-xl text-2xl text-heading hover:bg-surface-inset focus-visible:outline-focus",
    body: "px-6 py-6",
    footer:
      "flex flex-wrap justify-end gap-3 border-t border-neutral-200 bg-surface-raised px-6 py-5",
  },
  postIt: {
    dialog:
      "animate-post-it-pop max-w-sm -rotate-1 rounded-[0.25rem] border border-post-it-border bg-post-it text-post-it-text shadow-[var(--shadow-post-it)] backdrop:bg-black/40",
    header: "flex items-start justify-between gap-3 px-5 pb-2 pt-8",
    title: "font-heading text-h4 font-bold text-post-it-text",
    description: "mt-1 text-small text-post-it-muted",
    closeButton:
      "h-9 w-9 rounded-full text-xl text-post-it-muted hover:bg-post-it-fold focus-visible:outline-post-it-text",
    body: "px-5 pb-5 pt-1",
    footer:
      "flex flex-wrap justify-end gap-3 border-t border-dashed border-post-it-border px-5 py-4",
  },
};

export default function Modal({
  children,
  isOpen,
  onClose,
  title,
  description,
  footer,
  variant = "default",
  closeOnBackdrop = true,
  showCloseButton = true,
  className = "",
}) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  const styles = variantStyles[variant] ?? variantStyles.default;

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (isOpen && !dialog.open) {
      previousFocusRef.current = document.activeElement;
      dialog.showModal();

      const focusTarget = dialog.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusTarget instanceof HTMLElement) {
        focusTarget.focus();
      }
    }

    if (!isOpen && dialog.open) {
      dialog.close();

      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  const handleCancel = (event) => {
    event.preventDefault();
    onClose();
  };

  const handleBackdropClick = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = Array.from(
      dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("disabled"));

    if (focusableElements.length === 0) return;

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      className={`fixed inset-0 z-50 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] overflow-y-auto p-0 ${styles.dialog} ${className}`}
    >
      {variant === "postIt" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-5 w-24 -translate-x-1/2 -rotate-2 rounded-sm bg-post-it-tape shadow-sm"
        />
      )}

      <header className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>

          {description && (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          )}
        </div>

        {showCloseButton && (
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className={`inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${styles.closeButton}`}
          >
            ×
          </button>
        )}
      </header>

      <div className={styles.body}>{children}</div>

      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  );
}
