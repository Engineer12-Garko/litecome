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
