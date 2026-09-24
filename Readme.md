# AudioLab (SP09) - Real-Time Parametric Equalizer & Noise Reduction

AudioLab is a web-based, real-time audio processing application that provides a 3-band parametric equalizer, noise reduction capabilities, and real-time frequency spectrum visualization. It allows users to upload an audio file, apply various audio filters, and see the immediate impact on the audio spectrum.

## Features

*   **Audio Upload & Playback:** Upload any standard audio file (`.mp3`, `.wav`, etc.) and control playback with Play and Stop buttons, or use the native audio player controls.
*   **Real-Time Frequency Spectrum Visualization:** 
    *   Dual visualizers for comparing the **Original Audio** and the **Processed Audio**.
    *   Real-time peak frequency and peak amplitude detection.
*   **3-Band Parametric Equalizer:** Fine-tune your audio with three adjustable frequency bands:
    *   **Band 1 (Low):** Low-shelf filter for bass control (Frequency, Gain, Q-factor).
    *   **Band 2 (Mid):** Peaking filter for mid-range control (Frequency, Gain, Q-factor).
    *   **Band 3 (High):** High-shelf filter for treble control (Frequency, Gain, Q-factor).
*   **Equalizer Presets:** Quick one-click presets including:
    *   Flat
    *   Bass Boost
    *   Vocal
    *   Rock
    *   Treble Boost
*   **Noise Reduction:** A built-in noise gate chain utilizing high-pass and low-pass filtering coupled with a dynamics compressor to reduce background hiss and hum.
*   **Audio Export:** Record and export your processed audio with a single click.
*   **Responsive & Modern UI:** A beautiful, glassmorphic UI design with neon accents and smooth hover animations, ensuring a premium experience on both desktop and mobile devices.

## Technologies Used

This project is built entirely using vanilla web technologies, without any external frameworks or libraries:

*   **HTML5:** For the semantic structure of the application.
*   **CSS3:** 
    *   Custom CSS variables for easy theming.
    *   Flexbox and CSS Grid for layout management.
    *   Advanced CSS features like `backdrop-filter` for glassmorphism effects, radial gradients, and keyframe animations.
    *   Responsive design using media queries.
    *   Custom typography via Google Fonts (Outfit).
*   **JavaScript (ES6+):** For the application logic and DOM manipulation.
*   **Web Audio API:** The core technology powering the audio processing. Specifically utilizing:
    *   `AudioContext`
    *   `MediaElementAudioSourceNode`
    *   `BiquadFilterNode` (for EQ and Noise Reduction filtering)
    *   `DynamicsCompressorNode` (for the noise gate)
    *   `AnalyserNode` (for extracting frequency data for the spectrum)
    *   `GainNode` (for dry/wet mixing)
*   **HTML5 Canvas API:** For rendering the real-time frequency spectrum visualizations.

## How to Use

1.  Open `index.html` in a modern web browser (Google Chrome or Mozilla Firefox recommended).
2.  Click on the **Choose File** button in the **Audio Input** section and select an audio file from your device.
3.  Click **▶ Play** to start playback.
4.  Adjust the EQ sliders manually or select a preset to modify the sound.
5.  Toggle **Noise Reduction** on or off to hear the difference.
6.  Observe the changes in the **Frequency Spectrum** canvases.
7.  Click **● Start Export** to record your processed audio.

## Project Structure

*   `index.html`: The main HTML document containing the structure and UI elements.
*   `style.css`: The stylesheet containing all styling rules, colors, and responsive layouts.
*   `script.js`: The JavaScript file containing the logic for the Web Audio API, UI interactions, and canvas rendering.
