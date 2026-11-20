let ffmpeg = null;
let ffmpegModule = null;
let fetchFile = null;

async function loadFFmpeg() {
  if (ffmpeg) return;
  const [{ FFmpeg }, util] = await Promise.all([
    import("../vendor/ffmpeg/ffmpeg.js"),
    import("../vendor/util/util.js")
  ]);
  ffmpegModule = FFmpeg;
  fetchFile = util.fetchFile;
  ffmpeg = new FFmpeg();

  await ffmpeg.load({
    coreURL: new URL("../vendor/core/ffmpeg-core.js", import.meta.url).href,
    wasmURL: new URL("../vendor/core/ffmpeg-core.wasm", import.meta.url).href
  });
}

function extensionOf(name) {
  return (name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

self.onmessage = async (event) => {
  const { id, type, file, preset } = event.data;
  if (type !== "compress") return;

  const inputName = `input-${id}.${extensionOf(file.name)}`;
  const outputName = `output-${id}.mp4`;

  try {
    await loadFFmpeg();
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const progressListener = ({ progress }) => {
      const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
      self.postMessage({ id, type: "progress", progress: percent });
    };
    ffmpeg.on("progress", progressListener);

    const result = await ffmpeg.exec([
      "-i", inputName,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", preset.crf,
      "-maxrate", preset.maxRate,
      "-bufsize", preset.bufSize,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", preset.audioBitrate,
      "-movflags", "+faststart",
      "-y",
      outputName
    ]);

    ffmpeg.off("progress", progressListener);
    if (result !== 0) throw new Error("FFmpeg could not encode this video.");

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: "video/mp4" });
    self.postMessage({ id, type: "complete", blob, size: blob.size });
  } catch (error) {
    self.postMessage({ id, type: "error", message: error?.message || "Compression failed." });
  } finally {
    try { await ffmpeg?.deleteFile(inputName); } catch {}
    try { await ffmpeg?.deleteFile(outputName); } catch {}
  }
};
