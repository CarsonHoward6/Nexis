export type UploadProgress = { loaded: number; total: number; pct: number };

export async function putWithProgress(
  url: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  if (url.startsWith("mock://")) {
    // Simulate an upload against the mock backend.
    return new Promise((resolve) => {
      const total = file.size;
      let loaded = 0;
      const tick = () => {
        loaded = Math.min(total, loaded + Math.max(total / 20, 100_000));
        onProgress?.({ loaded, total, pct: loaded / total });
        if (loaded < total) setTimeout(tick, 80);
        else resolve();
      };
      setTimeout(tick, 80);
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      onProgress?.({ loaded: e.loaded, total: e.total, pct: e.loaded / e.total });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export async function fileToDataUrl(file: File, maxDim = 320): Promise<string | undefined> {
  if (!file.type.startsWith("image/") || /cr2|cr3|nef|arw|dng|raf|rw2|orf/i.test(file.type)) {
    return undefined;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(undefined);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(undefined);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}
