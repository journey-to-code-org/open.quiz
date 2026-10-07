const BREVO_URL = process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";

const sendVerificationEmail = async (to, subject, text, html) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || "noreply@example.com";
  const fromName = process.env.FROM_NAME || "open.quiz";

  if (!apiKey) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[email:dev] ${subject} -> ${to}\n${text}`);
    }
    return { skipped: true };
  }

  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Brevo request failed (${response.status}): ${body}`);
    error.code = response.status;
    throw error;
  }

  return response.json();
};
module.exports = { sendVerificationEmail };
