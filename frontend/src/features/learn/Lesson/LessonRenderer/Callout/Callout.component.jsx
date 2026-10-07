function Callout({ content }) {
  return (
    <div className="my-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
      <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
        Key Takeaway
      </div>

      <p className="text-lg font-medium text-heading">{content.text}</p>
    </div>
  );
}

export default Callout;
