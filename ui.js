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
  const confidence = document.getElementById("confidence");
  const copyBtn = document.getElementById("copyBtn");
  const resetBtn = document.getElementById("resetBtn");
  const toast = document.getElementById("toast");

  let lastResult = "";
  let toastTimer = null;

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  }

  function openFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast("Xin lỗi, vui lòng chọn một tệp hình ảnh hợp lệ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewPanel.hidden = false;
      progressWrap.hidden = true;
      resultCard.hidden = true;
      progressBar.style.width = "0%";
      progressPercent.textContent = "0%";
      if (window.__sound) window.__sound.image();
      startOCR(file);
    };
    reader.readAsDataURL(file);
  }

  async function startOCR(file) {
    progressWrap.hidden = false;
    resultCard.hidden = true;

    OCRApp.setCallbacks({
      onProgress: ({ stage, percent }) => {
        progressStatus.textContent = describeStage(stage);
        const pct = Math.min(percent, 100);
        progressBar.style.width = pct + "%";
        progressPercent.textContent = pct + "%";
      },
      onComplete: ({ text, confidence: conf }) => {
        progressWrap.hidden = true;
        lastResult = text;
        resultText.textContent = text || "(Không tìm thấy văn bản trong ảnh.)";
        confidence.textContent = text ? "Độ tin cậy " + conf + "%" : "";
        resultCard.hidden = false;
        if (window.__sound) window.__sound.success();
        if (!text) showToast("Rất tiếc, không phát hiện được chữ trong ảnh này.");
      },
      onError: (err) => {
        progressWrap.hidden = true;
        if (window.__sound) window.__sound.error();
        showToast("Có lỗi xảy ra khi nhận diện. Vui lòng thử ảnh khác.");
        console.error("OCR error:", err);
      },
    });

    try {
      await OCRApp.loadFile(file);
    } catch (err) {
      console.error(err);
    }
  }

  function describeStage(stage) {
    if (stage === "init") return "Đang chuẩn bị công cụ nhận diện";
    if (stage === "recognizing text") return "Đang đọc văn bản";
    return "Đang xử lý";
  }

  function onFileChosen() {
    openFile(fileInput.files && fileInput.files[0]);
    fileInput.value = "";
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
    lastResult = "";
    if (window.__sound) window.__sound.click();
  });
})();