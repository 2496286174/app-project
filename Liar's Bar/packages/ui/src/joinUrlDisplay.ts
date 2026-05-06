export function formatJoinAddress(joinUrl: string | null | undefined): string {
  const rawUrl = joinUrl?.trim();
  if (!rawUrl) {
    return '';
  }

  try {
    return new URL(rawUrl).origin;
  } catch {
    return rawUrl.replace(/\/login(?:[?#].*)?$/, '');
  }
}
