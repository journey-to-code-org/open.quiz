import { Link } from "react-router";
import Button from "../shared/Button/Button.component";
import { REPORT_BUG_LINK } from "../app/router/routes";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="text-6xl">🌱</p>
      <h1 className="font-heading text-h1 font-bold text-heading">Page not found</h1>
      <p className="text-body text-neutral-600">The page you're looking for doesn't exist.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button as={Link} to="/">
          Take me home
        </Button>
        <Button
          as="a"
          href={REPORT_BUG_LINK}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
        >
          Report a bug
        </Button>
      </div>
    </div>
  );
}
