import { FileManager } from "./file-manager.js";
import { CompressionEngine } from "./compression-engine.js";
import { JobQueue } from "./job-queue.js";
import { PreviewManager } from "./preview.js";
import { presets } from "./presets.js";
import { escapeHtml, formatBytes, safeOutputName, fingerprintFile, estimateOutputSize } from "./utils.js";
import { deleteJob, getJobs, getSource, putJob, putSource, putHistory, getHistory } from "./persistence-store.js";
import { deleteJobFiles, opfsSupported, segmentExists, writeSegment } from "./checkpoint-store.js";

const elements = {
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  browseButton: document.querySelector("#browseButton"),
  workspace: document.querySelector("#workspace"),
  fileCount: document.querySelector("#fileCount"),
  clearButton: document.querySelector("#clearButton"),
  presetSelect: document.querySelector("#presetSelect"),
  compressButton: document.querySelector("#compressButton"),
  cancelButton: document.querySelector("#cancelButton"),
  jobList: document.querySelector("#jobList"),
  toastRegion: document.querySelector("#toastRegion"),
  previewModal: document.querySelector("#previewModal"),
  previewTitle: document.querySelector("#previewTitle"),
  originalPreview: document.querySelector("#originalPreview"),
  compressedPreview: document.querySelector("#compressedPreview"),
  progressSummary: document.querySelector("#progressSummary"),
  elapsedTime: document.querySelector("#elapsedTime"),
  remainingTime: document.querySelector("#remainingTime"),
  encodingFps: document.querySelector("#encodingFps"),
  batchEta: document.querySelector("#batchEta"),
  estimateRow: document.querySelector("#estimateRow"),
  estimateText: document.querySelector("#estimateText"),
  savedJobsSection: document.querySelector("#savedJobsSection"),
  savedJobsList: document.querySelector("#savedJobsList")
};

const preview = new PreviewManager();
const engine = new CompressionEngine();
const jobs = [];
const inFlightFiles = new Set();
let queue = null;
let elapsedEncodingMs = 0;
let encodingStartedAt = 0;
let historyResults = [];
let pendingReselectId = null;

function toast(message, type = "") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  elements.toastRegion.append(item);
  setTimeout(() => item.remove(), 4200);
}

function readMetadata(file) {
  return new Promise((resolve) => {
    const url = preview.create(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    let settled = false;
    const finish = (metadata) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(metadata);
      video.removeAttribute("src");
      video.load();
    };
    const timeout = setTimeout(() => {
      finish({ duration: null, width: null, height: null });
    }, 15000);
    video.onloadedmetadata = () => {
      finish({
        duration: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null
      });
    };
    video.onerror = () => finish({ duration: null, width: null, height: null });
    video.src = url;
  });
}

function formatDuration(seconds) {
  if (!seconds) return "Unknown duration";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function serializeJob(job) {
  return {
    id: job.id,
    filename: job.file.name,
    originalSize: job.originalSize,
    duration: job.duration,
    width: job.width,
    height: job.height,
    frameRate: job.frameRate,
    fingerprint: job.fingerprint,
    presetKey: job.presetKey,
    preset: job.preset,
    segmentLength: job.segmentLength,
    totalSegments: job.totalSegments,
    completedSegments: [...job.completedSegments],
    currentSegment: job.currentSegment,
    completedProcessingMs: job.completedProcessingMs,
    lastCheckpointAt: job.lastCheckpointAt,
    estimatedOutputSize: job.estimatedOutputSize,
    actualOutputSize: job.outputSize,
    status: job.status,
    progress: job.progress,
    updatedAt: Date.now()
  };
}

function formatClock(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "Calculating...";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateEstimate(job) {
  elements.estimateRow.hidden = false;
  const estimate = job?.estimatedOutputSize;
  if (!estimate) {
    elements.estimateText.textContent = "Calculating estimate...";
    return;
  }
  elements.estimateText.textContent =
    `${formatBytes(estimate.low)} - ${formatBytes(estimate.high)} estimated`;
}

function renderJob(job) {
  const card = document.querySelector(`[data-job-id="${job.id}"]`);
  if (!card) return;
  card.querySelector(".progress-bar").style.width = `${job.progress}%`;
  card.querySelector(".progress-bar").classList.toggle("animated", job.status === "processing");
  card.querySelector(".progress-text").textContent =
    job.status === "complete" ? "Complete" :
    job.status === "error" ? "Failed" :
    job.status === "processing" ? `${job.progress}%` : "Waiting";

  if (job.status === "complete") {
    const comparison = card.querySelector(".size-comparison");
    const reduction = job.originalSize > 0
      ? Math.round((1 - job.outputSize / job.originalSize) * 100)
      : 0;
    const sizeLabel = reduction > 0
      ? `<span class="saved">${reduction}% smaller</span>`
      : reduction < 0
        ? `<span class="saved warning">${Math.abs(reduction)}% larger</span>`
        : `<span>Same size</span>`;
    comparison.innerHTML =
      `<span>${formatBytes(job.originalSize)}</span><span>→</span><strong>${formatBytes(job.outputSize)}</strong>` +
      sizeLabel;
  }

  if (job.status === "error") {
    card.querySelector(".job-meta").innerHTML = `<strong>${escapeHtml(job.error)}</strong>`;
  }

  const actions = card.querySelector(".job-actions");
  if (job.status === "complete" && !actions.querySelector(".download-button")) {
    const link = document.createElement("a");
    link.className = "download-button";
    link.href = job.outputUrl;
    link.download = safeOutputName(job.file.name);
    link.textContent = "Download";
    actions.prepend(link);
  }
  if (!actions.querySelector(".preview-button")) {
    const previewButton = document.createElement("button");
    previewButton.className = "preview-button";
    previewButton.type = "button";
    previewButton.textContent = "Preview";
    previewButton.addEventListener("click", () => openPreview(job));
    actions.append(previewButton);
  }
}

async function addFiles(files) {
  const known = new Set(jobs.map((job) => `${job.file.name}:${job.file.size}:${job.file.lastModified}`));
  const additions = [];
  let accepted = 0;

  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (known.has(key) || inFlightFiles.has(key)) continue;
    known.add(key);
    inFlightFiles.add(key);
    accepted++;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    file.__jobId = id;
    additions.push(
      Promise.all([readMetadata(file), fingerprintFile(file)])
        .then(async ([metadata, fingerprint]) => {
          if (pendingReselectId) {
            const savedId = pendingReselectId;
            const saved = (await getJobs()).find((entry) => entry.id === savedId);
            if (saved?.fingerprint && saved.fingerprint !== fingerprint) {
              toast("The reselected file does not match the saved source.", "error");
              return null;
            }
            if (saved) {
              await putSource(savedId, file);
              pendingReselectId = null;
              toast("Original source verified. Saved job is ready to resume.");
              await resumeSavedJob(savedId);
              return null;
            }
          }
          const segmentLength = 30;
          const totalSegments = metadata.duration
            ? Math.max(1, Math.ceil(metadata.duration / segmentLength))
            : 1;
          const presetKey = elements.presetSelect.value;
          const estimate = estimateOutputSize(file.size, metadata.duration, presetKey, historyResults);
          const job = {
            id,
            file,
            status: "queued",
            progress: 0,
            originalSize: file.size,
            outputSize: null,
            estimatedOutputSize: estimate,
            outputUrl: null,
            outputBlob: null,
            error: null,
            fingerprint,
            frameRate: null,
            presetKey,
            preset: { ...presets[presetKey] },
            segmentLength,
            totalSegments,
            completedSegments: [],
            currentSegment: 0,
            completedProcessingMs: 0,
            lastCheckpointAt: null,
            ...metadata
          };
          try {
            await putSource(id, file);
            await putJob(serializeJob(job));
          } catch (error) {
            job.persistenceAvailable = false;
          }
          return job;
        })
        .finally(() => inFlightFiles.delete(key))
    );
  }

  const addedJobs = (await Promise.all(additions)).filter(Boolean);
  jobs.push(...addedJobs);
  if (accepted) {
    elements.workspace.hidden = false;
    renderAllJobs();
    updateEstimate(addedJobs[0]);
  }
  if (accepted >= 1) toast(`${accepted} video${accepted === 1 ? "" : "s"} ready`);
  if (files.length > 20) toast("Large batches may take significant time. They are processed one at a time.", "error");
  if (files.some((file) => file.size > 500 * 1024 * 1024)) {
    toast("A 500 MB+ video may require substantial browser memory.", "error");
  }
}

function renderAllJobs() {
  elements.fileCount.textContent = `${jobs.length} video${jobs.length === 1 ? "" : "s"}`;
  elements.jobList.innerHTML = jobs.map((job) => `
    <article class="job-card" data-job-id="${job.id}">
      <video class="video-preview" src="${preview.create(job.file)}" muted controls preload="metadata"></video>
      <div class="job-info">
        <h3 class="job-name" title="${escapeHtml(job.file.name)}">${escapeHtml(job.file.name)}</h3>
        <p class="job-meta">
          ${formatDuration(job.duration)} · ${job.width && job.height ? `${job.width}×${job.height} · ` : ""}${formatBytes(job.originalSize)}
        </p>
        <div class="size-comparison">
          <span>Waiting to compress</span>
        </div>
        <div class="progress-wrap">
          <div class="progress-track"><div class="progress-bar"></div></div>
          <div class="progress-label"><span>Progress</span><span class="progress-text">Waiting</span></div>
        </div>
      </div>
      <div class="job-actions">
        <button class="icon-button remove-button" type="button" aria-label="Remove ${escapeHtml(job.file.name)}">
          <svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg>
        </button>
      </div>
    </article>
  `).join("");

  elements.jobList.querySelectorAll(".remove-button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".job-card");
      removeJob(card.dataset.jobId);
    });
  });

  jobs.forEach(renderJob);
}

function removeJob(id) {
  const index = jobs.findIndex((job) => job.id === id);
  if (index < 0) return;
  const [job] = jobs.splice(index, 1);
  if (job.status === "processing") engine.cancel(id);
  if (job.outputUrl) URL.revokeObjectURL(job.outputUrl);
  preview.revoke(job.file);
  if (!jobs.length) {
    elements.workspace.hidden = true;
  } else {
    renderAllJobs();
  }
}

function openPreview(job) {
  elements.previewTitle.textContent = job.file.name;
  elements.originalPreview.src = preview.create(job.file);
  elements.originalPreview.load();
  elements.compressedPreview.removeAttribute("src");
  if (job.outputUrl) {
    elements.compressedPreview.src = job.outputUrl;
  }
  elements.compressedPreview.load();
  elements.previewModal.hidden = false;
  document.body.classList.add("modal-open");
  elements.previewModal.querySelector(".preview-modal-header [data-close-preview]").focus();
}

function closePreview() {
  elements.previewModal.hidden = true;
  document.body.classList.remove("modal-open");
  elements.originalPreview.pause();
  elements.compressedPreview.pause();
  elements.originalPreview.removeAttribute("src");
  elements.compressedPreview.removeAttribute("src");
  elements.originalPreview.load();
  elements.compressedPreview.load();
}

async function persistJobState(job) {
  try {
    await putJob(serializeJob(job));
  } catch (error) {
    job.persistenceAvailable = false;
  }
}

function updateElapsedUi(job) {
  const elapsed = job.completedProcessingMs +
    (job.status === "processing" ? performance.now() - encodingStartedAt : 0);
  elements.elapsedTime.textContent = `Elapsed ${formatClock(elapsed)}`;
  const progress = Math.max(job.progress, 1);
  const remainingMs = (elapsed / progress) * (100 - progress);
  elements.remainingTime.textContent =
    job.status === "processing"
      ? `Remaining ${formatClock(remainingMs)}`
      : "Remaining calculating...";
  const segmentDurationProcessed = job.duration
    ? (job.duration * progress / 100)
    : 0;
  const fps = elapsed > 0 ? segmentDurationProcessed / (elapsed / 1000) : 0;
  elements.encodingFps.textContent =
    fps > 0 ? `Encoding ${fps.toFixed(1)}x realtime` : "Encoding calculating...";
  elements.batchEta.textContent =
    job.status === "processing"
      ? `Batch ETA ${formatClock(remainingMs)}`
      : "Batch ETA calculating...";
}

async function completeJob(job, result) {
  job.outputBlob = result.blob;
  job.outputSize = result.size;
  job.outputUrl = URL.createObjectURL(result.blob);
  job.outputBlob = null;
  job.status = "complete";
  job.progress = 100;
  job.lastCheckpointAt = Date.now();
  await persistJobState(job);
  putHistory(job.presetKey, {
    key: `${job.presetKey}-${job.width || 0}x${job.height || 0}`,
    preset: job.presetKey,
    originalSize: job.originalSize,
    outputSize: job.outputSize
  });
  const estimate = estimateOutputSize(job.originalSize, job.duration, job.presetKey, [{
    preset: job.presetKey,
    originalSize: job.originalSize,
    outputSize: job.outputSize
  }]);
  job.estimatedOutputSize = estimate;
  elements.estimateRow.hidden = false;
  elements.estimateText.textContent = `Actual output ${formatBytes(job.outputSize)} (${job.outputSize < job.originalSize ? "estimated range used" : "output larger than source"})`;
  elements.remainingTime.textContent = "Remaining complete";
  elements.batchEta.textContent = "Batch ETA complete";
  await deleteJobFiles(job.id);
}

function failOrAbortJob(job, error) {
  if (error?.name === "AbortError") {
    job.status = "paused";
    job.progress = Math.max(job.progress, 0);
  } else {
    job.status = "error";
    job.error = error.message || "Compression failed.";
  }
  persistJobState(job);
}

async function processJob(job, preset) {
  job.status = "processing";
  job.progress = 0;
  job.presetKey = elements.presetSelect.value;
  job.preset = { ...preset };
  encodingStartedAt = performance.now();
  renderJob(job);
  elements.progressSummary.hidden = false;

  if (!opfsSupported() || !job.duration) {
    try {
      const result = await engine.compress(job.file, preset, (message) => {
        if (message.id !== job.id) return;
        if (message.type === "progress") {
          const nextProgress = Math.max(job.progress, Math.min(100, message.progress));
          if (nextProgress !== job.progress) {
            job.progress = nextProgress;
            renderJob(job);
            updateElapsedUi(job);
          }
        }
      });
      await completeJob(job, result);
    } catch (error) {
      failOrAbortJob(job, error);
    }
    renderJob(job);
    return;
  }

  try {
    const segmentStartMs = performance.now();
    for (let index = 0; index < job.totalSegments; index++) {
      if (await segmentExists(job.id, index) && !job.completedSegments.includes(index)) {
        job.completedSegments.push(index);
        job.progress = Math.round((job.completedSegments.length / job.totalSegments) * 100);
        await persistJobState(job);
      }
      if (job.completedSegments.includes(index)) continue;
      encodingStartedAt = performance.now();
      const start = index * job.segmentLength;
      const duration = Math.min(job.segmentLength, job.duration - start);
      const segmentId = `${job.id}-segment-${index}`;
      job.currentSegment = index;
      job.status = "processing";
      await persistJobState(job);

      const result = await engine.compressSegment(job.file, preset, {
        id: segmentId,
        index,
        start,
        duration
      }, (message) => {
        if (message.id !== segmentId) return;
        if (message.type === "progress") {
          const segmentFraction = message.progress / 100;
          const completed = job.completedSegments.length;
          const overall = Math.round(((completed + segmentFraction) / job.totalSegments) * 100);
          if (overall > job.progress) {
            job.progress = overall;
            renderJob(job);
          }
          updateElapsedUi(job);
        }
      });

      await writeSegment(job.id, index, result.blob);
      if (!job.completedSegments.includes(index)) job.completedSegments.push(index);
      job.progress = Math.round((job.completedSegments.length / job.totalSegments) * 100);
      job.lastCheckpointAt = Date.now();
      job.completedProcessingMs += performance.now() - segmentStartMs;
      segmentStartMs = performance.now();
      await persistJobState(job);
      renderJob(job);
      updateElapsedUi(job);
    }

    job.status = "assembling";
    await persistJobState(job);
    const assembled = await engine.assemble(job.id, job.totalSegments, () => {});
    await completeJob(job, assembled);
  } catch (error) {
    failOrAbortJob(job, error);
  }
  renderJob(job);
}

async function startBatch() {
  if (queue?.running) return;
  const pending = jobs.filter((job) => job.status !== "complete");
  if (!pending.length) {
    toast("All videos are already compressed.");
    return;
  }

  elements.compressButton.disabled = true;
  elements.compressButton.querySelector("span").textContent = "Compressing...";
  elements.cancelButton.hidden = false;
  const batchPreset = { ...presets[elements.presetSelect.value] };
  queue = new JobQueue((job) => processJob(job, batchPreset));
  queue.setJobs(jobs);
  await queue.run(renderJob);
  elements.compressButton.disabled = false;
  elements.compressButton.querySelector("span").textContent = "Compress all";
  elements.cancelButton.hidden = true;

  if (queue.cancelled) return;
  const failures = jobs.filter((job) => job.status === "error").length;
  if (failures) toast(`${failures} video${failures === 1 ? "" : "s"} could not be compressed.`, "error");
  else toast("Batch compression complete.");
}

const fileManager = new FileManager(addFiles, (message) => toast(message, "error"));
fileManager.bind(elements.fileInput, elements.dropZone, elements.browseButton);

async function loadSavedJobs() {
  try {
    historyResults = await getHistory();
  } catch {}
  let saved;
  try {
    saved = await getJobs();
  } catch {
    return;
  }
  if (!saved?.length) {
    elements.savedJobsSection.hidden = true;
    return;
  }
  elements.savedJobsSection.hidden = false;
  elements.savedJobsList.innerHTML = saved.map((job) => {
    const status = job.status === "processing" ? "interrupted" : job.status;
    const completed = job.completedSegments?.length || 0;
    return `
      <article class="job-card saved-job" data-saved-id="${escapeHtml(job.id)}">
        <div class="job-info">
          <h3 class="job-name">${escapeHtml(job.filename)}</h3>
          <p class="job-meta">${formatBytes(job.originalSize)} · ${escapeHtml(job.presetKey || "balanced")} · ${completed}/${job.totalSegments || 1} segments · ${escapeHtml(status)}</p>
          <div class="progress-track"><div class="progress-bar" style="width:${job.progress || 0}%"></div></div>
        </div>
        <div class="job-actions">
          <button class="download-button resume-saved" type="button">Resume</button>
          <button class="preview-button restart-saved" type="button">Restart</button>
          <button class="preview-button remove-saved" type="button">Remove</button>
        </div>
      </article>
    `;
  }).join("");

  elements.savedJobsList.querySelectorAll(".saved-job").forEach((card) => {
    const id = card.dataset.savedId;
    card.querySelector(".resume-saved").addEventListener("click", () => resumeSavedJob(id));
    card.querySelector(".restart-saved").addEventListener("click", () => resumeSavedJob(id, true));
    card.querySelector(".remove-saved").addEventListener("click", () => removeSavedJob(id));
  });
}

async function resumeSavedJob(id, restart = false) {
  let saved;
  try {
    saved = (await getJobs()).find((job) => job.id === id);
  } catch {
    toast("Saved job metadata could not be opened.", "error");
    return;
  }
  if (!saved) return;
  const file = await getSource(id);
  if (!file) {
    toast("The original video is missing. Reselect the original file to verify recovery.", "error");
    pendingReselectId = id;
    elements.fileInput.click();
    return;
  }
  const fingerprint = await fingerprintFile(file);
  if (saved.fingerprint && fingerprint !== saved.fingerprint) {
    toast("The reselected file does not match the saved source.", "error");
    return;
  }
  file.__jobId = id;
  if (restart) {
    saved.completedSegments = [];
    saved.currentSegment = 0;
    saved.progress = 0;
    saved.completedProcessingMs = 0;
    await deleteJobFiles(id);
  }
  const job = {
    ...saved,
    id,
    file,
    originalSize: saved.originalSize,
    filename: saved.filename,
    status: restart ? "queued" : "interrupted",
    outputUrl: null,
    outputBlob: null,
    outputSize: saved.actualOutputSize,
    presetKey: saved.presetKey,
    preset: saved.preset,
    completedSegments: saved.completedSegments || []
  };
  if (!jobs.some((existing) => existing.id === id)) {
    jobs.push(job);
  }
  elements.workspace.hidden = false;
  renderAllJobs();
  toast(restart ? "Saved job restarted from the beginning." : "Your compression is saved. Resume available.");
  startJob(job);
}

async function removeSavedJob(id) {
  await deleteJobFiles(id);
  await deleteJob(id);
  await loadSavedJobs();
  toast("Saved job and checkpoints removed.");
}

async function startJob(job) {
  const preset = job.preset || presets[job.presetKey || "balanced"];
  await processJob(job, preset);
}

elements.clearButton.addEventListener("click", () => {
  queue?.stop();
  engine.terminate();
  for (const job of jobs) {
    preview.revoke(job.file);
    if (job.outputUrl) URL.revokeObjectURL(job.outputUrl);
  }
  jobs.splice(0);
  elements.jobList.innerHTML = "";
  elements.workspace.hidden = true;
  elements.compressButton.disabled = false;
  elements.compressButton.querySelector("span").textContent = "Compress all";
  elements.cancelButton.hidden = true;
});

elements.compressButton.addEventListener("click", startBatch);
elements.cancelButton.addEventListener("click", () => {
  queue?.stop();
  engine.cancelAll();
  elements.cancelButton.hidden = true;
  toast("Compression cancelled. Your completed videos are still available.");
});

elements.previewModal.querySelectorAll("[data-close-preview]").forEach((element) => {
  element.addEventListener("click", closePreview);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.previewModal.hidden) closePreview();
});

window.addEventListener("beforeunload", () => {
  engine.terminate();
  preview.revokeAll(jobs.map((job) => job.file));
  jobs.forEach((job) => job.outputUrl && URL.revokeObjectURL(job.outputUrl));
});

elements.presetSelect.addEventListener("change", () => {
  if (!jobs.length) return;
  const job = jobs.find((entry) => entry.status !== "complete");
  if (!job) return;
  job.presetKey = elements.presetSelect.value;
  job.preset = { ...presets[job.presetKey] };
  job.estimatedOutputSize = estimateOutputSize(job.originalSize, job.duration, job.presetKey, historyResults);
  updateEstimate(job);
  persistJobState(job);
});

async function checkStorage() {
  if (navigator.storage?.persist) {
    try { await navigator.storage.persist(); } catch {}
  }
  if (!navigator.storage?.estimate) return;
  try {
    const estimate = await navigator.storage.estimate();
    const available = (estimate.quota || 0) - (estimate.usage || 0);
    if (available < 256 * 1024 * 1024) {
      toast("Storage is low. Compression checkpoints may not persist.", "error");
    }
  } catch {}
}

loadSavedJobs();
checkStorage();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
