const TemplateOCR = (() => {
  const GRID = 32;
  const MARGIN = 2;
  const VN_CHARS =
    "aăâbcdđeêghiklmnopqrstuưvwxy" +
    "AĂÂBCDĐEÊGHIKLMNOPQRSTUƯVWXY" +
    "ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ" +
    "ẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỴỲỶỸ" +
    "0123456789 .,!?;:'\"()+-*/=%@#$&_<>[]{}";

  let currentFontFamily = null;
  let templateDB = null;

  async function loadFont(file) {
    const buf = await file.arrayBuffer();
    const family = "ocr-userfont-" + Date.now();
    const font = new FontFace(family, buf);
    await font.load();
    document.fonts.add(font);
    currentFontFamily = family;
    templateDB = buildDB();
    return true;
  }

  function buildDB() {
    const size = 64;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const db = [];
    for (const ch of VN_CHARS) {
      if (ch === " " || ch === "\t") continue;
      ctx.font = size + "px " + currentFontFamily;
      const textW = Math.ceil(ctx.measureText(ch).width) + 12;
      canvas.width = Math.max(textW, 12);
      canvas.height = size + 16;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#000";
      ctx.textBaseline = "alphabetic";
      ctx.font = size + "px " + currentFontFamily;
      ctx.fillText(ch, 4, size - 6);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const bbox = inkBBox(id);
      if (!bbox) continue;
      const norm = normalizeGlyph(id, bbox);
      const feats = componentFeatures(id, bbox);
      db.push({ ch, norm, bbox, features: feats });
    }
    return db;
  }

  function inkBBox(imgData) {
    const d = imgData.data;
    const w = imgData.width;
    const h = imgData.height;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function normalizeGlyph(imgData, bbox) {
    const gw = GRID - MARGIN * 2;
    const out = new Float32Array(GRID * GRID);
    const sw = bbox.w;
    const sh = bbox.h;
    if (!sw || !sh) return out;
    const scale = Math.min(gw / sw, gw / sh);
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));
    const ox = MARGIN + Math.round((gw - dw) / 2);
    const oy = MARGIN + Math.round((gw - dh) / 2);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const sx = Math.min(sw - 1, Math.floor(x / scale));
        const sy = Math.min(sh - 1, Math.floor(y / scale));
        const srcIdx = ((bbox.y + sy) * imgData.width + bbox.x + sx) * 4;
        const a = imgData.data[srcIdx + 3];
        const g = imgData.data[srcIdx];
        const ink = Math.min(255, a) / 255;
        const lum = 1 - g / 255;
        out[(oy + y) * GRID + ox + x] = Math.max(ink, lum);
      }
    }
    return out;
  }

  function componentFeatures(imgData, bbox) {
    const norm = normalizeGlyph(imgData, bbox);
    const cells = 8;
    const cellSize = GRID / cells;
    const vec = [];
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        let sum = 0;
        for (let y = 0; y < cellSize; y++) {
          const row = Math.min(GRID - 1, cy * cellSize + y);
          for (let x = 0; x < cellSize; x++) {
            const col = Math.min(GRID - 1, cx * cellSize + x);
            sum += norm[row * GRID + col];
          }
        }
        vec.push(sum / (cellSize * cellSize));
      }
    }
    return { vec, norm };
  }

  function cosine(a, b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  function matchGlyph(features) {
    let bestChar = "?";
    let bestScore = -1;
    for (const t of templateDB) {
      const c = cosine(features.vec, t.features.vec);
      if (c > bestScore) {
        bestScore = c;
        bestChar = t.ch;
      }
    }
    return { ch: bestChar, confidence: bestScore };
  }

  function connectedComponents(binCanvas) {
    const width = binCanvas.width;
    const height = binCanvas.height;
    const ctx = binCanvas.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, width, height);
    const d = id.data;
    const total = width * height;
    const visited = new Uint8Array(total);
    const comps = [];
    const queue = new Int32Array(total);
    for (let i = 0; i < total; i++) {
      if (visited[i] || d[i * 4] >= 128) continue;
      let qh = 0;
      let qt = 0;
      queue[qt++] = i;
      visited[i] = 1;
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      let count = 0;
      while (qh < qt) {
        const idx = queue[qh++];
        count++;
        const x = idx % width;
        const y = (idx / width) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const nb = [];
        if (x > 0 && !visited[idx - 1] && d[(idx - 1) * 4] < 128) nb.push(idx - 1);
        if (x < width - 1 && !visited[idx + 1] && d[(idx + 1) * 4] < 128) nb.push(idx + 1);
        if (y > 0 && !visited[idx - width] && d[(idx - width) * 4] < 128) nb.push(idx - width);
        if (y < height - 1 && !visited[idx + width] && d[(idx + width) * 4] < 128) nb.push(idx + width);
        for (const ni of nb) {
          visited[ni] = 1;
          queue[qt++] = ni;
        }
      }
      comps.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, count });
    }
    return comps;
  }

  function groupLines(comps) {
    const sorted = comps.slice().sort((a, b) => a.y - b.y);
    const lines = [];
    for (const c of sorted) {
      const cTop = c.y;
      const cBottom = c.y + c.h;
      let placed = false;
      for (const line of lines) {
        const overlap =
          Math.min(cBottom, line.bottom) - Math.max(cTop, line.top);
        const minH = Math.min(c.h, line.height);
        if (minH > 0 && overlap / minH >= 0.5) {
          line.comps.push(c);
          line.top = Math.min(line.top, cTop);
          line.bottom = Math.max(line.bottom, cBottom);
          line.height = Math.max(line.height, c.h);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lines.push({ top: cTop, bottom: cBottom, height: c.h, comps: [c] });
      }
    }
    return lines;
  }

  function mergeMarks(line) {
    const comps = line.comps.slice().sort((a, b) => a.x - b.x);
    const medianH =
      comps
        .map((c) => c.h)
        .sort((a, b) => a - b)[Math.floor(comps.length / 2)] || 1;
    const small = comps.filter((c) => c.h <= medianH * 0.4);
    const main = comps.filter((c) => c.h > medianH * 0.4);

    const attached = [];
    for (const s of small) {
      const sCY = s.y + s.h / 2;
      const sCX = s.x + s.w / 2;
      let best = null;
      let bestOverlap = -1;
      for (const m of main) {
        const overlapX =
          Math.min(s.x + s.w, m.x + m.w) - Math.max(s.x, m.x);
        const overlapY =
          Math.min(s.y + s.h, m.y + m.h) - Math.max(s.y, m.y);
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX > bestOverlap) {
            bestOverlap = overlapX;
            best = m;
          }
        }
      }
      if (best) {
        attached.push({ s, m: best });
      } else if (s.h <= medianH * 0.4 && sCY > line.top + line.height * 0.45) {
        attached.push({ s, m: null });
      }
    }

    for (const { s, m } of attached) {
      if (m) {
        m.x = Math.min(m.x, s.x);
        m.y = Math.min(m.y, s.y);
        m.w = Math.max(m.w + m.x, s.x + s.w) - m.x;
        m.h = Math.max(m.h + m.y, s.y + s.h) - m.y;
      } else {
        main.push(s);
      }
    }

    return main
      .filter((m) => m.w > 1 && m.h > 1)
      .sort((a, b) => a.x - b.x);
  }

  function recognize(canvas, onProgress) {
    if (!templateDB) return { text: "", confidence: 0 };
    let grayCanvas = Pre.gray(canvas);
    if (Pre.isDarkBackground(grayCanvas)) {
      grayCanvas = Pre.invert(grayCanvas);
    }
    const threshold = Pre.otsuThreshold(grayCanvas);
    let bin = Pre.binarize(grayCanvas, threshold);
    bin = Pre.cleanup(bin);

    const comps = connectedComponents(bin);
    const lines = groupLines(comps);
    let total = 0;
    const glyphs = [];
    for (const line of lines) {
      const chars = mergeMarks(line);
      const widths = chars.map((c) => c.w);
      const medianW =
        widths.sort((a, b) => a - b)[Math.floor(widths.length / 2)] || 1;
      let prevEnd = null;
      for (const ch of chars) {
        if (prevEnd !== null && ch.x - prevEnd > medianW * 0.45) {
          glyphs.push({ space: true });
        }
        glyphs.push({ box: ch, line });
        prevEnd = ch.x + ch.w;
        total++;
      }
      glyphs.push({ newline: true });
    }

    let text = "";
    let scoreSum = 0;
    let scoreN = 0;
    let processed = 0;
    let currentLineText = "";

    const ctx = bin.getContext("2d", { willReadFrequently: true });
    const id = ctx.getImageData(0, 0, bin.width, bin.height);

    for (const g of glyphs) {
      if (g.space) {
        currentLineText += " ";
        continue;
      }
      if (g.newline) {
        text += currentLineText + "\n";
        currentLineText = "";
        continue;
      }
      const { box } = g;
      const features = componentFeatures(id, box);
      const match = matchGlyph(features);
      currentLineText += match.ch;
      scoreSum += match.confidence;
      scoreN++;
      processed++;
      if (onProgress) onProgress(Math.round((processed / (total + 1)) * 100));
    }
    text += currentLineText;

    const confidence = scoreN ? Math.round((scoreSum / scoreN) * 100) : 0;
    return { text: text.trim(), confidence };
  }

  function getTemplateCount() {
    return templateDB ? templateDB.length : 0;
  }

  return { loadFont, recognize, getTemplateCount, buildDB };
})();