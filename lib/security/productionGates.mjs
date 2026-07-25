const APPROVED_IMAGE_HOSTS = new Set(["cdn.sofifa.net"]);

export function isAllowedImageProxyUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase();
    return (
      APPROVED_IMAGE_HOSTS.has(hostname) ||
      hostname.endsWith(".supabase.co")
    );
  } catch {
    return false;
  }
}

export function isDebugWriteAllowed(nodeEnv) {
  return nodeEnv !== "production";
}
