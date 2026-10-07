import Card from "../shared/Card/Card.component";
import { useAppName } from "../app/instanceAssets";

export default function PrivacyPage() {
  const appName = useAppName();
  return (
    <div className="mx-auto max-w-3xl py-8">
      <Card className="flex flex-col gap-4">
        <h1 className="font-heading text-h2 font-bold text-heading">Privacy Policy</h1>
        <p className="text-body leading-normal text-foreground">
          {appName} is a learning platform. This Privacy Policy describes what data the service
          collects and how it is used.
        </p>
        <h2 className="font-heading text-h4 font-bold text-heading">What we collect</h2>
        <ul className="list-inside list-disc space-y-1 text-body text-foreground">
          <li>Your name, email address, and hashed password.</li>
          <li>Your lesson progress and quiz attempts.</li>
          <li>Basic session cookies required to keep you logged in.</li>
        </ul>
        <h2 className="font-heading text-h4 font-bold text-heading">What we don't do</h2>
        <ul className="list-inside list-disc space-y-1 text-body text-foreground">
          <li>We don't sell or share your data with third parties.</li>
          <li>We don't run third-party ad networks.</li>
        </ul>
        <p className="text-body leading-normal text-foreground">
          Questions? Contact the administrator for this instance.
        </p>
      </Card>
    </div>
  );
}
