import { useState } from "react";

function LessonGuideCharacter({ imageSrc, imageAlt = "", bubbleText, children }) {
  const [failedImage, setFailedImage] = useState(null);
  const showImage = Boolean(imageSrc) && (import.meta.env.DEV || failedImage !== imageSrc);
  return (
    <div className="mx-auto max-w-xl">
      <div className="relative rounded-3xl border border-primary/25 bg-surface-raised px-5 py-6 text-left shadow-[0_12px_30px_rgba(6,30,25,0.1)] sm:px-8 sm:py-8">
        {showImage ? (
          <span
            aria-hidden="true"
            className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 border-b border-r border-primary/25 bg-surface-raised sm:left-20 sm:translate-x-0"
          />
        ) : null}

        {bubbleText ? (
          <p className="relative mb-4 font-heading text-lg font-bold text-primary">{bubbleText}</p>
        ) : null}

        <div className="relative space-y-4">{children}</div>
      </div>

      {showImage ? (
        <div className="mt-5 flex justify-center sm:justify-start sm:pl-7">
          <img
            src={imageSrc}
            alt={imageAlt}
            onError={() => {
              console.error(`Lesson character image failed to load: ${imageSrc}`);
              setFailedImage(imageSrc);
            }}
            className="relative z-10 w-full max-w-[11rem] drop-shadow-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

export default LessonGuideCharacter;
