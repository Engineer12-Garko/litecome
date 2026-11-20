let ffmpeg = null;
let fetchFile = null;

async function loadFFmpeg() {
  if (ffmpeg) return;
  try {
    const [{ FFmpeg }, util] = await Promise.all([
      import("../vendor/ffmpeg/ffmpeg.js"),
      import("../vendor/util/util.js")
    ]);
    fetchFile = util.fetchFile;
    ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: new URL("../vendor/core/ffmpeg-core.js", import.meta.url).href,
      wasmURL: new URL("../vendor/core/ffmpeg-core.wasm", import.meta.url).href
    });
  } catch (error) {
    ffmpeg = null;
    throw error;
  }
}

function extensionOf(name) {
  return (name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

async function compressSegment({ id, file, preset, segment }) {
  const inputName = `segment-input-${id}.${extensionOf(file.name)}`;
  const outputName = `segment-output-${id}.mp4`;
  let progressListener = null;
  try {
    await loadFFmpeg();
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    progressListener = ({ progress }) => {
      const percent = Number.isFinite(progress)
        ? Math.max(0, Math.min(100, Math.round(progress * 100)))
        : 0;
      self.postMessage({ id, type: "progress", progress: percent });
    };
    ffmpeg.on("progress", progressListener);
    const result = await ffmpeg.exec([
      "-ss", String(segment.start),
      "-i", inputName,
      "-t", String(segment.duration),
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
      "-c:v", "libx264",
      "-preset", preset.encoderPreset || "faster",
      "-crf", preset.crf,
      "-maxrate", preset.maxRate,
      "-bufsize", preset.bufSize,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", preset.audioBitrate,
      "-reset_timestamps", "1",
      "-avoid_negative_ts", "make_zero",
      "-movflags", "+faststart",
      "-y",
      outputName
    ]);
    if (result !== 0) throw new Error("FFmpeg could not encode this segment.");
    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("FFmpeg produced an empty segment.");
    const exactBytes = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? data.buffer
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const blob = new Blob([exactBytes], { type: "video/mp4" });
    self.postMessage({ id, type: "segmentComplete", blob, size: blob.size, index: segment.index });
  } catch (error) {
    self.postMessage({ id, type: "error", message: error?.message || "Segment compression failed." });
  } finally {
    if (progressListener) {
      try { ffmpeg?.off("progress", progressListener); } catch {}
    }
    try { await ffmpeg?.deleteFile(inputName); } catch {}
    try { await ffmpeg?.deleteFile(outputName); } catch {}
  }
}

async function assembleSegments({ id, jobId, segmentCount }) {
  let names = [];
  try {
    await loadFFmpeg();
    if (!navigator.storage?.getDirectory) throw new Error("OPFS is unavailable for final assembly.");
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(`litecompress-${jobId}`);
    for (let index = 0; index < segmentCount; index++) {
      const name = `assembled-segment-${String(index).padStart(5, "0")}.mp4`;
      const handle = await directory.getFileHandle(`segment-${String(index).padStart(5, "0")}.mp4`);
      const file = await handle.getFile();
      await ffmpeg.writeFile(name, new Uint8Array(await file.arrayBuffer()));
      names.push(name);
    }
    const concatName = `concat-${jobId}.txt`;
    const concatText = names.map((name) => `file '${name}'`).join("\n");
    await ffmpeg.writeFile(concatName, new TextEncoder().encode(concatText));
    const outputName = `assembled-${jobId}.mp4`;
    const result = await ffmpeg.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", concatName,
      "-c", "copy",
      "-movflags", "+faststart",
      "-y",
      outputName
    ]);
    if (result !== 0) throw new Error("FFmpeg could not assemble completed segments.");
    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("Final assembly produced an empty file.");
    const exactBytes = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? data.buffer
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    self.postMessage({ id, type: "complete", blob: new Blob([exactBytes], { type: "video/mp4" }), size: exactBytes.byteLength });
  } catch (error) {
    self.postMessage({ id, type: "error", message: error?.message || "Segment assembly failed." });
  } finally {
    for (const name of names) {
      try { await ffmpeg?.deleteFile(name); } catch {}
    }
    try { await ffmpeg?.deleteFile(`concat-${jobId}.txt`); } catch {}
    try { await ffmpeg?.deleteFile(`assembled-${jobId}.mp4`); } catch {}
  }
}

self.onmessage = async (event) => {
  const { id, type, file, preset } = event.data;
  if (type === "compressSegment") {
    await compressSegment(event.data);
    return;
  }
  if (type === "assemble") {
    await assembleSegments(event.data);
    return;
  }
  if (type !== "compress") return;

  const inputName = `input-${id}.${extensionOf(file.name)}`;
  const outputName = `output-${id}.mp4`;
  let progressListener = null;

  try {
    await loadFFmpeg();
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    progressListener = ({ progress }) => {
      const percent = Number.isFinite(progress)
        ? Math.max(0, Math.min(100, Math.round(progress * 100)))
        : 0;
      self.postMessage({ id, type: "progress", progress: percent });
    };
    ffmpeg.on("progress", progressListener);

    const result = await ffmpeg.exec([
      "-i", inputName,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
      "-c:v", "libx264",
      "-preset", preset.encoderPreset || "faster",
      "-crf", preset.crf,
      "-maxrate", preset.maxRate,
      "-bufsize", preset.bufSize,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", preset.audioBitrate,
      "-map_metadata", "0",
      "-map_chapters", "-1",
      "-movflags", "+faststart",
      "-y",
      outputName
    ]);

    if (result !== 0) throw new Error("FFmpeg could not encode this video.");

    const data = await ffmpeg.readFile(outputName);
    if (!data?.length) throw new Error("FFmpeg produced an empty output.");
    const exactBytes = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? data.buffer
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const blob = new Blob([exactBytes], { type: "video/mp4" });
    self.postMessage({ id, type: "complete", blob, size: blob.size });
  } catch (error) {
    self.postMessage({ id, type: "error", message: error?.message || "Compression failed." });
  } finally {
    if (progressListener) {
      try { ffmpeg?.off("progress", progressListener); } catch {}
    }
    try { await ffmpeg?.deleteFile(inputName); } catch {}
    try { await ffmpeg?.deleteFile(outputName); } catch {}
  }
};
