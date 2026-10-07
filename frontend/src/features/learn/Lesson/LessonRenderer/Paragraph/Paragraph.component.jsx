function Paragraph({ content }) {
  return (
    <div className="max-w-prose text-center">
      <p className="text-lg text-center text-foreground">{content.text}</p>
    </div>
  );
}

export default Paragraph;
