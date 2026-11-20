const DB_NAME = "litecompress-jobs";
const DB_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("jobs")) db.createObjectStore("jobs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sources")) db.createObjectStore("sources", { keyPath: "id" });
      if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try {
      result = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(result?.result !== undefined ? result.result : result);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function putJob(job) {
  await transaction("jobs", "readwrite", (store) => store.put(job));
}

export async function getJobs() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("jobs", "readonly").objectStore("jobs").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteJob(jobId) {
  await transaction("jobs", "readwrite", (store) => store.delete(jobId));
  await transaction("sources", "readwrite", (store) => store.delete(jobId));
}

export async function putSource(jobId, file) {
  await transaction("sources", "readwrite", (store) => store.put({ id: jobId, file }));
}

export async function getSource(jobId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("sources", "readonly").objectStore("sources").get(jobId);
    request.onsuccess = () => resolve(request.result?.file || null);
    request.onerror = () => reject(request.error);
  });
}

export async function putHistory(key, result) {
  await transaction("history", "readwrite", (store) => store.put({ key, ...result, savedAt: Date.now() }));
}

export async function getHistory() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("history", "readonly").objectStore("history").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
