import { useEffect } from "react";

const variantClasses = {
  default: "border-neutral-300 bg-surface-input text-foreground",
  success: "border-primary bg-primary text-on-primary",
  badge: "border-primary-alt bg-surface-inset text-heading",
  xp: "border-yellow-400 bg-yellow-100 text-yellow-900 dark:border-yellow-500/60 dark:bg-yellow-950 dark:text-yellow-100",
};

export default function Toast({
  isOpen,
  message,
  onClose,
  duration = 5000,
  variant = "default",
  action,
  showCloseButton = true,
  className = "",
}) {
  // Automatically close the toast after the set duration
  useEffect(() => {
    if (!isOpen || duration <= 0) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, variant, message, duration, onClose]);

  // Don't show anything if the toast is closed
  if (!isOpen) return null;

  // Determine the styles for the toast based on its variant
  const styles = variantClasses[variant] || variantClasses.default;

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-3 shadow-lg sm:bottom-6 ${styles} ${className}`}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 font-medium"
      >
        {message}
      </div>

      {action && <div className="shrink-0">{action}</div>}

      {showCloseButton && (
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={onClose}
          className="h-11 w-11 shrink-0 rounded-md text-2xl text-current transition-colors hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          ×
        </button>
      )}
    </div>
  );
}
