export class JobQueue {
  constructor(processJob) {
    this.processJob = processJob;
    this.jobs = [];
    this.running = false;
  }

  setJobs(jobs) {
    this.jobs = jobs.filter((job) => job.status !== "complete");
  }

  async run(onChange) {
    if (this.running) return;
    this.running = true;
    try {
      for (const job of this.jobs) {
        if (job.status === "complete") continue;
        await this.processJob(job, onChange);
      }
    } finally {
      this.running = false;
    }
  }

  stop() {
    this.running = false;
  }
}
