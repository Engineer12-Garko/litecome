import { FileManager } from "./file-manager.js";
import { CompressionEngine } from "./compression-engine.js";
import { JobQueue } from "./job-queue.js";
import { PreviewManager } from "./preview.js";
import { presets } from "./presets.js";
import { escapeHtml, formatBytes, safeOutputName } from "./utils.js";

const elements = {
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  browseButton: document.querySelector("#browseButton"),
  workspace: document.querySelector("#workspace"),
  fileCount: document.querySelector("#fileCount"),
  clearButton: document.querySelector("#clearButton"),
  presetSelect: document.querySelector("#presetSelect"),
  compressButton: document.querySelector("#compressButton"),
  jobList: document.querySelector("#jobList"),
  toastRegion: document.querySelector("#toastRegion")
};

const preview = new PreviewManager();
const engine = new CompressionEngine();
const jobs = [];
let queue = null;

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
    video.onloadedmetadata = () => {
      resolve({
        duration: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null
      });
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => resolve({ duration: null, width: null, height: null });
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

function renderJob(job) {
  const card = document.querySelector(`[data-job-id="${job.id}"]`);
  if (!card) return;
  if (job.status === "complete") {
    const previewVideo = card.querySelector(".video-preview");
    previewVideo.src = job.outputUrl;
  }
  card.querySelector(".progress-bar").style.width = `${job.progress}%`;
  card.querySelector(".progress-bar").classList.toggle("animated", job.status === "processing");
  card.querySelector(".progress-text").textContent =
    job.status === "complete" ? "Complete" :
    job.status === "error" ? "Failed" :
    job.status === "processing" ? `${job.progress}%` : "Waiting";

  if (job.status === "complete") {
    const comparison = card.querySelector(".size-comparison");
    const reduction = job.originalSize > 0 ? Math.max(0, Math.round((1 - job.outputSize / job.originalSize) * 100)) : 0;
    comparison.innerHTML =
      `<span>${formatBytes(job.originalSize)}</span><span>→</span><strong>${formatBytes(job.outputSize)}</strong>` +
      `<span class="saved">${reduction}% smaller</span>`;
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
}

async function addFiles(files) {
  const known = new Set(jobs.map((job) => `${job.file.name}:${job.file.size}:${job.file.lastModified}`));
  let accepted = 0;

  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (known.has(key)) continue;
    known.add(key);
    accepted++;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    file.__jobId = id;
    const metadata = await readMetadata(file);
    const job = {
      id,
      file,
      status: "queued",
      progress: 0,
      originalSize: file.size,
      outputSize: null,
      outputUrl: null,
      outputBlob: null,
      error: null,
      ...metadata
    };
    jobs.push(job);
  }

  if (accepted) {
    elements.workspace.hidden = false;
    renderAllJobs();
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
  if (job.outputUrl) URL.revokeObjectURL(job.outputUrl);
  preview.revoke(job.file);
  if (!jobs.length) {
    elements.workspace.hidden = true;
  } else {
    renderAllJobs();
  }
}

async function processJob(job) {
  job.status = "processing";
  job.progress = 0;
  renderJob(job);
  try {
    const result = await engine.compress(job.file, presets[elements.presetSelect.value], (message) => {
      if (message.id !== job.id) return;
      if (message.type === "progress") {
        job.progress = message.progress;
        renderJob(job);
      }
    });
    job.outputBlob = result.blob;
    job.outputSize = result.size;
    job.outputUrl = URL.createObjectURL(result.blob);
    job.outputBlob = null;
    job.status = "complete";
    job.progress = 100;
  } catch (error) {
    job.status = "error";
    job.error = error.message || "Compression failed.";
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
  queue = new JobQueue(processJob);
  queue.setJobs(jobs);
  await queue.run(renderJob);
  elements.compressButton.disabled = false;
  elements.compressButton.querySelector("span").textContent = "Compress all";

  const failures = jobs.filter((job) => job.status === "error").length;
  if (failures) toast(`${failures} video${failures === 1 ? "" : "s"} could not be compressed.`, "error");
  else toast("Batch compression complete.");
}

const fileManager = new FileManager(addFiles, (message) => toast(message, "error"));
fileManager.bind(elements.fileInput, elements.dropZone, elements.browseButton);

elements.clearButton.addEventListener("click", () => {
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
});

elements.compressButton.addEventListener("click", startBatch);
window.addEventListener("beforeunload", () => {
  engine.terminate();
  preview.revokeAll(jobs.map((job) => job.file));
  jobs.forEach((job) => job.outputUrl && URL.revokeObjectURL(job.outputUrl));
});
