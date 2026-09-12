const OCRApp = (() => {
  let worker = null;
  let busy = false;
  const callbacks = {
    onProgress: null,
    onComplete: null,
    onError: null,
  };

  const LANGUAGE = "vie";
  const PSM_BEST = 6;
  const PSM_FALLBACK = 3;
  const activeWindow = { low: 0, high: 100 };

  function resolveLangPath() {
    try {
      return new URL("tessdata/", document.baseURI).href;
    } catch {
      return "tessdata";
    }
  }

  async function getWorker() {
    if (worker) return worker;
    worker = await Tesseract.createWorker(LANGUAGE, 1, {
      langPath: resolveLangPath(),
      gzip: false,
      logger: (m) => {
        if (m.status === "recognizing text" && callbacks.onProgress) {
          const raw = Math.round((m.progress || 0) * 100);
          const pct =
            activeWindow.low +
            Math.round((raw / 100) * (activeWindow.high - activeWindow.low));
          callbacks.onProgress({ stage: m.status, percent: pct });
        }
      },
    });
    await worker.setParameters({
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
    });
    return worker;
  }

  function setCallbacks(hooks) {
    Object.assign(callbacks, hooks);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  async function preprocess(file) {
    const { img, url } = await loadImage(file);
    try {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      let scale = 2;
      if (srcW >= 1500) scale = 1.5;
      const w = Math.round(srcW * scale);
      const h = Math.round(srcH * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      const pixelCount = w * h;
      const lum = new Uint8ClampedArray(pixelCount);

      let min = 255;
      let max = 0;
      for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
        const l = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
        lum[i] = l;
        if (l < min) min = l;
        if (l > max) max = l;
      }

      let lo = min;
      let hi = max;
      if (hi - lo < 32) {
        lo = 0;
        hi = 255;
      }
      const span = hi - lo || 1;
      const gain = 255 / span;

      for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
        const v = (lum[i] - lo) * gain;
        const g = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
        d[p] = g;
        d[p + 1] = g;
        d[p + 2] = g;
      }

      ctx.putImageData(imageData, 0, 0);

      return await new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function runPass(blob, psm, window) {
    const w = await getWorker();
    await w.setParameters({ tessedit_pageseg_mode: String(psm) });
    activeWindow.low = window.low;
    activeWindow.high = window.high;
    const { data } = await w.recognize(blob);
    return {
      text: data.text.trim(),
      confidence: Number(data.confidence.toFixed(1)),
      psm,
    };
  }

  async function loadFile(file) {
    if (busy) {
      throw new Error("Một tác vụ OCR đang chạy. Vui lòng đợi kết quả hiện tại.");
    }
    busy = true;
    try {
      if (callbacks.onProgress) callbacks.onProgress({ stage: "preprocess", percent: 2 });
      const processed = await preprocess(file);

      const pass1 = await runPass(processed, PSM_BEST, { low: 20, high: 55 });
      const results = [pass1];

      if (pass1.text) {
        const pass2 = await runPass(processed, PSM_FALLBACK, { low: 60, high: 95 });
        results.push(pass2);
      }

      const best = results.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      if (callbacks.onComplete) callbacks.onComplete(best);
      return best;
    } catch (err) {
      if (callbacks.onError) callbacks.onError(err);
      throw err;
    } finally {
      busy = false;
    }
  }

  function terminate() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
  }

  return { loadFile, setCallbacks, terminate };
})();