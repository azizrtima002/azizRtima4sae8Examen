export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Send an email through Resend's HTTP API. Without RESEND_API_KEY (local
 * development, CI) the message is printed instead of sent.
 */
export async function sendEmail(message: EmailMessage): Promise<{ id: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "StageFinder TN <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(`[email:console] to=${message.to} subject="${message.subject}"\n${message.text}\n`);
    return { id: null };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
  });
  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as { id?: string };
  return { id: data.id ?? null };
}
