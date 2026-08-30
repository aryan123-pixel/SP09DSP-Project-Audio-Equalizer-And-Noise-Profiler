// ==========================================
// SP09 AudioLab
// 3-Band Parametric Equalizer
// + Spectrum Analyzer
// Stable Audio Playback Version
// ==========================================


// ==========================================
// ELEMENTS
// ==========================================

const audioFile = document.getElementById("audioFile");
const audioPlayer = document.getElementById("audioPlayer");

const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");

const noiseBtn = document.getElementById("noiseBtn");

const canvas = document.getElementById("spectrum");
const ctx = canvas.getContext("2d");


// ==========================================
// AUDIO VARIABLES
// ==========================================

let audioContext = null;
let source = null;
let analyser = null;

let eqFilters = [];

let audioStarted = false;
let noiseHighPass = null;
let noiseLowPass = null;
let noiseCompressor = null;

let dryGain = null;
let wetGain = null;

// ==========================================
// EQ CONTROLS
// ==========================================

const bands = [1, 2, 3];

const controls = {};

bands.forEach((band) => {

    controls[band] = {

        freq:
            document.getElementById(`freq${band}`),

        gain:
            document.getElementById(`gain${band}`),

        q:
            document.getElementById(`q${band}`),

        freqValue:
            document.getElementById(`freq${band}Value`),

        gainValue:
            document.getElementById(`gain${band}Value`),

        qValue:
            document.getElementById(`q${band}Value`)
    };

});


// ==========================================
// INITIAL DISPLAY
// ==========================================

bands.forEach((band) => {

    const c = controls[band];

    if (c.freq) {
        c.freqValue.textContent =
            c.freq.value + " Hz";
    }

    if (c.gain) {
        c.gainValue.textContent =
            c.gain.value + " dB";
    }

    if (c.q) {
        c.qValue.textContent =
            Number(c.q.value).toFixed(1);
    }

});


// ==========================================
// AUDIO FILE
// ==========================================

audioFile.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) {
        return;
    }

    console.log(
        "Selected file:",
        file.name,
        file.type,
        file.size
    );


    // Create local URL

    const url =
        URL.createObjectURL(file);


    // IMPORTANT:
    // Reset old audio position

    audioPlayer.pause();

    audioPlayer.currentTime = 0;


    // Set new audio

    audioPlayer.src = url;

    audioPlayer.load();


    // Check whether browser loaded metadata

    audioPlayer.onloadedmetadata = function () {

        console.log(
            "Audio duration:",
            audioPlayer.duration
        );

    };


    audioPlayer.onerror = function () {

        console.error(
            "Audio loading error:",
            audioPlayer.error
        );

    };

});


// ==========================================
// AUDIO SETUP
// ==========================================

function setupAudio() {

    if (audioStarted) {
        return;
    }


    // ----------------------------------------
    // Create AudioContext
    // ----------------------------------------

    audioContext = new (
        window.AudioContext ||
        window.webkitAudioContext
    )();


    // ----------------------------------------
    // Create media source
    // ----------------------------------------

    source =
        audioContext.createMediaElementSource(
            audioPlayer
        );


    // ----------------------------------------
    // Create 3 EQ filters
    // ----------------------------------------

    eqFilters = [];


    for (let i = 0; i < 3; i++) {

        const filter =
            audioContext.createBiquadFilter();


        filter.type = "peaking";


        filter.frequency.value =
            Number(
                controls[i + 1].freq.value
            );


        filter.gain.value =
            Number(
                controls[i + 1].gain.value
            );


        filter.Q.value =
            Number(
                controls[i + 1].q.value
            );


        eqFilters.push(filter);

    }


    // ----------------------------------------
    // Analyser
    // ----------------------------------------

    analyser =
        audioContext.createAnalyser();


    // Keep original spectrum resolution

    analyser.fftSize = 2048;

    analyser.smoothingTimeConstant = 0.8;


    // ----------------------------------------
    // Audio chain
    // ----------------------------------------

    // ==========================================
// EQ CHAIN
// ==========================================

source.connect(eqFilters[0]);

eqFilters[0].connect(eqFilters[1]);

eqFilters[1].connect(eqFilters[2]);


// ==========================================
// NOISE REDUCTION FILTERS
// ==========================================

// Remove very low frequency rumble
noiseHighPass =
    audioContext.createBiquadFilter();

noiseHighPass.type = "highpass";

noiseHighPass.frequency.value = 60;

noiseHighPass.Q.value = 0.7;


// Remove excessive high-frequency hiss
noiseLowPass =
    audioContext.createBiquadFilter();

noiseLowPass.type = "lowpass";

noiseLowPass.frequency.value = 14000;

noiseLowPass.Q.value = 0.7;


// Dynamics control
noiseCompressor =
    audioContext.createDynamicsCompressor();

noiseCompressor.threshold.value = -45;

noiseCompressor.knee.value = 20;

noiseCompressor.ratio.value = 6;

noiseCompressor.attack.value = 0.003;

noiseCompressor.release.value = 0.25;


// ==========================================
// DRY / WET MIX
// ==========================================

dryGain =
    audioContext.createGain();

wetGain =
    audioContext.createGain();


// Noise Reduction OFF initially

dryGain.gain.value = 1;

wetGain.gain.value = 0;


// ==========================================
// DRY PATH
// ==========================================

eqFilters[2].connect(dryGain);

dryGain.connect(analyser);


// ==========================================
// PROCESSED PATH
// ==========================================

eqFilters[2].connect(noiseHighPass);

noiseHighPass.connect(noiseLowPass);

noiseLowPass.connect(noiseCompressor);

noiseCompressor.connect(wetGain);

wetGain.connect(analyser);


// ==========================================
// OUTPUT
// ==========================================

analyser.connect(
    audioContext.destination
);


    audioStarted = true;


    // Start spectrum

    drawSpectrum();

}


// ==========================================
// UPDATE FILTER
// ==========================================

function updateFilter(band) {

    if (!eqFilters[band - 1]) {
        return;
    }


    const filter =
        eqFilters[band - 1];

    const c =
        controls[band];


    filter.frequency.value =
        Number(c.freq.value);


    filter.gain.value =
        Number(c.gain.value);


    filter.Q.value =
        Number(c.q.value);

}


// ==========================================
// EQ CONTROLS
// ==========================================

bands.forEach((band) => {

    const c = controls[band];


    // Frequency

    c.freq.addEventListener(
        "input",
        function () {

            c.freqValue.textContent =
                this.value + " Hz";

            updateFilter(band);

        }
    );


    // Gain

    c.gain.addEventListener(
        "input",
        function () {

            c.gainValue.textContent =
                this.value + " dB";

            updateFilter(band);

        }
    );


    // Q

    c.q.addEventListener(
        "input",
        function () {

            c.qValue.textContent =
                Number(this.value).toFixed(1);

            updateFilter(band);

        }
    );

});


// ==========================================
// PRESETS
// ==========================================

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


// ==========================================
// PRESET BUTTONS
// ==========================================

const presetButtons =
    document.querySelectorAll(
        ".presets button"
    );


presetButtons.forEach((button) => {

    button.addEventListener(
        "click",
        function () {

            const preset =
                presets[this.textContent.trim()];


            if (!preset) {
                return;
            }


            preset.forEach(
                (values, index) => {

                    const band =
                        index + 1;

                    const c =
                        controls[band];


                    c.freq.value =
                        values[0];

                    c.gain.value =
                        values[1];

                    c.q.value =
                        values[2];


                    c.freqValue.textContent =
                        values[0] + " Hz";

                    c.gainValue.textContent =
                        values[1] + " dB";

                    c.qValue.textContent =
                        Number(values[2]).toFixed(1);


                    updateFilter(band);

                }
            );


            presetButtons.forEach(
                (btn) => {

                    btn.classList.remove(
                        "active"
                    );

                }
            );


            this.classList.add(
                "active"
            );

        }
    );

});


// ==========================================
// PLAY
// ==========================================

playBtn.addEventListener(
    "click",
    async function () {

        // --------------------------------------
        // Check audio source
        // --------------------------------------

        if (!audioPlayer.src) {

            alert(
                "Please select an audio file first."
            );

            return;

        }


        // --------------------------------------
        // Check duration
        // --------------------------------------

        if (
            audioPlayer.readyState < 1
        ) {

            alert(
                "Audio is still loading. Please wait a moment and press Play again."
            );

            return;

        }


        try {

            // ----------------------------------
            // Create DSP chain
            // ----------------------------------

            if (!audioStarted) {

                setupAudio();

            }


            // ----------------------------------
            // Resume AudioContext
            // ----------------------------------

            if (
                audioContext.state ===
                "suspended"
            ) {

                await audioContext.resume();

            }


            // ----------------------------------
            // Restart if audio ended
            // ----------------------------------

            if (
                audioPlayer.ended ||
                (
                    Number.isFinite(
                        audioPlayer.duration
                    ) &&
                    audioPlayer.currentTime >=
                        audioPlayer.duration
                )
            ) {

                audioPlayer.currentTime = 0;

            }


            // ----------------------------------
            // PLAY
            // ----------------------------------

            await audioPlayer.play();


            console.log(
                "Audio playing"
            );

        }

        catch (error) {

            console.error(
                "Playback error:",
                error
            );


            alert(
                "Audio play nahi ho raha. Browser Console mein error check karein."
            );

        }

    }
);


// ==========================================
// STOP
// ==========================================

stopBtn.addEventListener(
    "click",
    function () {

        audioPlayer.pause();

        audioPlayer.currentTime = 0;

    }
);


// ==========================================
// NOISE REDUCTION
// ==========================================

let noiseReductionOn = false;

noiseBtn.addEventListener(
    "click",
    function () {

        noiseReductionOn =
            !noiseReductionOn;


        // If audio has not started yet,
        // just remember the setting.

        if (!audioStarted) {

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

            return;
        }


        // ======================================
        // NOISE REDUCTION ON
        // ======================================

        if (noiseReductionOn) {

            // Original signal OFF

            dryGain.gain.setTargetAtTime(
                0,
                audioContext.currentTime,
                0.01
            );


            // Cleaned signal ON

            wetGain.gain.setTargetAtTime(
                1,
                audioContext.currentTime,
                0.01
            );


            noiseBtn.textContent =
                "Noise Reduction: ON";


            noiseBtn.classList.add(
                "active"
            );


            console.log(
                "Noise reduction ON"
            );

        }


        // ======================================
        // NOISE REDUCTION OFF
        // ======================================

        else {

            // Cleaned signal OFF

            wetGain.gain.setTargetAtTime(
                0,
                audioContext.currentTime,
                0.01
            );


            // Original signal ON

            dryGain.gain.setTargetAtTime(
                1,
                audioContext.currentTime,
                0.01
            );


            noiseBtn.textContent =
                "Noise Reduction: OFF";


            noiseBtn.classList.remove(
                "active"
            );


            console.log(
                "Noise reduction OFF"
            );

        }

    }
);


// ==========================================
// SPECTRUM ANALYZER
//
// ORIGINAL SCALE:
// 0 Hz -> 24 kHz
//
// DO NOT CHANGE
// ==========================================

function drawSpectrum() {

    requestAnimationFrame(
        drawSpectrum
    );


    if (
        !analyser ||
        !audioContext
    ) {

        return;

    }


    // ==========================================
    // CANVAS
    // ==========================================

    const width =
        canvas.clientWidth;

    const height =
        canvas.clientHeight;


    if (
        width <= 0 ||
        height <= 0
    ) {

        return;

    }


    canvas.width = width;
    canvas.height = height;


    // ==========================================
    // FFT
    // ==========================================

    const bufferLength =
        analyser.frequencyBinCount;


    const dataArray =
        new Float32Array(
            bufferLength
        );


    analyser.getFloatFrequencyData(
        dataArray
    );


    // ==========================================
    // GRAPH AREA
    // ==========================================

    const left = 65;
    const right = 20;
    const top = 20;
    const bottom = 55;


    const graphWidth =
        width -
        left -
        right;


    const graphHeight =
        height -
        top -
        bottom;


    // ==========================================
    // CLEAR
    // ==========================================

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    ctx.fillStyle =
        "#0b0e13";


    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    // ==========================================
    // dB RANGE
    // ==========================================

    const minDb = -80;
    const maxDb = 0;


    // ==========================================
    // dB GRID
    // ==========================================

    ctx.font =
        "12px Arial";

    ctx.textAlign =
        "right";

    ctx.textBaseline =
        "middle";


    for (
        let db = 0;
        db >= -80;
        db -= 10
    ) {

        const y =
            top +
            (
                (maxDb - db) /
                (maxDb - minDb)
            ) *
            graphHeight;


        ctx.strokeStyle =
            "#252b36";

        ctx.lineWidth = 1;


        ctx.beginPath();

        ctx.moveTo(
            left,
            y
        );

        ctx.lineTo(
            width - right,
            y
        );

        ctx.stroke();


        ctx.fillStyle =
            "#c5ccd8";


        ctx.fillText(
            `${db} dB`,
            left - 8,
            y
        );

    }


    // ==========================================
    // FREQUENCY
    //
    // 0 -> 24 kHz
    // ==========================================

    const maxFreq =
        audioContext.sampleRate / 2;


    const divisions = 10;


    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "top";

    ctx.font =
        "11px Arial";


    for (
        let i = 0;
        i <= divisions;
        i++
    ) {

        const frequency =
            (
                i / divisions
            ) *
            maxFreq;


        const x =
            left +
            (
                i / divisions
            ) *
            graphWidth;


        // Vertical grid

        ctx.strokeStyle =
            "#202631";

        ctx.lineWidth = 1;


        ctx.beginPath();

        ctx.moveTo(
            x,
            top
        );

        ctx.lineTo(
            x,
            top + graphHeight
        );

        ctx.stroke();


        // Label

        let label;


        if (
            frequency >= 1000
        ) {

            label =
                `${(
                    frequency / 1000
                ).toFixed(1)}k`;

        }

        else {

            label =
                `${Math.round(
                    frequency
                )}`;

        }


        ctx.fillStyle =
            "#c5ccd8";


        ctx.fillText(
            label,
            x,
            top +
                graphHeight +
                8
        );

    }


    // ==========================================
    // AXIS TITLE
    // ==========================================

    ctx.font =
        "12px Arial";

    ctx.fillStyle =
        "#d5dbe5";

    ctx.textAlign =
        "center";


    ctx.fillText(
        "Frequency (Hz)",
        left +
            graphWidth / 2,
        height - 8
    );


    // ==========================================
    // SPECTRUM CURVE
    // ==========================================

    ctx.beginPath();

    ctx.strokeStyle =
        "#3b82f6";

    ctx.lineWidth = 2;

    ctx.lineJoin =
        "round";

    ctx.lineCap =
        "round";


    let started = false;


    for (
        let i = 0;
        i < bufferLength;
        i++
    ) {

        const frequency =
            (
                i *
                audioContext.sampleRate
            ) /
            analyser.fftSize;


        if (
            frequency < 0 ||
            frequency > maxFreq
        ) {

            continue;

        }


        // X

        const x =
            left +
            (
                frequency /
                maxFreq
            ) *
            graphWidth;


        // dB

        let db =
            dataArray[i];


        if (
            !Number.isFinite(db)
        ) {

            db = minDb;

        }


        db =
            Math.max(
                minDb,
                Math.min(
                    maxDb,
                    db
                )
            );


        // Y

        const y =
            top +
            (
                (maxDb - db) /
                (maxDb - minDb)
            ) *
            graphHeight;


        if (!started) {

            ctx.moveTo(
                x,
                y
            );

            started = true;

        }

        else {

            ctx.lineTo(
                x,
                y
            );

        }

    }


    ctx.stroke();

}