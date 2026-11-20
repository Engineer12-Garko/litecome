export class JobQueue {
  constructor(processJob) {
    this.processJob = processJob;
    this.jobs = [];
    this.running = false;
    this.cancelled = false;
  }

  setJobs(jobs) {
    this.jobs = jobs.filter((job) => job.status !== "complete");
  }

  async run(onChange) {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;
    try {
      for (const job of this.jobs) {
        if (this.cancelled) break;
        if (job.status === "complete") continue;
        await this.processJob(job, onChange);
      }
    } finally {
      this.running = false;
    }
  }

  stop() {
    this.cancelled = true;
    this.running = false;
  }
}
