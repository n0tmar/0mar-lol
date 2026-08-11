/**
 * Runs once when a Next.js server instance starts, before it accepts
 * requests. Used for one-shot maintenance: orphaned upload cleanup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { cleanupOrphanedUploads } = await import("./lib/uploads");
    await cleanupOrphanedUploads();
  } catch (error) {
    console.error("Orphan upload cleanup failed.", error);
  }
}
