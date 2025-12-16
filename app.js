(() => {
  const videoFile = document.getElementById("videoFile");
  const dropZone = document.querySelector(".drop-zone");
  const fileInfo = document.getElementById("fileInfo");
  const presetBtns = Array.from(document.querySelectorAll(".preset-btn .btn"));
  const speedRange = document.getElementById("speedRange");
  const speedValue = document.getElementById("speedValue");
  const preview = document.getElementById("preview");
  const startBtn = document.querySelector(".btn-primary");
  const resetBtn = document.getElementById("resetBtn");
  const downloadLink = document.querySelector(".btn-success");
  const progressBar = document.querySelector(".progress-bar");
  const micBtn = document.getElementById("micBtn");

  let mediaRecorder = null;
  let micStream = null;
  let recordedChunks = [];

  let currentFile = null;
  let audioContext = null;
  let decodedBuffer = null;
  let downloadUrl = null;

  function setProgress(p, text) {
    progressBar.style.width = p * 100 + "%";
    progressBar.setAttribute("aria-valuenow", Math.round(p * 100));
    progressBar.textContent = text || Math.round(p * 100) + "%";
  }

  function resetUI() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = null;
    startBtn.disabled = true;
    resetBtn.disabled = true;
    downloadLink.classList.add("disabled");
    downloadLink.removeAttribute("href");
    setProgress(0, "0%");
    fileInfo.querySelector(".fw-semibold").textContent = "No file chosen";
  }

  function onFileSelected(file) {
    currentFile = file;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.load();
    resetBtn.disabled = false;

    fileInfo.querySelector(".fw-semibold").textContent = file.name;

    startBtn.disabled = false;
  }

  dropZone.addEventListener("click", () => videoFile.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.background = "rgba(255,255,255,0.03)";
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.style.background = "";
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.background = "";
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFileSelected(f);
  });

  videoFile.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) onFileSelected(f);
  });

  // Microphone recording
  micBtn.addEventListener("click", async () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      micBtn.textContent = "Start Recording";
      return;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert("Microphone access denied or not available.");
      return;
    }

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(micStream);
    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) recordedChunks.push(ev.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, {
        type: recordedChunks[0]?.type || "audio/webm",
      });
      try {
        blob.name = "microphone." + (blob.type.split("/")[1] || "webm");
      } catch (e) {}
      onFileSelected(blob);

      if (micStream) micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
      mediaRecorder = null;
    };

    mediaRecorder.start();
    micBtn.textContent = "Stop Recording";

    startBtn.disabled = true;
    resetBtn.disabled = false;
  });

  presetBtns.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      presetBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const val = parseFloat(btn.textContent.replace("x", "")) || 1;
      speedRange.value = val;
      speedValue.textContent = val.toFixed(2) + "x";
      preview.playbackRate = val;
    })
  );

  speedRange.addEventListener("input", () => {
    const v = parseFloat(speedRange.value);
    speedValue.textContent = v.toFixed(2) + "x";
    preview.playbackRate = v;
  });

  async function ensureAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") await audioContext.resume();
    return audioContext;
  }

  startBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    startBtn.disabled = true;
    setProgress(0.05, "Preparing...");

    await ensureAudioContext();

    const arrayBuffer = await currentFile.arrayBuffer();

    setProgress(0.15, "Decoding audio...");
    try {
      decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch (err) {
      console.warn(
        "decodeAudioData failed, falling back to media capture",
        err
      );
      alert(
        "Automatic audio decoding failed for this file type in your browser. Processing may not be available."
      );
      startBtn.disabled = false;
      return;
    }

    const speed = parseFloat(speedRange.value) || 1;

    const sampleRate = decodedBuffer.sampleRate;
    const newDuration = decodedBuffer.duration / speed;
    const length = Math.ceil(newDuration * sampleRate);
    setProgress(0.25, "Rendering...");

    const offlineCtx = new OfflineAudioContext(
      decodedBuffer.numberOfChannels,
      length,
      sampleRate
    );
    const src = offlineCtx.createBufferSource();
    src.buffer = decodedBuffer;
    src.playbackRate.value = speed;
    src.connect(offlineCtx.destination);
    src.start(0);

    const renderedBuffer = await offlineCtx.startRendering();

    setProgress(0.9, "Encoding...");
    const wavBlob = bufferToWavBlob(renderedBuffer);

    setProgress(1, "Done");

    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(wavBlob);
    downloadLink.classList.remove("disabled");
    downloadLink.href = downloadUrl;
    const baseName =
      currentFile && currentFile.name
        ? currentFile.name.replace(/\.[^/.]+$/, "")
        : "output";
    downloadLink.download = baseName + "-audio.wav";

    startBtn.disabled = false;
  });

  resetBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch (e) {}
    }
    if (micStream) {
      try {
        micStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      micStream = null;
    }
    micBtn.textContent = "Start Recording";
    if (preview.src) {
      try {
        URL.revokeObjectURL(preview.src);
      } catch (e) {}
      preview.removeAttribute("src");
    }
    currentFile = null;
    decodedBuffer = null;
    resetUI();
  });

  function bufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let interleaved;
    if (numChannels === 2) {
      const ch0 = buffer.getChannelData(0);
      const ch1 = buffer.getChannelData(1);
      interleaved = interleave(ch0, ch1);
    } else {
      interleaved = buffer.getChannelData(0);
    }

    const bufferLength = interleaved.length * (bitDepth / 8);
    const wavBuffer = new ArrayBuffer(44 + bufferLength);
    const view = new DataView(wavBuffer);

    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + bufferLength, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, "data");
    view.setUint32(40, bufferLength, true);

    floatTo16BitPCM(view, 44, interleaved);

    return new Blob([view], { type: "audio/wav" });
  }

  function interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0,
      inputIndex = 0;
    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      output.setInt16(offset, s, true);
    }
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  resetUI();
})();
