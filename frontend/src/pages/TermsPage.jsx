import Card from "../shared/Card/Card.component";
import { useAppName } from "../app/instanceAssets";

export default function TermsPage() {
  const appName = useAppName();
  return (
    <div className="mx-auto max-w-3xl py-8">
      <Card className="flex flex-col gap-4">
        <h1 className="font-heading text-h2 font-bold text-heading">Terms of Service</h1>
        <p className="text-body leading-normal text-foreground">
          {appName} is provided for educational purposes. By using this service you agree to the
          following:
        </p>
        <ul className="list-inside list-disc space-y-2 text-body text-foreground">
          <li>You will use the site only for lawful, personal, non-commercial learning.</li>
          <li>You will not attempt to disrupt other learners' accounts or the service itself.</li>
          <li>
            You understand that learning materials are general and are not professional advice.
          </li>
        </ul>
        <p className="text-body leading-normal text-foreground">
          We may change these terms as the app evolves. Continued use after a change means you
          accept the update.
        </p>
      </Card>
    </div>
  );
}
