const OCRApp = (() => {
  let worker = null;
  let busy = false;
  const callbacks = {
    onProgress: null,
    onComplete: null,
    onError: null,
  };

  const LANGUAGE = "vie";
  const EARLY_EXIT = 88;

  const PASSES = [
    { variant: "stretch", psm: 6 },
    { variant: "stretch", psm: 3 },
    { variant: "stretch", psm: 4 },
    { variant: "raw", psm: 6 },
    { variant: "raw", psm: 3 },
    { variant: "otsu", psm: 6 },
    { variant: "otsu", psm: 3 },
    { variant: "clean", psm: 6 },
    { variant: "clean", psm: 3 },
    { variant: "otsuStretch", psm: 6 },
    { variant: "otsuLow", psm: 6 },
    { variant: "otsuHigh", psm: 6 },
  ];

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
      logger: () => {},
    });
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_do_invert: "0",
    });
    return worker;
  }

  function setCallbacks(hooks) {
    Object.assign(callbacks, hooks);
  }

  function buildVariants(src) {
    let base = Pre.scaledCopy(src);
    const inverted = Pre.isDarkBackground(base);
    if (inverted) base = Pre.invert(base);

    const grayRoot = Pre.gray(base);
    const stretch = Pre.contrastStretch(grayRoot);
    const t = Pre.otsuThreshold(grayRoot);
    const tStretch = Pre.otsuThreshold(stretch);

    return {
      stretch,
      raw: grayRoot,
      otsu: Pre.binarize(grayRoot, t),
      clean: Pre.cleanup(Pre.binarize(grayRoot, t)),
      otsuStretch: Pre.binarize(stretch, tStretch),
      otsuLow: Pre.binarize(grayRoot, Math.max(1, Math.round(t * 0.85))),
      otsuHigh: Pre.binarize(grayRoot, Math.min(254, Math.round(t * 1.15))),
    };
  }

  async function runPass(blob, psm) {
    const w = await getWorker();
    await w.setParameters({ tessedit_pageseg_mode: String(psm) });
    const { data } = await w.recognize(blob);
    return {
      text: data.text.trim(),
      confidence: Number(data.confidence.toFixed(1)),
      psm,
    };
  }

  async function recognize(file, hooks) {
    if (hooks) setCallbacks(hooks);
    if (busy) {
      throw new Error("Một tác vụ OCR đang chạy. Vui lòng đợi kết quả hiện tại.");
    }
    busy = true;
    try {
      if (callbacks.onProgress) callbacks.onProgress({ stage: "preprocess", percent: 1 });
      const src = await Pre.canvasFromFile(file);
      const variants = buildVariants(src);

      let best = null;
      for (let i = 0; i < PASSES.length; i++) {
        const pass = PASSES[i];
        const low = 8 + i * 7;
        const high = low + 7;
        const blob = await Pre.toBlob(variants[pass.variant]);
        const res = await runPass(blob, pass.psm);

        if (res.text) {
          if (!best || res.confidence > best.confidence) {
            best = { ...res, variant: pass.variant };
          }
        }
        if (callbacks.onProgress) {
          callbacks.onProgress({
            stage: "passes",
            percent: Math.min(high, 96),
            detail: i + 1,
            total: PASSES.length,
          });
        }
        if (best && best.confidence >= EARLY_EXIT) break;
      }

      if (callbacks.onProgress) callbacks.onProgress({ stage: "finalize", percent: 98 });

      let finalResult;
      if (best) {
        finalResult = {
          text: best.text,
          confidence: best.confidence,
          psm: best.psm,
          variant: best.variant,
          mode: "tesseract",
        };
      } else {
        finalResult = {
          text: "",
          confidence: 0,
          psm: null,
          variant: null,
          mode: "tesseract",
          empty: true,
        };
      }
      if (callbacks.onComplete) callbacks.onComplete(finalResult);
      return finalResult;
    } catch (err) {
      if (callbacks.onError) callbacks.onError(err);
      throw err;
    } finally {
      busy = false;
    }
  }

  async function recognizeWithFont(file, hooks) {
    if (hooks) setCallbacks(hooks);
    if (busy) {
      throw new Error("Một tác vụ OCR đang chạy. Vui lòng đợi kết quả hiện tại.");
    }
    busy = true;
    try {
      if (callbacks.onProgress) callbacks.onProgress({ stage: "preprocess", percent: 2 });
      const src = await Pre.canvasFromFile(file);
      const text = await new Promise((resolve) => {
        const res = TemplateOCR.recognize(src, (pct) => {
          if (callbacks.onProgress) {
            callbacks.onProgress({
              stage: "template",
              percent: Math.min(8 + Math.round(pct * 0.88), 96),
            });
          }
        });
        resolve(res);
      });

      const correctedText = DictCorrect.correct(text.text);
      const result = {
        text: correctedText,
        confidence: text.confidence,
        mode: "template",
        chars: TemplateOCR.getTemplateCount(),
      };
      if (callbacks.onComplete) callbacks.onComplete(result);
      return result;
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

  return { recognize, recognizeWithFont, loadFontFile: (f) => TemplateOCR.loadFont(f), setCallbacks, terminate };
})();