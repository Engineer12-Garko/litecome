export const presets = {
  high: {
    label: "High Quality",
    crf: "18",
    maxRate: "12M",
    bufSize: "18M",
    audioBitrate: "192k"
  },
  balanced: {
    label: "Balanced",
    crf: "23",
    maxRate: "5M",
    bufSize: "8M",
    audioBitrate: "128k"
  },
  small: {
    label: "Smaller File",
    crf: "28",
    maxRate: "3M",
    bufSize: "5M",
    audioBitrate: "96k"
  }
};
