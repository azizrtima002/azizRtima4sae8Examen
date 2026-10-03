/**
 * Send email alerts for offers found since the previous run.
 * Runs right after the scrapers in the scheduled GitHub Actions workflow.
 *
 *   npm run alerts              # send emails (console output without RESEND_API_KEY)
 *   npm run alerts -- --dry-run # only print what would be sent
 */
import { PrismaClient } from "@prisma/client";
import { collectDigests, renderDigestEmail } from "../src/lib/alerts";
import { sendEmail } from "../src/lib/email";

// Resend's free plan allows 100 emails a day and this job runs twice a day.
const MAX_EMAILS_PER_RUN = Number(process.env.MAX_EMAILS_PER_RUN ?? 45);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const prisma = new PrismaClient();
  const runStart = new Date();
  let sent = 0;
  let failed = 0;
  let deferred = 0;

  try {
    const digests = await collectDigests(prisma, runStart);
    for (const digest of digests) {
      if (digest.matches.length > 0) {
        if (sent >= MAX_EMAILS_PER_RUN) {
          deferred += 1; // window not advanced: will be sent next run
          continue;
        }
        const email = renderDigestEmail(digest, appUrl);
        if (dryRun) {
          console.info(`[dry-run] ${digest.email}: ${email.subject}`);
          sent += 1;
          continue;
        }
        try {
          await sendEmail({ to: digest.email, ...email });
          sent += 1;
        } catch (error) {
          failed += 1;
          console.error(`[alerts] failed to email ${digest.email}:`, error);
          continue; // keep the window open so the offers are retried
        }
      }
      if (!dryRun) {
        await prisma.savedSearch.updateMany({
          where: { id: { in: digest.searchIds } },
          data: { lastNotifiedAt: runStart },
        });
      }
    }
    console.info(
      `[alerts] ${digests.length} users checked, ${sent} emails ${dryRun ? "would be " : ""}sent, ${failed} failed, ${deferred} deferred`,
    );
  } finally {
    await prisma.$disconnect();
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
