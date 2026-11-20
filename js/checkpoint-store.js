export function opfsSupported() {
  return Boolean(navigator.storage?.getDirectory);
}

async function jobDirectory(jobId) {
  if (!opfsSupported()) throw new Error("OPFS is unavailable.");
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(`litecompress-${jobId}`, { create: true });
}

export async function writeSegment(jobId, index, blob) {
  if (!opfsSupported()) return false;
  const directory = await jobDirectory(jobId);
  const handle = await directory.getFileHandle(`segment-${String(index).padStart(5, "0")}.mp4`, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

export async function segmentExists(jobId, index) {
  if (!opfsSupported()) return false;
  try {
    const directory = await jobDirectory(jobId);
    await directory.getFileHandle(`segment-${String(index).padStart(5, "0")}.mp4`);
    return true;
  } catch {
    return false;
  }
}

export async function getSegment(jobId, index) {
  if (!opfsSupported()) return null;
  try {
    const directory = await jobDirectory(jobId);
    const handle = await directory.getFileHandle(`segment-${String(index).padStart(5, "0")}.mp4`);
    return await (await handle.getFile()).arrayBuffer();
  } catch {
    return null;
  }
}

export async function deleteJobFiles(jobId) {
  if (!opfsSupported()) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(`litecompress-${jobId}`, { recursive: true });
  } catch {}
}
