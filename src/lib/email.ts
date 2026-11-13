
type Mail = { to: string; subject: string; text: string };

/**
 * Transactional email seam. No provider is configured yet: in development the message
 * (including the reset link) is printed to the server console. Plug Resend/SMTP in here.
 */
export async function sendEmail(mail: Mail) {
  if (process.env.NODE_ENV === "production") {
    console.error("[email] no provider configured; message not sent to", mail.to);
    return;
  }
  console.info(`[email:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
}
