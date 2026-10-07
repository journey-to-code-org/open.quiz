export default function Button({
  children,
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  as: Component = "button",
  size: _size,
  ...props
}) {
  const isDisabled = disabled || loading;
  const styles = {
    primary:
      "border-primary bg-primary text-on-primary shadow-sm hover:bg-primary-hover focus:border-primary focus:ring-primary/20",
    secondary:
      "border-neutral-300 bg-surface-app text-heading shadow-sm hover:bg-surface-inset focus:border-primary focus:ring-primary/20",
    ghost:
      "border-transparent bg-transparent text-primary shadow-none hover:bg-surface-inset focus:border-primary focus:ring-primary/20",
    quiz: "border-primary bg-primary text-on-primary shadow-[var(--shadow-quiz)] hover:bg-primary-hover focus:border-primary focus:ring-primary/20",
    quizSecondary:
      "border-neutral-300 bg-surface-raised text-heading shadow-[var(--shadow-quiz-secondary)] hover:bg-surface-inset focus:border-primary focus:ring-primary/20",
    circleCompleted:
      "border-learning-path-node-border bg-learning-path-node-completed text-heading shadow-sm hover:brightness-95 focus:border-primary focus:ring-primary/20",
    circleCurrent:
      "border-learning-path-node-current bg-learning-path-node-current text-on-primary shadow-sm hover:brightness-90 focus:border-primary focus:ring-primary/20",
    circleDisabled:
      "border-learning-path-node-current bg-learning-path-node-current text-on-primary shadow-sm hover:brightness-90 focus:border-primary focus:ring-primary/20",
  };

  const circleClass =
    "border h-[4.5rem] w-[4.5rem] rounded-full p-0 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

  const baseClass =
    "border inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold leading-none transition-all duration-200 focus:outline-none focus:ring-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Component
      type={Component === "button" ? type : undefined}
      disabled={Component === "button" ? isDisabled : undefined}
      aria-busy={loading || undefined}
      className={
        variant === "circleCompleted" || variant === "circleCurrent" || variant === "circleDisabled"
          ? `${circleClass} ${styles[variant]} ${className}`.trim()
          : `${baseClass} ${styles[variant] || styles.primary} ${className}`.trim()
      }
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span>{loading ? "Loading..." : children}</span>
    </Component>
  );
}
