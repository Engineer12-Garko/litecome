import { isLikelyVideo } from "./utils.js";

export class FileManager {
  constructor(onFiles, onWarning) {
    this.onFiles = onFiles;
    this.onWarning = onWarning;
  }

  bind(input, dropZone, browseButton) {
    this.input = input;
    browseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      input.click();
    });
    dropZone.addEventListener("click", () => input.click());
    dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      this.accept(input.files);
      input.value = "";
    });

    ["dragenter", "dragover"].forEach((type) => {
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach((type) => {
      dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        dropZone.classList.remove("dragover");
      });
    });
    dropZone.addEventListener("drop", (event) => this.accept(event.dataTransfer?.files));
  }

  accept(fileList) {
    if (!fileList?.length) return;
    const files = Array.from(fileList).filter(isLikelyVideo);
    const rejected = fileList.length - files.length;
    if (rejected) this.onWarning(`${rejected} unsupported file${rejected === 1 ? "" : "s"} was skipped.`);
    if (!files.length) return;
    this.onFiles(files);
  }
}
