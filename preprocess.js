const Pre = (() => {
  function scaledSize(srcW, srcH) {
    let scale = 2;
    if (srcW >= 1500) scale = 1.5;
    if (srcW >= 2400) scale = 1.25;
    return { w: Math.round(srcW * scale), h: Math.round(srcH * scale) };
  }

  function canvasFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas
          .getContext("2d", { willReadFrequently: true })
          .drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  function scaledCopy(src) {
    const { w, h } = scaledSize(src.width, src.height);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    return c;
  }

  function cloneCanvas(src) {
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    c.getContext("2d", { willReadFrequently: true }).drawImage(src, 0, 0);
    return c;
  }

  function gray(src) {
    const c = cloneCanvas(src);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function contrastStretch(src) {
    const c = cloneCanvas(src);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const n = c.width * c.height;
    let min = 255;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const v = d[i * 4];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    let lo = min;
    let hi = max;
    if (hi - lo < 32) {
      lo = 0;
      hi = 255;
    }
    const span = hi - lo || 1;
    const gain = 255 / span;
    for (let i = 0; i < n; i++) {
      const idx = i * 4;
      let v = (d[idx] - lo) * gain;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function luminanceHistogram(src) {
    const ctx = src.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, src.width, src.height);
    const hist = new Uint32Array(256);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      hist[Math.round(d[i])]++;
    }
    return hist;
  }

  function otsuThreshold(src) {
    const hist = luminanceHistogram(src);
    const total = src.width * src.height;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let bestVar = 0;
    let threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > bestVar) {
        bestVar = varBetween;
        threshold = t;
      }
    }
    return threshold;
  }

  function binarize(src, threshold) {
    const c = cloneCanvas(src);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const ink = d[i] < threshold ? 0 : 255;
      d[i] = ink;
      d[i + 1] = ink;
      d[i + 2] = ink;
      d[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function isDarkBackground(src) {
    const hist = luminanceHistogram(src);
    let sum = 0;
    let n = 0;
    for (let t = 0; t < 256; t++) {
      sum += t * hist[t];
      n += hist[t];
    }
    if (!n) return false;
    return sum / n < 128;
  }

  function invert(src) {
    const c = cloneCanvas(src);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  function cleanup(binCanvas) {
    const width = binCanvas.width;
    const height = binCanvas.height;
    const ctx = binCanvas.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, width, height);
    const d = id.data;
    const total = width * height;
    const ink = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      ink[i] = d[i * 4] < 128 ? 1 : 0;
    }

    const background = new Uint8Array(total);
    const stack = [];
    for (let x = 0; x < width; x++) {
      for (const y of [0, height - 1]) {
        const idx = y * width + x;
        if (!ink[idx] && !background[idx]) {
          background[idx] = 1;
          stack.push(idx);
        }
      }
    }
    for (let y = 0; y < height; y++) {
      for (const x of [0, width - 1]) {
        const idx = y * width + x;
        if (!ink[idx] && !background[idx]) {
          background[idx] = 1;
          stack.push(idx);
        }
      }
    }
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % width;
      const y = (idx / width) | 0;
      const neigh = [];
      if (x > 0) neigh.push(idx - 1);
      if (x < width - 1) neigh.push(idx + 1);
      if (y > 0) neigh.push(idx - width);
      if (y < height - 1) neigh.push(idx + width);
      for (const ni of neigh) {
        if (!ink[ni] && !background[ni]) {
          background[ni] = 1;
          stack.push(ni);
        }
      }
    }

    for (let i = 0; i < total; i++) {
      if (!ink[i] && !background[i]) ink[i] = 1;
    }

    const label = new Int32Array(total);
    let compId = 0;
    const comps = [];
    const queue = new Int32Array(total);
    for (let i = 0; i < total; i++) {
      if (!ink[i] || label[i] !== 0) continue;
      compId++;
      let qh = 0;
      let qt = 0;
      queue[qt++] = i;
      label[i] = compId;
      let area = 0;
      while (qh < qt) {
        const idx = queue[qh++];
        area++;
        const x = idx % width;
        const y = (idx / width) | 0;
        const nb = [];
        if (x > 0 && !label[idx - 1] && ink[idx - 1]) nb.push(idx - 1);
        if (x < width - 1 && !label[idx + 1] && ink[idx + 1]) nb.push(idx + 1);
        if (y > 0 && !label[idx - width] && ink[idx - width]) nb.push(idx - width);
        if (y < height - 1 && !label[idx + width] && ink[idx + width]) nb.push(idx + width);
        for (const ni of nb) {
          label[ni] = compId;
          queue[qt++] = ni;
        }
      }
      comps.push(area);
    }

    const minArea = Math.max(4, Math.round(width * height * 0.00002));
    for (let i = 0; i < total; i++) {
      const l = label[i];
      if (l > 0 && comps[l - 1] < minArea) {
        ink[i] = 0;
      }
    }

    for (let i = 0; i < total; i++) {
      const v = ink[i] ? 0 : 255;
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
    return binCanvas;
  }

  function toBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  return {
    canvasFromFile,
    scaledCopy,
    gray,
    contrastStretch,
    otsuThreshold,
    binarize,
    cleanup,
    isDarkBackground,
    invert,
    toBlob,
  };
})();