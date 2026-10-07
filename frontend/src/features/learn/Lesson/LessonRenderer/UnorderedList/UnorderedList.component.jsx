function UnorderedList({ content }) {
  return (
    <div className="space-y-4">
      {content.intro && <p className="text-lg text-foreground">{content.intro}</p>}

      <div className="rounded-xl bg-surface-inset p-6">
        <ul className="space-y-3">
          {content.items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-primary" />

              <span className="text-lg text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default UnorderedList;
