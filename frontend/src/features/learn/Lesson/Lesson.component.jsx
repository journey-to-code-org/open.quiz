import LessonRenderer from "./LessonRenderer/LessonRenderer.component";
import LessonGuideCharacter from "../LessonGuideCharacter/LessonGuideCharacter.component";

function LessonComponent({
  title,
  eyebrow,
  content = [],
  module,
  blockRenderers,
  characterImage,
  characterAlt = "Lesson guide",
  bubbleText,
}) {
  // Filter out knowledge check content items from the visible content
  const visibleContent = content.filter((item) => item && item.type !== "knowledgeCheck");
  return (
    <div className="mt-8 space-y-8 text-center">
      <div className="space-y-2">
        {/* The eyebrow is the small text above the lesson title */}
        {eyebrow ? (
          <p className="text-small font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
        ) : null}
        {title ? <h2 className="font-heading text-h3 font-bold text-heading">{title}</h2> : null}
      </div>

      <LessonGuideCharacter
        imageSrc={characterImage}
        imageAlt={characterAlt}
        bubbleText={bubbleText}
      >
        {/* Map over the lesson content items */}
        {visibleContent.length > 0 ? (
          visibleContent.map((contentItem) => (
            <div key={contentItem.id}>
              <LessonRenderer
                content={contentItem}
                module={module}
                blockRenderers={blockRenderers}
              />
            </div>
          ))
        ) : (
          // If there is no visible content, display a message
          <p className="text-xl leading-relaxed text-foreground">This lesson is ready to review.</p>
        )}
      </LessonGuideCharacter>
    </div>
  );
}

export default LessonComponent;
