const audioFile = document.getElementById("audioFile");
const audioPlayer = document.getElementById("audioPlayer");
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const noiseBtn = document.getElementById("noiseBtn");
const exportBtn = document.getElementById("exportBtn");

let audioContext = null;
let source = null;
let audioStarted = false;
let eqFilters = [];

let originalAnalyser = null;
let processedAnalyser = null;

let noiseHighPass = null;
let noiseLowPass = null;
let noiseGate = null;
let dryGain = null;
let wetGain = null;
let noiseReductionOn = false;

const FFT_SIZE = 2048;
const MAX_DISPLAY_FREQUENCY = 12000;
const MIN_DB = -80;
const MAX_DB = 0;

let originalSpectrumData =
    new Float32Array(FFT_SIZE / 2);

let processedSpectrumData =
    new Float32Array(FFT_SIZE / 2);

let spectrumRunning = false;
let spectrumAudioActive = false;
let spectrumFrozen = false;
let spectrumStopped = true;

let originalPeakFrequency = null;
let originalPeakAmplitude = null;

let processedPeakFrequency = null;
let processedPeakAmplitude = null;

let originalHoverFrequency = null;
let originalHoverAmplitude = null;

let processedHoverFrequency = null;
let processedHoverAmplitude = null;

let originalMouseInside = false;
let processedMouseInside = false;

let originalCanvas =
    document.getElementById("originalSpectrum");

let oldSpectrumCanvas =
    document.getElementById("spectrum");

if (!originalCanvas && oldSpectrumCanvas) {
    originalCanvas = oldSpectrumCanvas;
    originalCanvas.id = "originalSpectrum";
}

let spectrumCompareContainer =
    document.getElementById(
        "spectrumCompareContainer"
    );

function createSpectrumLayout() {
    if (!originalCanvas) {
        return;
    }

    if (!spectrumCompareContainer) {
        spectrumCompareContainer =
            document.createElement("div");

        spectrumCompareContainer.id =
            "spectrumCompareContainer";

        spectrumCompareContainer.style.cssText = `
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 22px;
            margin: 20px 0;
            padding: 0;
        `;
    }

    const originalParent =
        originalCanvas.parentElement;

    if (
        originalParent &&
        spectrumCompareContainer.parentElement !==
            originalParent
    ) {
        originalParent.insertBefore(
            spectrumCompareContainer,
            originalCanvas
        );
    }

    spectrumCompareContainer.appendChild(
        originalCanvas
    );

    originalCanvas.style.cssText = `
        display: block;
        width: 100% !important;
        max-width: 100% !important;
        height: 430px !important;
        min-height: 430px;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    `;
}

createSpectrumLayout();

let processedCanvas =
    document.getElementById(
        "processedSpectrum"
    );

if (!processedCanvas) {
    processedCanvas =
        document.createElement("canvas");

    processedCanvas.id =
        "processedSpectrum";
}

processedCanvas.style.cssText = `
    display: block;
    width: 100% !important;
    max-width: 100% !important;
    height: 430px !important;
    min-height: 430px;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
`;

if (
    spectrumCompareContainer &&
    processedCanvas.parentElement !==
        spectrumCompareContainer
) {
    spectrumCompareContainer.appendChild(
        processedCanvas
    );
}

const originalCtx =
    originalCanvas
        ? originalCanvas.getContext("2d")
        : null;

const processedCtx =
    processedCanvas
        ? processedCanvas.getContext("2d")
        : null;

let originalInfo =
    document.getElementById(
        "originalSpectrumInfo"
    );

let processedInfo =
    document.getElementById(
        "processedSpectrumInfo"
    );

function createInfoBox(id, title) {
    let info =
        document.getElementById(id);

    if (!info) {
        info =
            document.createElement("div");

        info.id = id;

        info.style.cssText = `
            width: 100%;
            box-sizing: border-box;
            margin: 0;
            padding: 8px 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 35px;
            flex-wrap: wrap;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #d5dbe5;
            background: #151922;
            border-radius: 6px;
        `;
    }

    info.innerHTML = `
        <span>
            <strong>${title}</strong>
        </span>

        <span>
            <strong>Peak Frequency:</strong>
            --
        </span>

        <span>
            <strong>Peak Amplitude:</strong>
            --
        </span>
    `;

    return info;
}

originalInfo =
    createInfoBox(
        "originalSpectrumInfo",
        "Original Audio"
    );

processedInfo =
    createInfoBox(
        "processedSpectrumInfo",
        "Processed Audio"
    );

function arrangeSpectrumLayout() {
    if (!spectrumCompareContainer) {
        return;
    }

    spectrumCompareContainer.insertBefore(
        originalInfo,
        originalCanvas
    );

    spectrumCompareContainer.insertBefore(
        processedInfo,
        processedCanvas
    );
}

arrangeSpectrumLayout();

function resetSpectrumPeaks() {
    originalPeakFrequency = null;
    originalPeakAmplitude = null;

    processedPeakFrequency = null;
    processedPeakAmplitude = null;

    if (originalInfo) {
        originalInfo.innerHTML = `
            <span>
                <strong>Original Audio</strong>
            </span>

            <span>
                <strong>Peak Frequency:</strong>
                --
            </span>

            <span>
                <strong>Peak Amplitude:</strong>
                --
            </span>
        `;
    }

    if (processedInfo) {
        processedInfo.innerHTML = `
            <span>
                <strong>Processed Audio</strong>
            </span>

            <span>
                <strong>Peak Frequency:</strong>
                --
            </span>

            <span>
                <strong>Peak Amplitude:</strong>
                --
            </span>
        `;
    }
}

resetSpectrumPeaks();

const bands = [1, 2, 3];

const controls = {};

bands.forEach((band) => {
    controls[band] = {
        freq: document.getElementById(
            `freq${band}`
        ),

        gain: document.getElementById(
            `gain${band}`
        ),

        q: document.getElementById(
            `q${band}`
        ),

        freqValue:
            document.getElementById(
                `freq${band}Value`
            ),

        gainValue:
            document.getElementById(
                `gain${band}Value`
            ),

        qValue:
            document.getElementById(
                `q${band}Value`
            )
    };
});

function updateDisplays(band) {
    const c = controls[band];

    if (!c) {
        return;
    }

    if (c.freq && c.freqValue) {
        c.freqValue.textContent =
            c.freq.value + " Hz";
    }

    if (c.gain && c.gainValue) {
        c.gainValue.textContent =
            c.gain.value + " dB";
    }

    if (c.q && c.qValue) {
        c.qValue.textContent =
            Number(c.q.value).toFixed(1);
    }
}

bands.forEach(updateDisplays);

let currentObjectURL = null;

audioFile.addEventListener(
    "change",
    function () {
        const file = this.files && this.files[0];

        if (!file) {
            return;
        }

        console.log(
            "Selected audio:",
            file.name,
            file.type,
            file.size
        );

        // Stop and completely reset the previous media element.
        try {
            audioPlayer.pause();
        } catch (error) {
            console.warn("Pause reset warning:", error);
        }

        spectrumAudioActive = false;
        spectrumFrozen = false;
        spectrumStopped = true;

        if (originalSpectrumData) {
            originalSpectrumData.fill(-80);
        }

        if (processedSpectrumData) {
            processedSpectrumData.fill(-80);
        }

        resetSpectrumPeaks();

        originalHoverFrequency = null;
        originalHoverAmplitude = null;
        processedHoverFrequency = null;
        processedHoverAmplitude = null;
        originalMouseInside = false;
        processedMouseInside = false;

        // Release the previous temporary URL.
        if (currentObjectURL) {
            URL.revokeObjectURL(currentObjectURL);
            currentObjectURL = null;
        }

        // Create a fresh object URL and explicitly reload the media element.
        currentObjectURL = URL.createObjectURL(file);

        audioPlayer.removeAttribute("src");
        audioPlayer.load();

        audioPlayer.src = currentObjectURL;
        audioPlayer.load();

        // Useful diagnostics and ensures the native player receives metadata.
        audioPlayer.onloadedmetadata = function () {
            console.log(
                "Audio metadata loaded. Duration:",
                audioPlayer.duration,
                "seconds"
            );
        };

        audioPlayer.oncanplay = function () {
            console.log("Audio is ready to play.");
        };

        audioPlayer.onerror = function () {
            console.error(
                "Audio loading error:",
                audioPlayer.error
            );
        };
    }
);

audioPlayer.addEventListener(
    "play",
    function () {
        spectrumStopped = false;
        spectrumFrozen = false;
        spectrumAudioActive = true;

        if (!audioStarted) {
            setupAudio();
        }
    }
);

audioPlayer.addEventListener(
    "playing",
    function () {
        spectrumStopped = false;
        spectrumFrozen = false;
        spectrumAudioActive = true;
    }
);

audioPlayer.addEventListener(
    "pause",
    function () {
        spectrumAudioActive = false;
        spectrumFrozen = true;
    }
);

audioPlayer.addEventListener(
    "ended",
    function () {
        spectrumAudioActive = false;
        spectrumFrozen = true;
    }
);

function createEQFilters(context) {
    const filters = [];

    for (let i = 0; i < 3; i++) {
        const c = controls[i + 1];

        const filter =
            context.createBiquadFilter();

        if (i === 0) {
            filter.type = "lowshelf";
        } else if (i === 2) {
            filter.type = "highshelf";
        } else {
            filter.type = "peaking";
        }

        filter.frequency.value =
            Number(c.freq.value);

        filter.gain.value =
            Number(c.gain.value);

        filter.Q.value =
            Number(c.q.value);

        filters.push(filter);
    }

    return filters;
}

function createNoiseChain(context) {
    const hp =
        context.createBiquadFilter();

    hp.type = "highpass";
    hp.frequency.value = 75;
    hp.Q.value = 0.707;

    const lp =
        context.createBiquadFilter();

    lp.type = "lowpass";
    lp.frequency.value = 11500;
    lp.Q.value = 0.707;

    const gate =
        context.createDynamicsCompressor();

    gate.threshold.value = -38;
    gate.knee.value = 0;
    gate.ratio.value = 20;
    gate.attack.value = 0.003;
    gate.release.value = 0.12;

    return {
        hp,
        lp,
        gate
    };
}

function setupAudio() {
    if (audioStarted) {
        return;
    }

    const AudioCtx =
        window.AudioContext ||
        window.webkitAudioContext;

    audioContext = new AudioCtx();

    source =
        audioContext.createMediaElementSource(
            audioPlayer
        );

    originalAnalyser =
        audioContext.createAnalyser();

    originalAnalyser.fftSize =
        FFT_SIZE;

    originalAnalyser.smoothingTimeConstant =
        0.75;

    source.connect(
        originalAnalyser
    );

    eqFilters =
        createEQFilters(
            audioContext
        );

    source.connect(
        eqFilters[0]
    );

    eqFilters[0].connect(
        eqFilters[1]
    );

    eqFilters[1].connect(
        eqFilters[2]
    );

    processedAnalyser =
        audioContext.createAnalyser();

    processedAnalyser.fftSize =
        FFT_SIZE;

    processedAnalyser.smoothingTimeConstant =
        0.75;

    const nr =
        createNoiseChain(
            audioContext
        );

    noiseHighPass = nr.hp;
    noiseLowPass = nr.lp;
    noiseGate = nr.gate;

    dryGain =
        audioContext.createGain();

    wetGain =
        audioContext.createGain();

    dryGain.gain.value = 1;
    wetGain.gain.value = 0;

    eqFilters[2].connect(
        dryGain
    );

    dryGain.connect(
        processedAnalyser
    );

    eqFilters[2].connect(
        noiseHighPass
    );

    noiseHighPass.connect(
        noiseLowPass
    );

    noiseLowPass.connect(
        noiseGate
    );

    noiseGate.connect(
        wetGain
    );

    wetGain.connect(
        processedAnalyser
    );

    processedAnalyser.connect(
        audioContext.destination
    );

    audioStarted = true;

    drawSpectrum();
}

function updateFilter(band) {
    if (
        !eqFilters[band - 1] ||
        !audioContext
    ) {
        return;
    }

    const filter =
        eqFilters[band - 1];

    const c = controls[band];

    const time =
        audioContext.currentTime;

    filter.frequency.setTargetAtTime(
        Number(c.freq.value),
        time,
        0.005
    );

    filter.gain.setTargetAtTime(
        Number(c.gain.value),
        time,
        0.005
    );

    filter.Q.setTargetAtTime(
        Number(c.q.value),
        time,
        0.005
    );
}

bands.forEach((band) => {
    const c = controls[band];

    if (c.freq) {
        c.freq.addEventListener(
            "input",
            function () {
                if (c.freqValue) {
                    c.freqValue.textContent =
                        this.value + " Hz";
                }

                if (audioStarted) {
                    updateFilter(band);
                }
            }
        );
    }

    if (c.gain) {
        c.gain.addEventListener(
            "input",
            function () {
                if (c.gainValue) {
                    c.gainValue.textContent =
                        this.value + " dB";
                }

                if (audioStarted) {
                    updateFilter(band);
                }
            }
        );
    }

    if (c.q) {
        c.q.addEventListener(
            "input",
            function () {
                if (c.qValue) {
                    c.qValue.textContent =
                        Number(
                            this.value
                        ).toFixed(1);
                }

                if (audioStarted) {
                    updateFilter(band);
                }
            }
        );
    }
});

const presets = {
    "Flat": [
        [120, 0, 1],
        [1000, 0, 1],
        [5000, 0, 1]
    ],

    "Bass Boost": [
        [100, 10, 1],
        [800, -2, 1],
        [5000, 1, 1]
    ],

    "Vocal": [
        [200, -4, 1],
        [2500, 6, 1],
        [8000, 3, 1]
    ],

    "Rock": [
        [120, 6, 1],
        [800, -4, 1],
        [6000, 7, 1]
    ],

    "Treble Boost": [
        [200, 0, 1],
        [2000, 2, 1],
        [6000, 8, 1]
    ]
};

const presetButtons =
    document.querySelectorAll(
        ".presets button"
    );

presetButtons.forEach((button) => {
    button.addEventListener(
        "click",
        function () {
            const preset =
                presets[
                    this.textContent.trim()
                ];

            if (!preset) {
                return;
            }

            preset.forEach(
                (values, index) => {
                    const band =
                        index + 1;

                    const c =
                        controls[band];

                    if (c.freq) {
                        c.freq.value =
                            values[0];
                    }

                    if (c.gain) {
                        c.gain.value =
                            values[1];
                    }

                    if (c.q) {
                        c.q.value =
                            values[2];
                    }

                    updateDisplays(
                        band
                    );

                    if (audioStarted) {
                        updateFilter(
                            band
                        );
                    }
                }
            );

            presetButtons.forEach(
                (btn) =>
                    btn.classList.remove(
                        "active"
                    )
            );

            this.classList.add(
                "active"
            );
        }
    );
});

async function startPlayback() {
    if (!audioFile || !audioFile.files || !audioFile.files[0]) {
        alert(
            "Please select an audio file first."
        );
        return;
    }

    if (!audioPlayer.src) {
        alert(
            "Please select an audio file first."
        );
        return;
    }

    // Wait briefly for metadata if the browser is still loading the file.
    if (audioPlayer.readyState < 1) {
        audioPlayer.load();

        await new Promise((resolve, reject) => {
            let finished = false;

            const cleanup = () => {
                audioPlayer.removeEventListener("loadedmetadata", onReady);
                audioPlayer.removeEventListener("error", onError);
            };

            const onReady = () => {
                if (finished) return;
                finished = true;
                cleanup();
                resolve();
            };

            const onError = () => {
                if (finished) return;
                finished = true;
                cleanup();
                reject(audioPlayer.error || new Error("Audio could not be loaded."));
            };

            audioPlayer.addEventListener("loadedmetadata", onReady, { once: true });
            audioPlayer.addEventListener("error", onError, { once: true });
        });
    }

    if (!audioStarted) {
        setupAudio();
    }

    if (
        audioContext &&
        audioContext.state === "suspended"
    ) {
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

    spectrumStopped = false;
    spectrumFrozen = false;
    spectrumAudioActive = true;

    await audioPlayer.play();
}

playBtn.addEventListener(
    "click",
    async function () {
        try {
            if (audioPlayer.paused) {
                await startPlayback();
            } else {
                audioPlayer.pause();

                spectrumAudioActive =
                    false;

                spectrumFrozen =
                    true;
            }
        } catch (error) {
            console.error(
                "Playback error:",
                error
            );
        }
    }
);

const pauseBtn =
    document.getElementById(
        "pauseBtn"
    );

if (pauseBtn) {
    pauseBtn.addEventListener(
        "click",
        async function () {
            try {
                if (audioPlayer.paused) {
                    await startPlayback();
                } else {
                    audioPlayer.pause();

                    spectrumAudioActive =
                        false;

                    spectrumFrozen =
                        true;
                }
            } catch (error) {
                console.error(
                    "Pause/Play error:",
                    error
                );
            }
        }
    );
}

stopBtn.addEventListener(
    "click",
    function () {
        audioPlayer.pause();

        try {
            audioPlayer.currentTime = 0;
        } catch (error) {
            console.warn("Could not reset audio position:", error);
        }

        spectrumAudioActive = false;
        spectrumFrozen = false;
        spectrumStopped = true;

        if (originalSpectrumData) {
            originalSpectrumData.fill(-80);
        }

        if (processedSpectrumData) {
            processedSpectrumData.fill(-80);
        }

        resetSpectrumPeaks();

        originalHoverFrequency = null;
        originalHoverAmplitude = null;

        processedHoverFrequency = null;
        processedHoverAmplitude = null;

        originalMouseInside = false;
        processedMouseInside = false;
    }
);

function getCanvasSize(
    canvas,
    ctx
) {
    const rect =
        canvas.getBoundingClientRect();

    const width =
        Math.max(
            1,
            Math.floor(rect.width)
        );

    const height =
        Math.max(
            1,
            Math.floor(rect.height)
        );

    const dpr =
        Math.max(
            1,
            window.devicePixelRatio || 1
        );

    const requiredWidth =
        Math.max(
            1,
            Math.floor(width * dpr)
        );

    const requiredHeight =
        Math.max(
            1,
            Math.floor(height * dpr)
        );

    if (
        canvas.width !== requiredWidth ||
        canvas.height !== requiredHeight
    ) {
        canvas.width =
            requiredWidth;

        canvas.height =
            requiredHeight;
    }

    if (ctx) {
        ctx.setTransform(
            dpr,
            0,
            0,
            dpr,
            0,
            0
        );
    }

    return {
        width,
        height,
        dpr
    };
}

function formatFrequency(freq) {
    if (!Number.isFinite(freq)) {
        return "--";
    }

    if (freq >= 1000) {
        return (
            (freq / 1000).toFixed(
                freq >= 10000 ? 1 : 2
            ) + " kHz"
        );
    }

    return (
        Math.round(freq) +
        " Hz"
    );
}

function formatAmplitude(value) {
    if (!Number.isFinite(value)) {
        return "--";
    }

    const db =
        Math.max(
            MIN_DB,
            Math.min(
                MAX_DB,
                Number(value)
            )
        );

    return (
        db.toFixed(1) +
        " dB"
    );
}

function drawSpectrumGrid(
    ctx,
    width,
    height,
    title
) {
    const left = 58;
    const right = 18;
    const top = 45;
    const bottom = 45;

    const graphWidth =
        width -
        left -
        right;

    const graphHeight =
        height -
        top -
        bottom;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    ctx.fillStyle =
        "#0d1117";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    ctx.font =
        "bold 16px Arial";

    ctx.fillStyle =
        "#e6edf3";

    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";

    ctx.fillText(
        title,
        width / 2,
        20
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.10)";

    ctx.lineWidth = 1;

    const frequencyMarks = [
        0,
        2000,
        4000,
        6000,
        8000,
        10000,
        12000
    ];

    frequencyMarks.forEach(
        (freq) => {
            const x =
                left +
                (freq /
                    MAX_DISPLAY_FREQUENCY) *
                    graphWidth;

            ctx.beginPath();

            ctx.moveTo(
                x,
                top
            );

            ctx.lineTo(
                x,
                top +
                    graphHeight
            );

            ctx.stroke();
        }
    );

    const dbMarks = [
        0,
        -20,
        -40,
        -60,
        -80
    ];

    dbMarks.forEach(
        (db) => {
            const y =
                top +
                ((MAX_DB - db) /
                    (MAX_DB - MIN_DB)) *
                    graphHeight;

            ctx.beginPath();

            ctx.moveTo(
                left,
                y
            );

            ctx.lineTo(
                left +
                    graphWidth,
                y
            );

            ctx.stroke();
        }
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.55)";

    ctx.lineWidth = 1.2;

    ctx.beginPath();

    ctx.moveTo(
        left,
        top
    );

    ctx.lineTo(
        left,
        top +
            graphHeight
    );

    ctx.lineTo(
        left +
            graphWidth,
        top +
            graphHeight
    );

    ctx.stroke();

    ctx.font =
        "12px Arial";

    ctx.fillStyle =
        "#aeb7c4";

    ctx.textAlign =
        "center";

    frequencyMarks.forEach(
        (freq) => {
            const x =
                left +
                (freq /
                    MAX_DISPLAY_FREQUENCY) *
                    graphWidth;

            ctx.fillText(
                freq === 0
                    ? "0"
                    : freq / 1000 +
                      "k",
                x,
                top +
                    graphHeight +
                    22
            );
        }
    );

    ctx.textAlign =
        "right";

    dbMarks.forEach(
        (db) => {
            const y =
                top +
                ((MAX_DB - db) /
                    (MAX_DB - MIN_DB)) *
                    graphHeight;

            ctx.fillText(
                db + " dB",
                left - 8,
                y + 4
            );
        }
    );

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "#aeb7c4";

    ctx.fillText(
        "Frequency",
        left +
            graphWidth / 2,
        height - 10
    );

    ctx.save();

    ctx.translate(
        15,
        top +
            graphHeight / 2
    );

    ctx.rotate(
        -Math.PI / 2
    );

    ctx.fillText(
        "Amplitude (dB)",
        0,
        0
    );

    ctx.restore();

    return {
        left,
        right,
        top,
        bottom,
        graphWidth,
        graphHeight
    };
}

function findPeak(
    data,
    sampleRate
) {
    if (
        !data ||
        !data.length ||
        !sampleRate
    ) {
        return {
            frequency: null,
            amplitude: null
        };
    }

    const nyquist =
        sampleRate / 2;

    const maxIndex =
        Math.min(
            data.length - 1,
            Math.floor(
                MAX_DISPLAY_FREQUENCY /
                    nyquist *
                    (data.length - 1)
            )
        );

    let peakIndex = 1;
    let peakValue = -Infinity;

    for (
        let i = 1;
        i <= maxIndex;
        i++
    ) {
        const value =
            data[i];

        if (
            Number.isFinite(value) &&
            value > peakValue
        ) {
            peakValue = value;
            peakIndex = i;
        }
    }

    if (
        !Number.isFinite(
            peakValue
        )
    ) {
        return {
            frequency: null,
            amplitude: null
        };
    }

    const frequency =
        peakIndex *
        sampleRate /
        FFT_SIZE;

    return {
        frequency,
        amplitude:
            Math.max(
                MIN_DB,
                Math.min(
                    MAX_DB,
                    peakValue
                )
            )
    };
}

function updateOriginalInfo() {
    if (!originalInfo) {
        return;
    }

    originalInfo.innerHTML = `
        <span>
            <strong>Original Audio</strong>
        </span>

        <span>
            <strong>Peak Frequency:</strong>
            ${
                originalPeakFrequency === null
                    ? "--"
                    : formatFrequency(
                        originalPeakFrequency
                    )
            }
        </span>

        <span>
            <strong>Peak Amplitude:</strong>
            ${
                originalPeakAmplitude === null
                    ? "--"
                    : formatAmplitude(
                        originalPeakAmplitude
                    )
            }
        </span>
    `;
}

function updateProcessedInfo() {
    if (!processedInfo) {
        return;
    }

    processedInfo.innerHTML = `
        <span>
            <strong>Processed Audio</strong>
        </span>

        <span>
            <strong>Peak Frequency:</strong>
            ${
                processedPeakFrequency === null
                    ? "--"
                    : formatFrequency(
                        processedPeakFrequency
                    )
            }
        </span>

        <span>
            <strong>Peak Amplitude:</strong>
            ${
                processedPeakAmplitude === null
                    ? "--"
                    : formatAmplitude(
                        processedPeakAmplitude
                    )
            }
        </span>
    `;
}

function drawSpectrumCurve(
    ctx,
    data,
    sampleRate,
    geometry,
    lineColor
) {
    const {
        left,
        top,
        graphWidth,
        graphHeight
    } = geometry;

    const nyquist =
        sampleRate / 2;

    const maxBin =
        Math.min(
            data.length - 1,
            Math.floor(
                MAX_DISPLAY_FREQUENCY /
                    nyquist *
                    (data.length - 1)
            )
        );

    ctx.beginPath();

    let started = false;

    for (
        let i = 0;
        i <= maxBin;
        i++
    ) {
        const frequency =
            i *
            sampleRate /
            FFT_SIZE;

        const x =
            left +
            (frequency /
                MAX_DISPLAY_FREQUENCY) *
                graphWidth;

        let db =
            data[i];

        if (!Number.isFinite(db)) {
            db = MIN_DB;
        }

        db =
            Math.max(
                MIN_DB,
                Math.min(
                    MAX_DB,
                    db
                )
            );

        const y =
            top +
            ((MAX_DB - db) /
                (MAX_DB - MIN_DB)) *
                graphHeight;

        if (!started) {
            ctx.moveTo(x, y);
            started = true;
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.strokeStyle =
        lineColor;

    ctx.lineWidth = 2;

    ctx.stroke();
}

function drawPeakMarker(
    ctx,
    data,
    sampleRate,
    geometry,
    peakFrequency,
    lineColor
) {
    if (
        !ctx ||
        !data ||
        !sampleRate ||
        !geometry ||
        peakFrequency === null
    ) {
        return;
    }

    const {
        left,
        top,
        graphWidth,
        graphHeight
    } = geometry;

    const frequency =
        peakFrequency;

    let index =
        Math.round(
            frequency *
                FFT_SIZE /
                sampleRate
        );

    index =
        Math.max(
            0,
            Math.min(
                data.length - 1,
                index
            )
        );

    let db =
        data[index];

    if (!Number.isFinite(db)) {
        return;
    }

    db =
        Math.max(
            MIN_DB,
            Math.min(
                MAX_DB,
                db
            )
        );

    const x =
        left +
        (frequency /
            MAX_DISPLAY_FREQUENCY) *
            graphWidth;

    const y =
        top +
        ((MAX_DB - db) /
            (MAX_DB - MIN_DB)) *
            graphHeight;

    // PEAK = ORANGE
    ctx.save();

    ctx.strokeStyle =
        "#f59e0b";

    ctx.globalAlpha =
        0.55;

    ctx.setLineDash(
        [5, 5]
    );

    ctx.beginPath();

    ctx.moveTo(
        x,
        top
    );

    ctx.lineTo(
        x,
        top +
            graphHeight
    );

    ctx.stroke();

    ctx.restore();

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        4,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#f59e0b";

    ctx.fill();

    ctx.font =
        "bold 12px Arial";

    ctx.fillStyle =
        "#f59e0b";

    ctx.textAlign =
        "center";

    ctx.fillText(
        formatFrequency(
            frequency
        ),
        x,
        Math.max(
            34,
            y - 10
        )
    );
}

function drawHover(
    ctx,
    canvas,
    data,
    sampleRate,
    geometry,
    hoverFrequency,
    lineColor
) {
    if (
        !ctx ||
        !canvas ||
        !data ||
        !sampleRate ||
        !geometry ||
        hoverFrequency === null
    ) {
        return;
    }

    const {
        left,
        top,
        graphWidth,
        graphHeight
    } = geometry;

    const safeFrequency =
        Math.max(
            0,
            Math.min(
                MAX_DISPLAY_FREQUENCY,
                hoverFrequency
            )
        );

    const binWidth =
        sampleRate /
        FFT_SIZE;

    let index =
        Math.round(
            safeFrequency /
                binWidth
        );

    index =
        Math.max(
            0,
            Math.min(
                data.length - 1,
                index
            )
        );

    let db =
        Number(
            data[index]
        );

    if (!Number.isFinite(db)) {
        db = MIN_DB;
    }

    db =
        Math.max(
            MIN_DB,
            Math.min(
                MAX_DB,
                db
            )
        );

    const actualFrequency =
        index *
        binWidth;

    const x =
        left +
        (actualFrequency /
            MAX_DISPLAY_FREQUENCY) *
            graphWidth;

    const yRatio =
        (MAX_DB - db) /
        (MAX_DB - MIN_DB);

    const y =
        top +
        Math.max(
            0,
            Math.min(
                1,
                yRatio
            )
        ) *
            graphHeight;

    ctx.save();

    // HOVER = CYAN
    ctx.strokeStyle =
        "#06b6d4";

    ctx.lineWidth = 1;

    ctx.setLineDash(
        [4, 4]
    );

    ctx.beginPath();

    ctx.moveTo(
        x,
        top
    );

    ctx.lineTo(
        x,
        top +
            graphHeight
    );

    ctx.stroke();

    ctx.setLineDash([]);

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        4,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#06b6d4";

    ctx.fill();

    const tooltipText =
        formatFrequency(
            actualFrequency
        ) +
        " | " +
        formatAmplitude(
            db
        );

    ctx.font =
        "12px Arial";

    const padding = 8;

    const tooltipWidth =
        ctx.measureText(
            tooltipText
        ).width +
        padding * 2;

    const tooltipHeight =
        24;

    const canvasWidth =
        canvas
            .getBoundingClientRect()
            .width;

    const canvasHeight =
        canvas
            .getBoundingClientRect()
            .height;

    let tooltipX =
        x + 12;

    if (
        tooltipX +
            tooltipWidth >
        canvasWidth - 4
    ) {
        tooltipX =
            x -
            tooltipWidth -
            12;
    }

    tooltipX =
        Math.max(
            4,
            Math.min(
                canvasWidth -
                    tooltipWidth -
                    4,
                tooltipX
            )
        );

    let tooltipY =
        y -
        tooltipHeight -
        10;

    if (
        tooltipY <
        top + 4
    ) {
        tooltipY =
            y + 10;
    }

    if (
        tooltipY +
            tooltipHeight >
        canvasHeight - 4
    ) {
        tooltipY =
            canvasHeight -
            tooltipHeight -
            4;
    }

    ctx.fillStyle =
        "rgba(0,0,0,0.88)";

    ctx.fillRect(
        tooltipX,
        tooltipY,
        tooltipWidth,
        tooltipHeight
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.18)";

    ctx.strokeRect(
        tooltipX,
        tooltipY,
        tooltipWidth,
        tooltipHeight
    );

    ctx.fillStyle =
        "#ffffff";

    ctx.textAlign =
        "left";

    ctx.textBaseline =
        "middle";

    ctx.fillText(
        tooltipText,
        tooltipX +
            padding,
        tooltipY +
            tooltipHeight / 2
    );

    ctx.restore();
}

function drawSingleSpectrum(
    ctx,
    canvas,
    data,
    sampleRate,
    title,
    lineColor,
    peakFrequency,
    hoverFrequency
) {
    if (!ctx || !canvas) {
        return;
    }

    const size =
        getCanvasSize(
            canvas,
            ctx
        );

    const geometry =
        drawSpectrumGrid(
            ctx,
            size.width,
            size.height,
            title
        );

    if (spectrumStopped) {
        return;
    }

    drawSpectrumCurve(
        ctx,
        data,
        sampleRate,
        geometry,
        lineColor
    );

    drawPeakMarker(
        ctx,
        data,
        sampleRate,
        geometry,
        peakFrequency,
        lineColor
    );

    drawHover(
        ctx,
        canvas,
        data,
        sampleRate,
        geometry,
        hoverFrequency,
        lineColor
    );
}

function updateSpectrumData() {
    if (
        !originalAnalyser ||
        !processedAnalyser
    ) {
        return;
    }

    if (spectrumFrozen) {
        return;
    }

    if (spectrumStopped) {
        originalSpectrumData.fill(-80);
        processedSpectrumData.fill(-80);
        return;
    }

    originalAnalyser.getFloatFrequencyData(
        originalSpectrumData
    );

    processedAnalyser.getFloatFrequencyData(
        processedSpectrumData
    );

    const originalPeak =
        findPeak(
            originalSpectrumData,
            audioContext.sampleRate
        );

    originalPeakFrequency =
        originalPeak.frequency;

    originalPeakAmplitude =
        originalPeak.amplitude;

    const processedPeak =
        findPeak(
            processedSpectrumData,
            audioContext.sampleRate
        );

    processedPeakFrequency =
        processedPeak.frequency;

    processedPeakAmplitude =
        processedPeak.amplitude;

    updateOriginalInfo();
    updateProcessedInfo();
}

function drawSpectrum() {
    requestAnimationFrame(
        drawSpectrum
    );

    if (
        !originalCanvas ||
        !processedCanvas
    ) {
        return;
    }

    if (
        audioStarted &&
        spectrumAudioActive &&
        !spectrumFrozen &&
        !spectrumStopped
    ) {
        updateSpectrumData();
    }

    const sampleRate =
        audioContext
            ? audioContext.sampleRate
            : 44100;

    drawSingleSpectrum(
        originalCtx,
        originalCanvas,
        originalSpectrumData,
        sampleRate,
        "Original Audio Spectrum",
        "#3b82f6",
        originalPeakFrequency,
        originalHoverFrequency
    );

    drawSingleSpectrum(
        processedCtx,
        processedCanvas,
        processedSpectrumData,
        sampleRate,
        "Processed Audio Spectrum",
        "#22c55e",
        processedPeakFrequency,
        processedHoverFrequency
    );
}

function getFrequencyFromMouse(
    event,
    canvas
) {
    const rect =
        canvas.getBoundingClientRect();

    const x =
        event.clientX -
        rect.left;

    const left = 58;
    const right = 18;

    const usableWidth =
        Math.max(
            1,
            rect.width -
                left -
                right
        );

    if (
        x < left ||
        x >
            left +
                usableWidth
    ) {
        return null;
    }

    const ratio =
        Math.max(
            0,
            Math.min(
                1,
                (x - left) /
                    usableWidth
            )
        );

    return (
        ratio *
        MAX_DISPLAY_FREQUENCY
    );
}

if (originalCanvas) {
    originalCanvas.addEventListener(
        "mousemove",
        function (event) {
            const frequency =
                getFrequencyFromMouse(
                    event,
                    originalCanvas
                );

            if (frequency === null) {
                originalHoverFrequency =
                    null;

                originalHoverAmplitude =
                    null;

                return;
            }

            if (
                !audioContext ||
                !originalSpectrumData.length
            ) {
                return;
            }

            const binWidth =
                audioContext.sampleRate /
                FFT_SIZE;

            let index =
                Math.round(
                    frequency /
                        binWidth
                );

            index =
                Math.max(
                    0,
                    Math.min(
                        originalSpectrumData.length -
                            1,
                        index
                    )
                );

            const actualFrequency =
                index *
                binWidth;

            let value =
                Number(
                    originalSpectrumData[
                        index
                    ]
                );

            if (
                !Number.isFinite(
                    value
                )
            ) {
                value = MIN_DB;
            }

            originalHoverFrequency =
                Math.max(
                    0,
                    Math.min(
                        MAX_DISPLAY_FREQUENCY,
                        actualFrequency
                    )
                );

            originalHoverAmplitude =
                Math.max(
                    MIN_DB,
                    Math.min(
                        MAX_DB,
                        value
                    )
                );
        }
    );

    originalCanvas.addEventListener(
        "mouseleave",
        function () {
            originalHoverFrequency =
                null;

            originalHoverAmplitude =
                null;
        }
    );
}

if (processedCanvas) {
    processedCanvas.addEventListener(
        "mousemove",
        function (event) {
            const frequency =
                getFrequencyFromMouse(
                    event,
                    processedCanvas
                );

            if (frequency === null) {
                processedHoverFrequency =
                    null;

                processedHoverAmplitude =
                    null;

                return;
            }

            if (
                !audioContext ||
                !processedSpectrumData.length
            ) {
                return;
            }

            const binWidth =
                audioContext.sampleRate /
                FFT_SIZE;

            let index =
                Math.round(
                    frequency /
                        binWidth
                );

            index =
                Math.max(
                    0,
                    Math.min(
                        processedSpectrumData.length -
                            1,
                        index
                    )
                );

            const actualFrequency =
                index *
                binWidth;

            let value =
                Number(
                    processedSpectrumData[
                        index
                    ]
                );

            if (
                !Number.isFinite(
                    value
                )
            ) {
                value = MIN_DB;
            }

            processedHoverFrequency =
                Math.max(
                    0,
                    Math.min(
                        MAX_DISPLAY_FREQUENCY,
                        actualFrequency
                    )
                );

            processedHoverAmplitude =
                Math.max(
                    MIN_DB,
                    Math.min(
                        MAX_DB,
                        value
                    )
                );
        }
    );

    processedCanvas.addEventListener(
        "mouseleave",
        function () {
            processedHoverFrequency =
                null;

            processedHoverAmplitude =
                null;
        }
    );
}

window.addEventListener(
    "resize",
    function () {
        if (originalCanvas) {
            getCanvasSize(
                originalCanvas,
                originalCtx
            );
        }

        if (processedCanvas) {
            getCanvasSize(
                processedCanvas,
                processedCtx
            );
        }
    }
);

function createOfflineEQFilters(
    context
) {
    const filters = [];

    for (let i = 0; i < 3; i++) {
        const c = controls[i + 1];

        const filter =
            context.createBiquadFilter();

        filter.type = "peaking";

        filter.frequency.value =
            Number(c.freq.value);

        filter.gain.value =
            Number(c.gain.value);

        filter.Q.value =
            Number(c.q.value);

        filters.push(filter);
    }

    return filters;
}

function createOfflineNoiseReduction(
    context
) {
    const hp =
        context.createBiquadFilter();

    hp.type = "highpass";
    hp.frequency.value = 75;
    hp.Q.value = 0.707;

    const lp =
        context.createBiquadFilter();

    lp.type = "lowpass";
    lp.frequency.value = 11500;
    lp.Q.value = 0.707;

    const gate =
        context.createDynamicsCompressor();

    gate.threshold.value = -38;
    gate.knee.value = 0;
    gate.ratio.value = 20;
    gate.attack.value = 0.003;
    gate.release.value = 0.12;

    return {
        hp,
        lp,
        gate
    };
}

async function exportAudio() {
    if (
        !audioFile ||
        !audioFile.files ||
        !audioFile.files[0]
    ) {
        alert(
            "Please select an audio file first."
        );

        return;
    }

    const file =
        audioFile.files[0];

    if (exportBtn) {
        exportBtn.disabled = true;

        exportBtn.textContent =
            "Exporting...";
    }

    try {
        const arrayBuffer =
            await file.arrayBuffer();

        const decodeContext =
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

        const decoded =
            await decodeContext.decodeAudioData(
                arrayBuffer
            );

        await decodeContext.close();

        const offlineContext =
            new OfflineAudioContext(
                decoded.numberOfChannels,
                decoded.length,
                decoded.sampleRate
            );

        const offlineSource =
            offlineContext.createBufferSource();

        offlineSource.buffer =
            decoded;

        const filters =
            createOfflineEQFilters(
                offlineContext
            );

        offlineSource.connect(
            filters[0]
        );

        filters[0].connect(
            filters[1]
        );

        filters[1].connect(
            filters[2]
        );

        if (noiseReductionOn) {
            const nr =
                createOfflineNoiseReduction(
                    offlineContext
                );

            filters[2].connect(
                nr.hp
            );

            nr.hp.connect(
                nr.lp
            );

            nr.lp.connect(
                nr.gate
            );

            nr.gate.connect(
                offlineContext.destination
            );
        } else {
            filters[2].connect(
                offlineContext.destination
            );
        }

        offlineSource.start(0);

        const renderedBuffer =
            await offlineContext.startRendering();

        const wavBlob =
            audioBufferToWav(
                renderedBuffer
            );

        const url =
            URL.createObjectURL(
                wavBlob
            );

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            "AudioLab_Processed.wav";

        document.body.appendChild(
            link
        );

        link.click();

        document.body.removeChild(
            link
        );

        setTimeout(
            () => {
                URL.revokeObjectURL(
                    url
                );
            },
            1000
        );
    } catch (error) {
        console.error(
            "Audio export failed:",
            error
        );

        alert(
            "Audio export failed. Please try again."
        );
    } finally {
        if (exportBtn) {
            exportBtn.disabled = false;

            exportBtn.textContent =
                "Export WAV";
        }
    }
}

function updateNoiseButton() {
    if (!noiseBtn) {
        return;
    }

    if (noiseReductionOn) {
        noiseBtn.textContent =
            "Noise Reduction: ON";

        noiseBtn.classList.add(
            "active"
        );
    } else {
        noiseBtn.textContent =
            "Noise Reduction: OFF";

        noiseBtn.classList.remove(
            "active"
        );
    }
}

if (noiseBtn) {
    noiseBtn.addEventListener(
        "click",
        function () {
            if (!audioStarted) {
                setupAudio();
            }

            noiseReductionOn =
                !noiseReductionOn;

            if (
                !audioStarted ||
                !dryGain ||
                !wetGain
            ) {
                updateNoiseButton();
                return;
            }

            const now =
                audioContext.currentTime;

            if (noiseReductionOn) {
                dryGain.gain.cancelScheduledValues(
                    now
                );

                wetGain.gain.cancelScheduledValues(
                    now
                );

                dryGain.gain.setTargetAtTime(
                    0,
                    now,
                    0.01
                );

                wetGain.gain.setTargetAtTime(
                    1,
                    now,
                    0.01
                );
            } else {
                dryGain.gain.cancelScheduledValues(
                    now
                );

                wetGain.gain.cancelScheduledValues(
                    now
                );

                dryGain.gain.setTargetAtTime(
                    1,
                    now,
                    0.01
                );

                wetGain.gain.setTargetAtTime(
                    0,
                    now,
                    0.01
                );
            }

            updateNoiseButton();
        }
    );
}

function audioBufferToWav(
    buffer
) {
    const numChannels =
        buffer.numberOfChannels;

    const sampleRate =
        buffer.sampleRate;

    const numSamples =
        buffer.length;

    const bytesPerSample = 2;

    const blockAlign =
        numChannels *
        bytesPerSample;

    const byteRate =
        sampleRate *
        blockAlign;

    const dataSize =
        numSamples *
        blockAlign;

    const arrayBuffer =
        new ArrayBuffer(
            44 + dataSize
        );

    const view =
        new DataView(
            arrayBuffer
        );

    writeString(
        view,
        0,
        "RIFF"
    );

    view.setUint32(
        4,
        36 + dataSize,
        true
    );

    writeString(
        view,
        8,
        "WAVE"
    );

    writeString(
        view,
        12,
        "fmt "
    );

    view.setUint32(
        16,
        16,
        true
    );

    view.setUint16(
        20,
        1,
        true
    );

    view.setUint16(
        22,
        numChannels,
        true
    );

    view.setUint32(
        24,
        sampleRate,
        true
    );

    view.setUint32(
        28,
        byteRate,
        true
    );

    view.setUint16(
        32,
        blockAlign,
        true
    );

    view.setUint16(
        34,
        16,
        true
    );

    writeString(
        view,
        36,
        "data"
    );

    view.setUint32(
        40,
        dataSize,
        true
    );

    const channels = [];

    for (
        let channel = 0;
        channel < numChannels;
        channel++
    ) {
        channels.push(
            buffer.getChannelData(
                channel
            )
        );
    }

    let offset = 44;

    for (
        let i = 0;
        i < numSamples;
        i++
    ) {
        for (
            let channel = 0;
            channel < numChannels;
            channel++
        ) {
            let sample =
                channels[channel][i];

            sample =
                Math.max(
                    -1,
                    Math.min(
                        1,
                        sample
                    )
                );

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
        {
            type: "audio/wav"
        }
    );
}

function writeString(
    view,
    offset,
    string
) {
    for (
        let i = 0;
        i < string.length;
        i++
    ) {
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
resetSpectrumPeaks();
