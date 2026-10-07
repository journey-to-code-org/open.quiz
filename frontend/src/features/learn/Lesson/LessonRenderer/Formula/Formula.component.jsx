function Formula({ content }) {
  return (
    <div className="my-6 rounded-2xl border border-primary/25 bg-primary/5 p-6 shadow-sm">
      <div className="text-center text-2xl font-bold text-heading">{content.text}</div>
    </div>
  );
}

export default Formula;
