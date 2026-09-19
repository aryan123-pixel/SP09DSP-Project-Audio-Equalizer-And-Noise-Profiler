// SP09 AudioLab - 3 Band Parametric EQ + Spectrum + Peak + Hover + NR + Offline WAV Export

const audioFile = document.getElementById("audioFile");
const audioPlayer = document.getElementById("audioPlayer");
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const noiseBtn = document.getElementById("noiseBtn");
const exportBtn = document.getElementById("exportBtn");
const canvas = document.getElementById("spectrum");
const ctx = canvas ? canvas.getContext("2d") : null;

let audioContext = null;
let source = null;
let analyser = null;
let eqFilters = [];
let audioStarted = false;

let noiseHighPass = null;
let noiseLowPass = null;
let noiseGate = null;
let dryGain = null;
let wetGain = null;
let noiseReductionOn = false;

let spectrumData = new Float32Array(1024);
let spectrumRunning = false;
let spectrumAudioActive = false;

let hoverFrequency = null;
let hoverAmplitude = null;
let mouseInsideSpectrum = false;

let spectrumInfo = document.getElementById("spectrumInfo");

if (!spectrumInfo) {
    spectrumInfo = document.createElement("div");
    spectrumInfo.id = "spectrumInfo";
    spectrumInfo.style.cssText =
        "margin:10px 5px 12px 65px;" +
        "font-family:Arial,sans-serif;" +
        "font-size:13px;color:#c5ccd8;" +
        "display:flex;gap:25px;flex-wrap:wrap;";

    if (canvas && canvas.parentElement) {
        canvas.parentElement.insertBefore(spectrumInfo, canvas);
    }
}

const bands = [1, 2, 3];
const controls = {};

bands.forEach(band => {
    controls[band] = {
        freq: document.getElementById(`freq${band}`),
        gain: document.getElementById(`gain${band}`),
        q: document.getElementById(`q${band}`),
        freqValue: document.getElementById(`freq${band}Value`),
        gainValue: document.getElementById(`gain${band}Value`),
        qValue: document.getElementById(`q${band}Value`)
    };
});

function updateDisplays(band) {
    const c = controls[band];
    if (c.freq && c.freqValue)
        c.freqValue.textContent = c.freq.value + " Hz";
    if (c.gain && c.gainValue)
        c.gainValue.textContent = c.gain.value + " dB";
    if (c.q && c.qValue)
        c.qValue.textContent = Number(c.q.value).toFixed(1);
}

bands.forEach(updateDisplays);

function resetSpectrumPeak() {
    if (spectrumInfo) {
        spectrumInfo.innerHTML = `
            <span><strong>Peak Frequency:</strong> --</span>
            <span><strong>Peak Amplitude:</strong> --</span>
        `;
    }
    hoverFrequency = null;
    hoverAmplitude = null;
}

audioFile.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    console.log("Selected file:", file.name, file.type, file.size);

    const url = URL.createObjectURL(file);

    audioPlayer.pause();
    spectrumAudioActive = false;
    resetSpectrumPeak();

    audioPlayer.currentTime = 0;
    audioPlayer.src = url;
    audioPlayer.load();

    audioPlayer.onloadedmetadata = () => {
        console.log("Audio duration:", audioPlayer.duration);
    };

    audioPlayer.onerror = () => {
        console.error("Audio loading error:", audioPlayer.error);
    };
});

audioPlayer.addEventListener("play", () => {
    spectrumAudioActive = true;
});

audioPlayer.addEventListener("playing", () => {
    spectrumAudioActive = true;
});

audioPlayer.addEventListener("pause", () => {
    spectrumAudioActive = false;
    resetSpectrumPeak();
});

audioPlayer.addEventListener("ended", () => {
    spectrumAudioActive = false;
    resetSpectrumPeak();
});

function createEQFilters(context) {
    const filters = [];

    for (let i = 0; i < 3; i++) {
        const c = controls[i + 1];
        const filter = context.createBiquadFilter();

        filter.type = "peaking";
        filter.frequency.value = Number(c.freq.value);
        filter.gain.value = Number(c.gain.value);
        filter.Q.value = Number(c.q.value);

        filters.push(filter);
    }

    return filters;
}

function createNoiseChain(context) {
    const hp = context.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 75;
    hp.Q.value = 0.707;

    const lp = context.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 11500;
    lp.Q.value = 0.707;

    const gate = context.createDynamicsCompressor();
    gate.threshold.value = -38;
    gate.knee.value = 0;
    gate.ratio.value = 20;
    gate.attack.value = 0.003;
    gate.release.value = 0.12;

    return { hp, lp, gate };
}

function setupAudio() {
    if (audioStarted) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();

    source = audioContext.createMediaElementSource(audioPlayer);
    eqFilters = createEQFilters(audioContext);

    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    source.connect(eqFilters[0]);
    eqFilters[0].connect(eqFilters[1]);
    eqFilters[1].connect(eqFilters[2]);

    const nr = createNoiseChain(audioContext);
    noiseHighPass = nr.hp;
    noiseLowPass = nr.lp;
    noiseGate = nr.gate;

    dryGain = audioContext.createGain();
    wetGain = audioContext.createGain();

    dryGain.gain.value = 1;
    wetGain.gain.value = 0;

    // Dry path
    eqFilters[2].connect(dryGain);
    dryGain.connect(analyser);

    // Noise-reduction path
    eqFilters[2].connect(noiseHighPass);
    noiseHighPass.connect(noiseLowPass);
    noiseLowPass.connect(noiseGate);
    noiseGate.connect(wetGain);
    wetGain.connect(analyser);

    analyser.connect(audioContext.destination);

    audioStarted = true;
    drawSpectrum();
}

function updateFilter(band) {
    if (!eqFilters[band - 1] || !audioContext) return;

    const filter = eqFilters[band - 1];
    const c = controls[band];
    const time = audioContext.currentTime;

    filter.frequency.setTargetAtTime(
        Number(c.freq.value), time, 0.005
    );

    filter.gain.setTargetAtTime(
        Number(c.gain.value), time, 0.005
    );

    filter.Q.setTargetAtTime(
        Number(c.q.value), time, 0.005
    );
}

bands.forEach(band => {
    const c = controls[band];

    if (c.freq) {
        c.freq.addEventListener("input", function () {
            if (c.freqValue)
                c.freqValue.textContent = this.value + " Hz";
            if (audioStarted) updateFilter(band);
        });
    }

    if (c.gain) {
        c.gain.addEventListener("input", function () {
            if (c.gainValue)
                c.gainValue.textContent = this.value + " dB";
            if (audioStarted) updateFilter(band);
        });
    }

    if (c.q) {
        c.q.addEventListener("input", function () {
            if (c.qValue)
                c.qValue.textContent = Number(this.value).toFixed(1);
            if (audioStarted) updateFilter(band);
        });
    }
});

const presets = {
    "Flat": [
        [120, 0, 1],
        [1000, 0, 1],
        [5000, 0, 1]
    ],

    "Bass Boost": [
        [100, 8, 0.8],
        [800, 2, 1],
        [5000, 1, 1]
    ],

    "Vocal": [
        [150, -3, 1],
        [1200, 6, 1.2],
        [5000, 3, 1]
    ],

    "Rock": [
        [100, 6, 0.8],
        [1000, -2, 1],
        [6000, 6, 0.9]
    ],

    "Treble Boost": [
        [150, 0, 1],
        [1500, 2, 1],
        [7000, 8, 0.8]
    ]
};

const presetButtons = document.querySelectorAll(".presets button");

presetButtons.forEach(button => {
    button.addEventListener("click", function () {
        const preset = presets[this.textContent.trim()];
        if (!preset) return;

        preset.forEach((values, index) => {
            const band = index + 1;
            const c = controls[band];

            if (c.freq) c.freq.value = values[0];
            if (c.gain) c.gain.value = values[1];
            if (c.q) c.q.value = values[2];

            updateDisplays(band);

            if (audioStarted) updateFilter(band);
        });

        presetButtons.forEach(btn => btn.classList.remove("active"));
        this.classList.add("active");
    });
});

playBtn.addEventListener("click", async function () {
    if (!audioPlayer.src) {
        alert("Please select an audio file first.");
        return;
    }

    if (audioPlayer.readyState < 1) {
        alert(
            "Audio is still loading. Please wait a moment and press Play again."
        );
        return;
    }

    try {
        if (!audioStarted) setupAudio();

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        if (
            audioPlayer.ended ||
            (
                Number.isFinite(audioPlayer.duration) &&
                audioPlayer.currentTime >= audioPlayer.duration
            )
        ) {
            audioPlayer.currentTime = 0;
        }

        await audioPlayer.play();
        spectrumAudioActive = true;

        console.log("Audio playing");
    } catch (error) {
        console.error("Playback error:", error);
        alert(
            "Audio play nahi ho raha. Browser Console mein error check karein."
        );
    }
});

stopBtn.addEventListener("click", function () {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    spectrumAudioActive = false;
    resetSpectrumPeak();
});

function updateNoiseButton() {
    noiseBtn.textContent =
        `Noise Reduction: ${noiseReductionOn ? "ON" : "OFF"}`;

    noiseBtn.classList.toggle("active", noiseReductionOn);
}

noiseBtn.addEventListener("click", function () {
    noiseReductionOn = !noiseReductionOn;

    updateNoiseButton();

    if (!audioStarted) return;

    const time = audioContext.currentTime;

    if (noiseReductionOn) {
        dryGain.gain.setTargetAtTime(0, time, 0.01);
        wetGain.gain.setTargetAtTime(1, time, 0.01);
    } else {
        wetGain.gain.setTargetAtTime(0, time, 0.01);
        dryGain.gain.setTargetAtTime(1, time, 0.01);
    }
});

function formatFrequency(frequency) {
    if (!Number.isFinite(frequency)) return "--";

    return frequency >= 1000
        ? (frequency / 1000).toFixed(2) + " kHz"
        : Math.round(frequency) + " Hz";
}

function dbFromY(y, top, graphHeight) {
    const minDb = -80;
    const maxDb = 0;

    let db =
        maxDb -
        ((y - top) / graphHeight) * (maxDb - minDb);

    return Math.max(minDb, Math.min(maxDb, db));
}

if (canvas) {
    canvas.addEventListener("mousemove", function (event) {
        if (!audioContext || !analyser) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const left = 65;
        const right = 20;
        const top = 20;
        const bottom = 90;

        const graphWidth = canvas.clientWidth - left - right;
        const graphHeight = canvas.clientHeight - top - bottom;

        if (
            mouseX < left ||
            mouseX > canvas.clientWidth - right ||
            mouseY < top ||
            mouseY > top + graphHeight
        ) {
            mouseInsideSpectrum = false;
            return;
        }

        mouseInsideSpectrum = true;

        const maxFreq = audioContext.sampleRate / 2;

        hoverFrequency =
            ((mouseX - left) / graphWidth) * maxFreq;

        hoverAmplitude =
            dbFromY(mouseY, top, graphHeight);
    });

    canvas.addEventListener("mouseleave", function () {
        mouseInsideSpectrum = false;
        hoverFrequency = null;
        hoverAmplitude = null;
    });
}

function drawSpectrum() {
    if (spectrumRunning) return;
    spectrumRunning = true;

    function render() {
        requestAnimationFrame(render);

        if (!analyser || !audioContext || !canvas || !ctx) return;

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (width <= 0 || height <= 0) return;

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        const bufferLength = analyser.frequencyBinCount;

        if (spectrumData.length !== bufferLength) {
            spectrumData = new Float32Array(bufferLength);
        }

        analyser.getFloatFrequencyData(spectrumData);

        const left = 65;
        const right = 20;
        const top = 20;
        const bottom = 90;

        const graphWidth = width - left - right;
        const graphHeight = height - top - bottom;

        const minDb = -80;
        const maxDb = 0;
        const maxFreq = audioContext.sampleRate / 2;

        ctx.clearRect(0, 0, width, height);

        ctx.fillStyle = "#0b0e13";
        ctx.fillRect(0, 0, width, height);

        // dB grid
        ctx.font = "12px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";

        for (let db = 0; db >= -80; db -= 10) {
            const y =
                top +
                ((maxDb - db) / (maxDb - minDb)) *
                graphHeight;

            ctx.strokeStyle = "#252b36";
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(width - right, y);
            ctx.stroke();

            ctx.fillStyle = "#c5ccd8";
            ctx.fillText(`${db} dB`, left - 8, y);
        }

        // Frequency grid
        const divisions = 10;

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "11px Arial";

        for (let i = 0; i <= divisions; i++) {
            const frequency = (i / divisions) * maxFreq;
            const x = left + (i / divisions) * graphWidth;

            ctx.strokeStyle = "#202631";
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + graphHeight);
            ctx.stroke();

            const label =
                frequency >= 1000
                    ? (frequency / 1000).toFixed(1) + "k"
                    : Math.round(frequency);

            ctx.fillStyle = "#c5ccd8";
            ctx.fillText(
                label,
                x,
                top + graphHeight + 10
            );
        }

        // Axis title
        ctx.font = "12px Arial";
        ctx.fillStyle = "#d5dbe5";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";

        ctx.fillText(
            "Frequency (Hz)",
            left + graphWidth / 2,
            height - 20
        );

        let peakIndex = 1;
        let peakDb = -80;
        let peakFrequency = null;

        // Peak detection only while playing
        if (spectrumAudioActive) {
            for (let i = 1; i < bufferLength; i++) {
                const frequency =
                    (i * audioContext.sampleRate) /
                    analyser.fftSize;

                if (frequency < 20) continue;

                const db = spectrumData[i];

                if (Number.isFinite(db) && db > peakDb) {
                    peakDb = db;
                    peakIndex = i;
                }
            }

            peakDb = Math.max(
                -80,
                Math.min(0, peakDb)
            );

            peakFrequency =
                (peakIndex * audioContext.sampleRate) /
                analyser.fftSize;

            if (spectrumInfo) {
                spectrumInfo.innerHTML = `
                    <span>
                        <strong>Peak Frequency:</strong>
                        ${formatFrequency(peakFrequency)}
                    </span>
                    <span>
                        <strong>Peak Amplitude:</strong>
                        ${peakDb.toFixed(1)} dB
                    </span>
                `;
            }
        } else {
            resetSpectrumPeak();
        }

        // Spectrum curve
        ctx.beginPath();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        let started = false;

        for (let i = 0; i < bufferLength; i++) {
            const frequency =
                (i * audioContext.sampleRate) /
                analyser.fftSize;

            if (frequency < 0 || frequency > maxFreq) continue;

            const x =
                left +
                (frequency / maxFreq) * graphWidth;

            let db = spectrumData[i];

            if (!Number.isFinite(db)) db = minDb;

            db = Math.max(
                minDb,
                Math.min(maxDb, db)
            );

            const y =
                top +
                ((maxDb - db) / (maxDb - minDb)) *
                graphHeight;

            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();

        // Peak marker
        if (
            spectrumAudioActive &&
            Number.isFinite(peakFrequency) &&
            peakDb > minDb
        ) {
            const peakX =
                left +
                (peakFrequency / maxFreq) *
                graphWidth;

            const peakY =
                top +
                ((maxDb - peakDb) / (maxDb - minDb)) *
                graphHeight;

            ctx.strokeStyle = "#f59e0b";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);

            ctx.beginPath();
            ctx.moveTo(peakX, top);
            ctx.lineTo(peakX, top + graphHeight);
            ctx.stroke();

            ctx.setLineDash([]);

            ctx.fillStyle = "#f59e0b";
            ctx.beginPath();
            ctx.arc(
                peakX,
                peakY,
                4,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        // Mouse hover
        if (
            spectrumAudioActive &&
            mouseInsideSpectrum &&
            Number.isFinite(hoverFrequency) &&
            Number.isFinite(hoverAmplitude)
        ) {
            const hoverX =
                left +
                (hoverFrequency / maxFreq) *
                graphWidth;

            const hoverY =
                top +
                ((maxDb - hoverAmplitude) /
                    (maxDb - minDb)) *
                graphHeight;

            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);

            ctx.beginPath();
            ctx.moveTo(hoverX, top);
            ctx.lineTo(hoverX, top + graphHeight);
            ctx.stroke();

            ctx.setLineDash([]);

            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(
                hoverX,
                hoverY,
                4,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // Tooltip
            const tooltipText =
                `${formatFrequency(hoverFrequency)} | ` +
                `${hoverAmplitude.toFixed(1)} dB`;

            ctx.font = "12px Arial";

            const textWidth =
                ctx.measureText(tooltipText).width;

            const padding = 8;
            const tooltipWidth =
                textWidth + padding * 2;
            const tooltipHeight = 28;

            let tooltipX = hoverX + 10;
            let tooltipY = hoverY - 35;

            if (tooltipX + tooltipWidth > width - 5) {
                tooltipX =
                    hoverX -
                    tooltipWidth -
                    10;
            }

            if (tooltipY < 5) {
                tooltipY = hoverY + 10;
            }

            ctx.fillStyle =
                "rgba(15,18,24,0.95)";

            ctx.fillRect(
                tooltipX,
                tooltipY,
                tooltipWidth,
                tooltipHeight
            );

            ctx.strokeStyle = "#3b82f6";
            ctx.strokeRect(
                tooltipX,
                tooltipY,
                tooltipWidth,
                tooltipHeight
            );

            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            ctx.fillText(
                tooltipText,
                tooltipX + padding,
                tooltipY + tooltipHeight / 2
            );
        }
    }

    render();
}

async function exportAudio() {
    if (!audioPlayer.src) {
        alert("Please select an audio file first.");
        return;
    }

    if (
        !Number.isFinite(audioPlayer.duration) ||
        audioPlayer.duration <= 0
    ) {
        alert("Audio is still loading. Please wait.");
        return;
    }

    const originalText =
        exportBtn ? exportBtn.textContent : "";

    try {
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.textContent = "Preparing...";
        }

        // Fetch original audio
        const response = await fetch(audioPlayer.src);
        const arrayBuffer = await response.arrayBuffer();

        // Decode
        const AudioCtx =
            window.AudioContext ||
            window.webkitAudioContext;

        const tempContext = new AudioCtx();

        const decodedBuffer =
            await tempContext.decodeAudioData(arrayBuffer);

        await tempContext.close();

        const sampleRate = decodedBuffer.sampleRate;
        const numberOfChannels =
            decodedBuffer.numberOfChannels;
        const length = decodedBuffer.length;

        // Offline context
        const offlineContext =
            new OfflineAudioContext(
                numberOfChannels,
                length,
                sampleRate
            );

        const offlineSource =
            offlineContext.createBufferSource();

        offlineSource.buffer = decodedBuffer;

        // Offline EQ
        const offlineEQ =
            createEQFilters(offlineContext);

        offlineSource.connect(offlineEQ[0]);
        offlineEQ[0].connect(offlineEQ[1]);
        offlineEQ[1].connect(offlineEQ[2]);

        // Offline Noise Reduction
        if (noiseReductionOn) {
            const nr =
                createNoiseChain(offlineContext);

            offlineEQ[2].connect(nr.hp);
            nr.hp.connect(nr.lp);
            nr.lp.connect(nr.gate);
            nr.gate.connect(
                offlineContext.destination
            );
        } else {
            offlineEQ[2].connect(
                offlineContext.destination
            );
        }

        offlineSource.start(0);

        if (exportBtn) {
            exportBtn.textContent = "Processing...";
        }

        const renderedBuffer =
            await offlineContext.startRendering();

        if (exportBtn) {
            exportBtn.textContent = "Creating WAV...";
        }

        const wavBlob =
            audioBufferToWav(renderedBuffer);

        const url =
            URL.createObjectURL(wavBlob);

        const link =
            document.createElement("a");

        link.href = url;
        link.download = "AudioLab_Export.wav";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 5000);

        if (exportBtn) {
            exportBtn.textContent = "Export Complete";

            setTimeout(() => {
                exportBtn.textContent =
                    originalText || "Export";
            }, 2000);
        }

        console.log(
            "Audio export completed successfully."
        );

    } catch (error) {
        console.error("Export error:", error);

        alert(
            "Export failed. Browser console mein error check karein."
        );

        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.textContent =
                originalText || "Export";
        }

        return;
    }

    if (exportBtn) {
        exportBtn.disabled = false;
    }
}

function audioBufferToWav(buffer) {
    const numChannels =
        buffer.numberOfChannels;

    const sampleRate =
        buffer.sampleRate;

    const numSamples =
        buffer.length;

    const bytesPerSample = 2;
    const blockAlign =
        numChannels * bytesPerSample;

    const byteRate =
        sampleRate * blockAlign;

    const dataSize =
        numSamples * blockAlign;

    const arrayBuffer =
        new ArrayBuffer(44 + dataSize);

    const view =
        new DataView(arrayBuffer);

    writeString(view, 0, "RIFF");
    view.setUint32(
        4,
        36 + dataSize,
        true
    );

    writeString(view, 8, "WAVE");

    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);

    writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    const channels = [];

    for (let channel = 0; channel < numChannels; channel++) {
        channels.push(
            buffer.getChannelData(channel)
        );
    }

    let offset = 44;

    for (let i = 0; i < numSamples; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            let sample = channels[channel][i];

            sample = Math.max(-1, Math.min(1, sample));

            const pcm =
                sample < 0
                    ? sample * 0x8000
                    : sample * 0x7fff;

            view.setInt16(
                offset,
                pcm,
                true
            );

            offset += 2;
        }
    }

    return new Blob(
        [arrayBuffer],
        { type: "audio/wav" }
    );
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(
            offset + i,
            string.charCodeAt(i)
        );
    }
}

if (exportBtn) {
    exportBtn.addEventListener(
        "click",
        exportAudio
    );
}

updateNoiseButton();
resetSpectrumPeak();
