(function () {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const previewPanel = document.getElementById("previewPanel");
  const previewImg = document.getElementById("previewImg");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  const progressStatus = document.getElementById("progressStatus");
  const progressPercent = document.getElementById("progressPercent");
  const resultCard = document.getElementById("resultCard");
  const resultText = document.getElementById("resultText");
  const modeBadge = document.getElementById("modeBadge");
  const confidence = document.getElementById("confidence");
  const fontBtn = document.getElementById("fontBtn");
  const fontInput = document.getElementById("fontInput");
  const fontLabel = document.getElementById("fontLabel");
  const fontReRun = document.getElementById("fontReRun");
  const fontPrompt = document.getElementById("fontPrompt");
  const copyBtn = document.getElementById("copyBtn");
  const resetBtn = document.getElementById("resetBtn");
  const toast = document.getElementById("toast");

  let lastResult = "";
  let currentImageFile = null;
  let fontReady = false;
  let toastTimer = null;
  let running = false;

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function openFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast("Xin lỗi, vui lòng chọn một tệp hình ảnh hợp lệ.");
      return;
    }
    currentImageFile = file;
    fontReRun.hidden = true;
    fontPrompt.hidden = true;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewPanel.hidden = false;
      progressWrap.hidden = true;
      resultCard.hidden = true;
      progressBar.style.width = "0%";
      progressPercent.textContent = "0%";
      if (window.__sound) window.__sound.image();
      startTesseract();
    };
    reader.readAsDataURL(file);
  }

  function bindHooks() {
    OCRApp.setCallbacks({
      onProgress: ({ stage, percent, detail, total }) => {
        progressStatus.textContent = describeStage(stage, detail, total);
        const pct = Math.min(percent, 100);
        progressBar.style.width = pct + "%";
        progressPercent.textContent = pct + "%";
      },
      onComplete: (result) => {
        renderResult(result);
        running = false;
      },
      onError: () => {
        progressWrap.hidden = true;
        running = false;
        if (window.__sound) window.__sound.error();
        showToast("Có lỗi xảy ra khi nhận diện. Vui lòng thử ảnh khác.");
      },
    });
  }

  async function startTesseract() {
    if (running) return;
    running = true;
    progressWrap.hidden = false;
    resultCard.hidden = true;
    bindHooks();
    try {
      await OCRApp.recognize(currentImageFile);
    } catch (err) {
      console.error(err);
    }
  }

  async function startTemplate() {
    if (running) return;
    if (!fontReady) {
      showToast("Vui lòng tải file font trước.");
      return;
    }
    running = true;
    progressWrap.hidden = false;
    resultCard.hidden = true;
    bindHooks();
    if (window.__sound) window.__sound.click();
    try {
      await OCRApp.recognizeWithFont(currentImageFile);
    } catch (err) {
      console.error(err);
    }
  }

  function renderResult(result) {
    progressWrap.hidden = true;
    const isEmpty = !result.text;

    if (result.mode === "template") {
      modeBadge.hidden = false;
      modeBadge.textContent = "Chế độ font · " + result.chars + " ký tự";
    } else {
      let detail = "";
      if (result.psm) {
        const names = { 3: "Tự động", 4: "Một cột", 6: "Khối văn bản", 11: "Văn bản rời" };
        detail = names[result.psm] || "PSM " + result.psm;
      }
      if (result.variant) {
        const variants = {
          stretch: "tương phản",
          raw: "ảnh gốc",
          otsu: "nhị phân",
          clean: "làm sạch",
          otsuStretch: "nhị phân tương phản",
          otsuLow: "ngưỡng thấp",
          otsuHigh: "ngưỡng cao",
        };
        detail += (detail ? " · " : "") + (variants[result.variant] || result.variant);
      }
      modeBadge.hidden = false;
      modeBadge.textContent = "Tesseract" + (detail ? " · " + detail : "");
    }

    resultText.textContent = isEmpty ? "(Không tìm thấy văn bản trong ảnh.)" : result.text;
    confidence.textContent = isEmpty ? "" : "Độ tin cậy " + result.confidence + "%";
    confidence.style.color = result.confidence >= 70 ? "" : "#d97706";
    confidence.style.background = result.confidence >= 70 ? "" : "#fef3c7";
    resultCard.hidden = false;

    fontPrompt.hidden = !(isEmpty || result.confidence < 62);
    fontReRun.hidden = !(fontReady && !isEmpty);

    lastResult = result.text;
    if (isEmpty) {
      if (window.__sound) window.__sound.error();
      showToast("Rất tiếc, không phát hiện được chữ. Vui lòng thử ảnh khác hoặc tải font để nhận diện theo font.");
    } else {
      if (window.__sound) window.__sound.success();
    }
  }

  function describeStage(stage, detail, total) {
    if (stage === "preprocess") return "Đang phân tích và cải thiện ảnh";
    if (stage === "passes") return "Đang nhận diện · lượt " + detail + "/" + total;
    if (stage === "template") return "Đang đối chiếu từng ký tự với font";
    if (stage === "finalize") return "Đang chọn kết quả tốt nhất";
    return "Đang xử lý";
  }

  function onFileChosen() {
    openFile(fileInput.files && fileInput.files[0]);
    fileInput.value = "";
  }

  async function onFontChosen() {
    const file = fontInput.files && fontInput.files[0];
    if (!file) return;
    try {
      progressWrap.hidden = false;
      resultCard.hidden = true;
      progressStatus.textContent = "Đang nạp font và tạo bảng ký tự";
      progressBar.style.width = "40%";
      progressPercent.textContent = "40%";
      await OCRApp.loadFontFile(file);
      fontReady = true;
      fontLabel.textContent = "✅ Font đã tải: " + file.name;
      if (window.__sound) window.__sound.success();
      showToast("Font đã sẵn sàng. Nhấn 'Chạy lại bằng font' để nhận diện chính xác.");
    } catch (err) {
      fontReady = false;
      if (window.__sound) window.__sound.error();
      showToast("Không thể nạp font này. Vui lòng dùng file .ttf hoặc .otf hợp lệ.");
      console.error("Font load error:", err);
    } finally {
      progressWrap.hidden = true;
      fontInput.value = "";
    }
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", onFileChosen);

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragging");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragging");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    openFile(file);
  });

  fontBtn.addEventListener("click", () => fontInput.click());
  fontInput.addEventListener("change", onFontChosen);
  fontReRun.addEventListener("click", startTemplate);

  copyBtn.addEventListener("click", async () => {
    if (!lastResult) return;
    try {
      await navigator.clipboard.writeText(lastResult);
      if (window.__sound) window.__sound.click();
      showToast("Đã sao chép kết quả vào bộ nhớ tạm.");
    } catch {
      showToast("Không thể sao chép. Vui lòng bôi đen và sao chép thủ công.");
    }
  });

  resetBtn.addEventListener("click", () => {
    previewPanel.hidden = true;
    fileInput.value = "";
    currentImageFile = null;
    lastResult = "";
    fontReRun.hidden = true;
    fontPrompt.hidden = true;
    if (window.__sound) window.__sound.click();
  });
})();