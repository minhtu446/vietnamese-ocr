const OCRApp = (() => {
  let worker = null;
  let busy = false;
  const callbacks = {
    onProgress: null,
    onComplete: null,
    onError: null,
  };

  const LANGUAGE = "vie";
  const LANG_PATH = "tessdata";

  async function getWorker() {
    if (worker) return worker;
    worker = await Tesseract.createWorker(LANGUAGE, 1, {
      langPath: LANG_PATH,
      gzip: false,
      logger: (m) => {
        if (m.status === "recognizing text" && callbacks.onProgress) {
          const pct = Math.round((m.progress || 0) * 100);
          callbacks.onProgress({ stage: m.status, percent: pct });
        }
      },
    });
    return worker;
  }

  function setCallbacks(hooks) {
    Object.assign(callbacks, hooks);
  }

  async function loadFile(file) {
    if (busy) {
      throw new Error("Một tác vụ OCR đang chạy. Vui lòng đợi kết quả hiện tại.");
    }
    busy = true;
    try {
      const w = await getWorker();
      if (callbacks.onProgress) callbacks.onProgress({ stage: "init", percent: 0 });
      const { data } = await w.recognize(file);
      const confidence = Number(data.confidence.toFixed(1));
      const text = data.text.trim();
      if (callbacks.onComplete) callbacks.onComplete({ text, confidence });
      return { text, confidence };
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