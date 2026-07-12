import { Resend } from "resend";

/**
 * Lazily creates a Resend client from env vars.
 * Configure RESEND_API_KEY and RESEND_FROM in .env.
 */
let client: Resend | null = null;

function getClient() {
  if (client) return client;

  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY in .env");
  }

  client = new Resend(RESEND_API_KEY);
  return client;
}

export async function sendEmail(to: string, subject: string, html: string) {
  const from = process.env.RESEND_FROM;
  if (!from) {
    throw new Error("RESEND_FROM is not configured in .env");
  }

  const resend = getClient();
  const { data, error } = await resend.emails.send({ from, to, subject, html });

  if (error) {
    throw new Error(`Resend failed to send email: ${error.message}`);
  }

  return data;
}
