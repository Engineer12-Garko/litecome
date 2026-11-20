export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

export function safeOutputName(name) {
  const base = name.replace(/\.[^/.]+$/, "").replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim() || "video";
  return `${base}-litecompress.mp4`;
}

export function isLikelyVideo(file) {
  return file.type?.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg|3gp)$/i.test(file.name);
}

export async function fingerprintFile(file) {
  if (!globalThis.crypto?.subtle || !file?.slice) return null;
  const size = Math.min(file.size, 2 * 1024 * 1024);
  const parts = [
    file.slice(0, size),
    file.size > size ? file.slice(Math.max(0, file.size - size), file.size) : null
  ].filter(Boolean);
  const chunks = await Promise.all(parts.map((part) => part.arrayBuffer()));
  const combined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function estimateOutputSize(fileSize, duration, presetKey, history = []) {
  const ratioByPreset = { high: 0.72, balanced: 0.52, small: 0.36 };
  const relevant = history.filter((entry) => entry.preset === presetKey && entry.originalSize && entry.outputSize);
  if (relevant.length) {
    const ratios = relevant.slice(-8).map((entry) => entry.outputSize / entry.originalSize);
    const ratio = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    const low = Math.max(0.05, ratio * 0.75) * fileSize;
    const high = ratio * 1.25 * fileSize;
    return { low, high };
  }
  const base = ratioByPreset[presetKey] || 0.52;
  const durationFactor = duration ? Math.max(0.75, Math.min(1.25, duration / 600)) : 1;
  return { low: fileSize * base * durationFactor * 0.75, high: fileSize * base * durationFactor * 1.25 };
}
