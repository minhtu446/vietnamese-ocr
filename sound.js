window.__sound = (function () {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      const AC =
        window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  }

  function tone(freq, start, duration, type, volume) {
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    const t0 = ac.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume || 0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function play() {
    if (!enabled) return;
    const ac = ensure();
    if (ac && ac.state === "suspended") ac.resume();
  }

  function chord(notes, step, type, volume) {
    notes.forEach((f, i) => tone(f, i * step, 0.18, type, volume));
  }

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(value) {
      enabled = value;
    },
    click() {
      play();
      tone(720, 0, 0.06, "triangle", 0.06);
    },
    image() {
      play();
      chord([523.25, 659.25], 0.06, "sine", 0.08);
    },
    success() {
      play();
      chord([523.25, 659.25, 783.99], 0.11, "triangle", 0.1);
    },
    error() {
      play();
      tone(196, 0, 0.28, "triangle", 0.09);
      tone(155.56, 0.14, 0.32, "sine", 0.08);
    },
  };
})();

(function () {
  const toggle = document.getElementById("soundToggle");
  const dot = document.querySelector(".sound-dot");
  const label = document.getElementById("soundLabel");

  function refresh() {
    const on = window.__sound.enabled;
    dot.classList.toggle("muted", !on);
    label.textContent = "Âm thanh: " + (on ? "Bật" : "Tắt");
  }

  toggle.addEventListener("click", () => {
    const next = !window.__sound.enabled;
    window.__sound.setEnabled(next);
    if (next) window.__sound.click();
    refresh();
  });

  refresh();
})();