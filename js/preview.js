export class PreviewManager {
  constructor() {
    this.urls = new Map();
  }

  create(file) {
    const existing = this.urls.get(file);
    if (existing) return existing;
    const url = URL.createObjectURL(file);
    this.urls.set(file, url);
    return url;
  }

  revoke(file) {
    const url = this.urls.get(file);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(file);
  }

  revokeAll(files) {
    files.forEach((file) => this.revoke(file));
  }
}
