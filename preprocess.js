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

  function adaptiveThreshold(src, blockSize, C) {
    const c = cloneCanvas(src);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const d = id.data;
    const w = c.width;
    const h = c.height;

    const integral = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      const yOff = y * w;
      for (let x = 0; x < w; x++) {
        rowSum += d[(yOff + x) * 4];
        integral[yOff + x] = rowSum + (y > 0 ? integral[yOff - w + x] : 0);
      }
    }

    const at = (y, x) => (y < 0 || x < 0 ? 0 : integral[y * w + x]);

    const half = blockSize >> 1;
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y1 = Math.max(0, y - half);
      const y2 = Math.min(h - 1, y + half);
      const yOff = y * w;
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - half);
        const x2 = Math.min(w - 1, x + half);
        const sum = at(y2, x2) - at(y2, x1 - 1) - at(y1 - 1, x2) + at(y1 - 1, x1 - 1);
        const area = (x2 - x1 + 1) * (y2 - y1 + 1);
        const mean = sum / area;
        out[yOff + x] = d[(yOff + x) * 4] <= mean - C ? 0 : 255;
      }
    }

    for (let i = 0; i < out.length; i++) {
      const idx = i * 4;
      d[idx] = out[i];
      d[idx + 1] = out[i];
      d[idx + 2] = out[i];
      d[idx + 3] = 255;
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

  function textRegions(binCanvas) {
    const width = binCanvas.width;
    const height = binCanvas.height;
    const ctx = binCanvas.getContext("2d", { willReadFrequently: true });
    const d = ctx.getImageData(0, 0, width, height).data;
    const total = width * height;
    const ink = new Uint8Array(total);
    for (let i = 0; i < total; i++) ink[i] = d[i * 4] < 128 ? 1 : 0;

    const label = new Int32Array(total);
    const queue = new Int32Array(total);
    const comps = [];
    let compId = 0;
    for (let i = 0; i < total; i++) {
      if (!ink[i] || label[i]) continue;
      compId++;
      let qh = 0;
      let qt = 0;
      queue[qt++] = i;
      label[i] = compId;
      let area = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      while (qh < qt) {
        const idx = queue[qh++];
        area++;
        const x = idx % width;
        const y = (idx / width) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const s = idx - 1;
        const e = idx + 1;
        const u = idx - width;
        const dn = idx + width;
        if (x > 0 && !label[s] && ink[s]) {
          label[s] = compId;
          queue[qt++] = s;
        }
        if (x < width - 1 && !label[e] && ink[e]) {
          label[e] = compId;
          queue[qt++] = e;
        }
        if (y > 0 && !label[u] && ink[u]) {
          label[u] = compId;
          queue[qt++] = u;
        }
        if (y < height - 1 && !label[dn] && ink[dn]) {
          label[dn] = compId;
          queue[qt++] = dn;
        }
      }
      comps.push({ area, minX, maxX, minY, maxY });
    }

    const minH = Math.max(5, height * 0.005);
    const maxH = height * 0.4;
    const minW = Math.max(2, width * 0.002);
    const glyphs = [];
    for (const c of comps) {
      const cw = c.maxX - c.minX + 1;
      const ch = c.maxY - c.minY + 1;
      if (ch < minH || ch > maxH) continue;
      if (cw < minW) continue;
      if (cw / ch > 8 || cw / ch < 0.03) continue;
      glyphs.push(c);
    }
    if (!glyphs.length) return [];

    glyphs.sort((a, b) => a.minY - b.minY);
    const lines = [];
    let cur = { minX: glyphs[0].minX, maxX: glyphs[0].maxX, minY: glyphs[0].minY, maxY: glyphs[0].maxY };
    for (let i = 1; i < glyphs.length; i++) {
      const c = glyphs[i];
      const curH = cur.maxY - cur.minY + 1;
      const cH = c.maxY - c.minY + 1;
      const minHp = Math.min(curH, cH);
      const overlap = Math.min(cur.maxY, c.maxY) - Math.max(cur.minY, c.minY);
      if (overlap > minHp * 0.4 || c.minY - cur.maxY < minHp * 0.9) {
        cur.minX = Math.min(cur.minX, c.minX);
        cur.maxX = Math.max(cur.maxX, c.maxX);
        cur.minY = Math.min(cur.minY, c.minY);
        cur.maxY = Math.max(cur.maxY, c.maxY);
      } else {
        lines.push(cur);
        cur = { minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY };
      }
    }
    lines.push(cur);

    const pad = 8;
    return lines.map((l) => ({
      x: Math.max(0, l.minX - pad),
      y: Math.max(0, l.minY - pad),
      w: Math.min(width - 1, l.maxX + pad) - Math.max(0, l.minX - pad) + 1,
      h: Math.min(height - 1, l.maxY + pad) - Math.max(0, l.minY - pad) + 1,
    }));
  }

  function focusText(src) {
    const bin = adaptiveThreshold(src, 41, 12);
    const regions = textRegions(bin);
    if (!regions.length) return bin;
    const width = bin.width;
    const height = bin.height;
    const ctx = bin.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, width, height);
    const d = id.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let inside = false;
        for (const r of regions) {
          if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
            inside = true;
            break;
          }
        }
        if (!inside || d[idx] >= 128) {
          d[idx] = 255;
          d[idx + 1] = 255;
          d[idx + 2] = 255;
        }
      }
    }
    ctx.putImageData(id, 0, 0);

    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    for (const r of regions) {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.w);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.h);
    }
    const ox = Math.max(0, minX - 12);
    const oy = Math.max(0, minY - 12);
    const cw = Math.min(width - ox, maxX + 12 - ox);
    const ch = Math.min(height - oy, maxY + 12 - oy);
    const out = document.createElement("canvas");
    out.width = Math.max(1, cw);
    out.height = Math.max(1, ch);
    out.getContext("2d", { willReadFrequently: true }).drawImage(bin, ox, oy, cw, ch, 0, 0, cw, ch);
    return out;
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
    adaptiveThreshold,
    textRegions,
    focusText,
    cleanup,
    isDarkBackground,
    invert,
    toBlob,
  };
})();