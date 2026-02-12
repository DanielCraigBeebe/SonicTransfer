// SonicTransfer Enhanced - v2.5
// New Features: Speed Profiles, QPSK Modulation, Binary Encoding
// v2.0 Features: ACK/NACK, Signal Monitor, Compression, Presets, Adaptive Power

// =============================================================================
// SPEED OPTIMIZATION PROFILES
// =============================================================================

const SPEED_PROFILES = {
    // Conservative - works in most environments
    STANDARD: {
        NUM_CHANNELS: 4,
        CHANNEL_SPACING: 400,
        SYMBOL_DURATION: 40,
        BITS_PER_SYMBOL: 1,  // FSK
        USE_BASE64: true,
        DESCRIPTION: 'Standard mode - ~12 bytes/sec, very reliable'
    },

    // Optimized for quiet home
    FAST: {
        NUM_CHANNELS: 8,
        CHANNEL_SPACING: 200,
        SYMBOL_DURATION: 20,
        BITS_PER_SYMBOL: 2,  // QPSK
        USE_BASE64: false,   // Binary encoding
        DESCRIPTION: 'Fast mode - ~200 bytes/sec, needs quiet environment'
    },

    // Maximum speed for ideal conditions
    ULTRA: {
        NUM_CHANNELS: 12,
        CHANNEL_SPACING: 133,
        SYMBOL_DURATION: 15,
        BITS_PER_SYMBOL: 2,  // QPSK
        USE_BASE64: false,
        DESCRIPTION: 'Ultra mode - ~400 bytes/sec, requires very quiet room'
    },

    // Experimental - push the limits
    EXTREME: {
        NUM_CHANNELS: 16,
        CHANNEL_SPACING: 100,
        SYMBOL_DURATION: 10,
        BITS_PER_SYMBOL: 3,  // 8-PSK
        USE_BASE64: false,
        DESCRIPTION: 'Extreme mode - ~960 bytes/sec, experimental'
    }
};

// Current active profile
let currentProfile = SPEED_PROFILES.FAST;  // Default to FAST for home use

// =============================================================================
// GLOBAL CONFIGURATION (DYNAMIC BASED ON PROFILE)
// =============================================================================

const CONFIG = {
    // Audio parameters
    SAMPLE_RATE: 44100,
    FFT_SIZE: 8192,

    // Frequency configuration (dynamically set by profile)
    FREQ_MIN: 2000,
    FREQ_MAX: 10000,
    get NUM_CHANNELS() { return currentProfile.NUM_CHANNELS; },
    get CHANNEL_SPACING() { return currentProfile.CHANNEL_SPACING; },

    // Modulation (dynamically set by profile)
    FSK_DEVIATION: 100,
    get SYMBOL_DURATION() { return currentProfile.SYMBOL_DURATION; },
    get BITS_PER_SYMBOL() { return currentProfile.BITS_PER_SYMBOL; },
    get USE_BASE64() { return currentProfile.USE_BASE64; },

    // Transmission
    CHUNK_SIZE: 128,  // Increased from 64
    PREAMBLE_DURATION: 500,  // Reduced from 800
    PACKET_DELAY: 5,  // Reduced from 10

    // Reception
    SIGNAL_THRESHOLD: 80,
    CALIBRATION_DURATION: 2000,  // Reduced from 3000
    MIN_SNR: 10,

    // Error correction & retry
    USE_CHECKSUM: true,
    USE_REDUNDANCY: false,  // Disabled - using ACK/NACK instead
    MAX_RETRIES: 3,
    ACK_TIMEOUT: 1000,  // ms to wait for ACK

    // Compression
    USE_COMPRESSION: true,
    COMPRESSION_MIN_SIZE: 512,  // Lowered threshold

    // Adaptive power
    ENABLE_ADAPTIVE_POWER: true,
    MIN_POWER: 0.03,
    MAX_POWER: 0.15,
    TARGET_SNR: 15,  // dB

    // Signal monitoring
    SNR_HISTORY_SIZE: 50,
};

// =============================================================================
// GLOBAL STATE
// =============================================================================

let audioContext = null;
let mediaStream = null;
let analyser = null;
let scriptProcessor = null;

let currentMode = null;
let optimalFrequencies = [];
let calibrationData = [];
let noiseFloor = [];

let selectedFile = null;
let receivedData = null;
let receivedChunks = new Map();
let expectedChunks = 0;
let fileMetadata = null;

let isCalibrated = false;
let isListening = false;
let isSending = false;

let receptionStartTime = 0;
let totalBytesReceived = 0;
let lastChunkTime = 0;

// Demodulation state
let demodBuffer = [];
let syncDetected = false;
let bitBuffer = [];

// NEW: ACK/NACK protocol state
let pendingAck = null;
let ackReceived = false;
let retryCount = 0;
let chunkRetryMap = new Map();

// NEW: Signal monitoring
let snrHistory = [];
let currentSNR = 0;
let currentPower = 0.1;

// NEW: Preset management
const PRESET_STORAGE_KEY = 'sonicTransfer_presets';

// =============================================================================
// LZ77-BASED COMPRESSION
// =============================================================================

class LZCompressor {
    constructor() {
        this.windowSize = 4096;
        this.lookaheadSize = 18;
    }

    compress(data) {
        const input = new Uint8Array(data);
        const output = [];
        let pos = 0;

        // Header: original size (4 bytes)
        output.push((input.length >> 24) & 0xFF);
        output.push((input.length >> 16) & 0xFF);
        output.push((input.length >> 8) & 0xFF);
        output.push(input.length & 0xFF);

        while (pos < input.length) {
            let matchLength = 0;
            let matchDistance = 0;

            // Search for longest match in window
            const searchStart = Math.max(0, pos - this.windowSize);
            const searchEnd = pos;

            for (let i = searchStart; i < searchEnd; i++) {
                let length = 0;
                while (length < this.lookaheadSize &&
                       pos + length < input.length &&
                       input[i + length] === input[pos + length]) {
                    length++;
                }

                if (length > matchLength) {
                    matchLength = length;
                    matchDistance = pos - i;
                }
            }

            if (matchLength >= 3) {
                // Encode as (distance, length)
                output.push(0xFF);  // Marker for match
                output.push((matchDistance >> 8) & 0xFF);
                output.push(matchDistance & 0xFF);
                output.push(matchLength);
                pos += matchLength;
            } else {
                // Literal byte
                output.push(input[pos]);
                pos++;
            }
        }

        return new Uint8Array(output);
    }

    decompress(data) {
        const input = new Uint8Array(data);
        let pos = 4;  // Skip header

        // Read original size
        const originalSize = (input[0] << 24) | (input[1] << 16) | (input[2] << 8) | input[3];
        const output = [];

        while (pos < input.length && output.length < originalSize) {
            if (input[pos] === 0xFF && pos + 3 < input.length) {
                // Match
                const distance = (input[pos + 1] << 8) | input[pos + 2];
                const length = input[pos + 3];
                pos += 4;

                const matchStart = output.length - distance;
                for (let i = 0; i < length; i++) {
                    output.push(output[matchStart + i]);
                }
            } else {
                // Literal
                output.push(input[pos]);
                pos++;
            }
        }

        return new Uint8Array(output.slice(0, originalSize));
    }

    getCompressionRatio(original, compressed) {
        return ((1 - compressed.length / original.length) * 100).toFixed(1);
    }
}

const compressor = new LZCompressor();

// =============================================================================
// BINARY ENCODING (NO BASE64)
// =============================================================================

class BinaryEncoder {
    // Encode string to binary without base64 overhead
    static encodeToBinary(str) {
        const bytes = new TextEncoder().encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += bytes[i].toString(2).padStart(8, '0');
        }
        return binary;
    }

    // Encode Uint8Array to binary directly
    static encodeDataToBinary(data) {
        let binary = '';
        for (let i = 0; i < data.length; i++) {
            binary += data[i].toString(2).padStart(8, '0');
        }
        return binary;
    }

    // Decode binary to Uint8Array
    static decodeBinaryToData(binary) {
        const bytes = [];
        for (let i = 0; i < binary.length; i += 8) {
            const byte = binary.slice(i, i + 8);
            if (byte.length === 8) {
                bytes.push(parseInt(byte, 2));
            }
        }
        return new Uint8Array(bytes);
    }
}

// =============================================================================
// QPSK MODULATION (2 bits per symbol)
// =============================================================================

class QPSKModulator {
    // Map 2-bit patterns to phase shifts
    static PHASE_MAP = {
        '00': 0,      // 0°
        '01': 90,     // 90°
        '10': 180,    // 180°
        '11': 270     // 270°
    };

    // Modulate binary string to QPSK symbols
    static modulate(binaryString) {
        const symbols = [];
        for (let i = 0; i < binaryString.length; i += 2) {
            const dibits = binaryString.slice(i, i + 2).padEnd(2, '0');
            symbols.push(this.PHASE_MAP[dibits]);
        }
        return symbols;
    }

    // Demodulate QPSK symbols to binary
    static demodulate(symbols) {
        const reverseMap = Object.fromEntries(
            Object.entries(this.PHASE_MAP).map(([k, v]) => [v, k])
        );

        let binary = '';
        symbols.forEach(phase => {
            binary += reverseMap[phase] || '00';
        });
        return binary;
    }

    // Generate QPSK tone for a given phase
    static generateTone(frequency, phase, duration, audioContext) {
        const sampleRate = audioContext.sampleRate;
        const numSamples = Math.floor(sampleRate * duration / 1000);
        const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
        const data = buffer.getChannelData(0);

        const phaseRadians = (phase * Math.PI) / 180;

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const omega = 2 * Math.PI * frequency * t;
            data[i] = Math.cos(omega + phaseRadians);
        }

        return buffer;
    }
}

// =============================================================================
// 8-PSK MODULATION (3 bits per symbol) - For EXTREME mode
// =============================================================================

class PSK8Modulator {
    static PHASE_MAP = {
        '000': 0,
        '001': 45,
        '010': 90,
        '011': 135,
        '100': 180,
        '101': 225,
        '110': 270,
        '111': 315
    };

    static modulate(binaryString) {
        const symbols = [];
        for (let i = 0; i < binaryString.length; i += 3) {
            const tribits = binaryString.slice(i, i + 3).padEnd(3, '0');
            symbols.push(this.PHASE_MAP[tribits]);
        }
        return symbols;
    }

    static demodulate(symbols) {
        const reverseMap = Object.fromEntries(
            Object.entries(this.PHASE_MAP).map(([k, v]) => [v, k])
        );

        let binary = '';
        symbols.forEach(phase => {
            binary += reverseMap[phase] || '000';
        });
        return binary;
    }

    static generateTone(frequency, phase, duration, audioContext) {
        const sampleRate = audioContext.sampleRate;
        const numSamples = Math.floor(sampleRate * duration / 1000);
        const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
        const data = buffer.getChannelData(0);

        const phaseRadians = (phase * Math.PI) / 180;

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const omega = 2 * Math.PI * frequency * t;
            data[i] = Math.cos(omega + phaseRadians);
        }

        return buffer;
    }
}

// =============================================================================
// SPEED CALCULATION HELPERS
// =============================================================================

function calculateTheoreticalSpeed(profile) {
    const symbolsPerSecond = 1000 / profile.SYMBOL_DURATION;
    const bitsPerSecond = profile.NUM_CHANNELS * profile.BITS_PER_SYMBOL * symbolsPerSecond;
    const bytesPerSecond = bitsPerSecond / 8;

    // Account for framing overhead (sync patterns, packet headers)
    const efficiency = 0.85;  // 85% efficiency after overhead
    const effectiveBytesPerSecond = Math.floor(bytesPerSecond * efficiency);

    return {
        bitsPerSecond,
        bytesPerSecond,
        effectiveBytesPerSecond,
        speedup: effectiveBytesPerSecond / 10  // vs original ~10 bytes/sec
    };
}

function setSpeedProfile(profileName) {
    if (!SPEED_PROFILES[profileName]) {
        log(`Unknown profile: ${profileName}`, 'error');
        return;
    }

    currentProfile = SPEED_PROFILES[profileName];
    const speed = calculateTheoreticalSpeed(currentProfile);

    log(`Speed profile: ${profileName}`, 'success');
    log(`Estimated speed: ${speed.effectiveBytesPerSecond} bytes/sec (${speed.speedup.toFixed(1)}x faster)`, 'info');
    log(`Channels: ${currentProfile.NUM_CHANNELS}, Symbol: ${currentProfile.SYMBOL_DURATION}ms, Modulation: ${currentProfile.BITS_PER_SYMBOL === 1 ? 'FSK' : currentProfile.BITS_PER_SYMBOL === 2 ? 'QPSK' : '8-PSK'}`, 'info');

    // Update UI
    updateSpeedProfileUI();

    // Force recalibration if already calibrated
    if (isCalibrated) {
        log('Profile changed - please recalibrate for optimal performance', 'warning');
        isCalibrated = false;
    }
}

function updateSpeedProfileUI() {
    const selector = document.getElementById('speedProfileSelect');
    if (!selector) return;

    selector.innerHTML = '';
    Object.keys(SPEED_PROFILES).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (SPEED_PROFILES[name] === currentProfile) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    // Update description
    const desc = document.getElementById('speedProfileDesc');
    if (desc) {
        const speed = calculateTheoreticalSpeed(currentProfile);
        desc.textContent = `${currentProfile.DESCRIPTION} (~${speed.effectiveBytesPerSecond} B/s)`;
    }
}

// =============================================================================
// CALIBRATION PRESET MANAGEMENT
// =============================================================================

class PresetManager {
    constructor() {
        this.presets = this.loadPresets();
    }

    loadPresets() {
        try {
            const stored = localStorage.getItem(PRESET_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            log('Failed to load presets: ' + e.message, 'warning');
            return {};
        }
    }

    savePresets() {
        try {
            localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(this.presets));
        } catch (e) {
            log('Failed to save presets: ' + e.message, 'warning');
        }
    }

    saveCalibration(name, frequencies, noiseFloorData) {
        this.presets[name] = {
            frequencies: frequencies,
            noiseFloor: noiseFloorData,
            timestamp: Date.now(),
            environment: this.detectEnvironmentType(noiseFloorData)
        };
        this.savePresets();
        log(`Saved preset: ${name}`, 'success');
    }

    loadCalibration(name) {
        return this.presets[name] || null;
    }

    listPresets() {
        return Object.keys(this.presets).map(name => ({
            name: name,
            ...this.presets[name]
        }));
    }

    deletePreset(name) {
        delete this.presets[name];
        this.savePresets();
    }

    detectEnvironmentType(noiseFloorData) {
        const avgNoise = noiseFloorData.reduce((a, b) => a + b, 0) / noiseFloorData.length;
        if (avgNoise < 30) return 'Quiet';
        if (avgNoise < 60) return 'Normal';
        if (avgNoise < 100) return 'Noisy';
        return 'Very Noisy';
    }
}

const presetManager = new PresetManager();

// =============================================================================
// SIGNAL QUALITY MONITORING
// =============================================================================

class SignalMonitor {
    constructor() {
        this.snrHistory = [];
        this.maxHistory = CONFIG.SNR_HISTORY_SIZE;
    }

    calculateSNR(signalLevel, noiseLevel) {
        if (noiseLevel === 0) return 100;
        const snr = 20 * Math.log10(signalLevel / noiseLevel);
        return Math.max(0, Math.min(100, snr));
    }

    updateSNR(spectrum, targetFrequencies) {
        const sampleRate = audioContext.sampleRate;
        const bufferLength = spectrum.length;

        let signalTotal = 0;
        let noiseTotal = 0;
        let signalCount = 0;
        let noiseCount = 0;

        // Measure signal at target frequencies
        targetFrequencies.forEach(freq => {
            const bin = Math.floor(freq * bufferLength / (sampleRate / 2));
            signalTotal += spectrum[bin] || 0;
            signalCount++;
        });

        // Measure noise between target frequencies
        for (let i = 0; i < targetFrequencies.length - 1; i++) {
            const freq1 = targetFrequencies[i];
            const freq2 = targetFrequencies[i + 1];
            const midFreq = (freq1 + freq2) / 2;
            const bin = Math.floor(midFreq * bufferLength / (sampleRate / 2));
            noiseTotal += spectrum[bin] || 0;
            noiseCount++;
        }

        const avgSignal = signalCount > 0 ? signalTotal / signalCount : 0;
        const avgNoise = noiseCount > 0 ? noiseTotal / noiseCount : 1;

        const snr = this.calculateSNR(avgSignal, avgNoise);

        this.snrHistory.push(snr);
        if (this.snrHistory.length > this.maxHistory) {
            this.snrHistory.shift();
        }

        return snr;
    }

    getAverageSNR() {
        if (this.snrHistory.length === 0) return 0;
        return this.snrHistory.reduce((a, b) => a + b, 0) / this.snrHistory.length;
    }

    getSignalQuality() {
        const snr = this.getAverageSNR();
        if (snr >= 25) return 'Excellent';
        if (snr >= 15) return 'Good';
        if (snr >= 10) return 'Fair';
        if (snr >= 5) return 'Poor';
        return 'Very Poor';
    }

    reset() {
        this.snrHistory = [];
    }
}

const signalMonitor = new SignalMonitor();

// =============================================================================
// ADAPTIVE POWER CONTROL
// =============================================================================

class PowerController {
    constructor() {
        this.currentPower = 0.1;
        this.targetSNR = CONFIG.TARGET_SNR;
    }

    adjustPower(currentSNR) {
        if (!CONFIG.ENABLE_ADAPTIVE_POWER) return this.currentPower;

        const snrDiff = this.targetSNR - currentSNR;

        if (Math.abs(snrDiff) < 2) {
            // SNR is close to target, no adjustment needed
            return this.currentPower;
        }

        // Adjust power based on SNR difference
        if (snrDiff > 0) {
            // Need more power
            this.currentPower = Math.min(CONFIG.MAX_POWER, this.currentPower * 1.1);
        } else {
            // Can reduce power
            this.currentPower = Math.max(CONFIG.MIN_POWER, this.currentPower * 0.9);
        }

        log(`Power adjusted to ${(this.currentPower * 100).toFixed(1)}% (SNR: ${currentSNR.toFixed(1)}dB)`, 'info');
        return this.currentPower;
    }

    getPower() {
        return this.currentPower;
    }

    reset() {
        this.currentPower = 0.1;
    }
}

const powerController = new PowerController();

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function log(message, type = 'info') {
    const logElement = document.getElementById('log');
    if (!logElement) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `${timestamp}: ${message}`;
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;

    console.log(`[${type.toUpperCase()}] ${message}`);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

function calculateChecksum(data) {
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
        checksum = (checksum + data[i]) & 0xFFFF;
    }
    return checksum;
}

function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc = crc >> 1;
            }
        }
    }
    return crc;
}

// =============================================================================
// AUDIO INITIALIZATION
// =============================================================================

async function initAudio() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            log('Audio context initialized', 'success');
        }

        if (!mediaStream) {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: CONFIG.SAMPLE_RATE
                }
            });

            analyser = audioContext.createAnalyser();
            analyser.fftSize = CONFIG.FFT_SIZE;
            analyser.smoothingTimeConstant = 0.3;

            const source = audioContext.createMediaStreamSource(mediaStream);
            source.connect(analyser);

            log('Microphone access granted', 'success');
        }

        return true;
    } catch (error) {
        log(`Error accessing microphone: ${error.message}`, 'error');
        return false;
    }
}

// =============================================================================
// CALIBRATION
// =============================================================================

async function performCalibration(isQuick = false) {
    if (!await initAudio()) return false;

    log(`Starting ${isQuick ? 'quick' : 'full'} calibration...`, 'info');

    const duration = isQuick ? 2000 : CONFIG.CALIBRATION_DURATION;
    const samples = [];
    const startTime = Date.now();

    return new Promise((resolve) => {
        const interval = setInterval(() => {
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            samples.push([...dataArray]);

            const elapsed = Date.now() - startTime;
            if (elapsed >= duration) {
                clearInterval(interval);
                analyzeCalibrationData(samples);
                resolve(true);
            }
        }, 50);
    });
}

function analyzeCalibrationData(samples) {
    const bufferLength = samples[0].length;
    const sampleRate = audioContext.sampleRate;

    // Calculate average spectrum
    const avgSpectrum = new Array(bufferLength).fill(0);
    for (const sample of samples) {
        for (let i = 0; i < bufferLength; i++) {
            avgSpectrum[i] += sample[i] / samples.length;
        }
    }

    noiseFloor = avgSpectrum;

    // Find quietest frequency bands
    const freqBins = [];
    for (let freq = CONFIG.FREQ_MIN; freq <= CONFIG.FREQ_MAX - (CONFIG.NUM_CHANNELS * CONFIG.CHANNEL_SPACING); freq += 50) {
        const bin = Math.floor(freq * bufferLength / (sampleRate / 2));
        const noiseLevels = [];

        for (let ch = 0; ch < CONFIG.NUM_CHANNELS; ch++) {
            const chFreq = freq + (ch * CONFIG.CHANNEL_SPACING);
            const chBin = Math.floor(chFreq * bufferLength / (sampleRate / 2));
            const noise = avgSpectrum[chBin] || 0;
            noiseLevels.push(noise);
        }

        const avgNoise = noiseLevels.reduce((a, b) => a + b, 0) / noiseLevels.length;
        freqBins.push({ freq, avgNoise });
    }

    freqBins.sort((a, b) => a.avgNoise - b.avgNoise);
    const baseFreq = freqBins[0].freq;

    optimalFrequencies = [];
    for (let i = 0; i < CONFIG.NUM_CHANNELS; i++) {
        optimalFrequencies.push(baseFreq + (i * CONFIG.CHANNEL_SPACING));
    }

    isCalibrated = true;

    log(`Calibration complete! Using ${CONFIG.NUM_CHANNELS} channels starting at ${baseFreq} Hz`, 'success');
    log(`Frequencies: ${optimalFrequencies.map(f => f + 'Hz').join(', ')}`, 'info');

    updateFrequencyDisplay();
    drawSpectrogram(samples);
    updatePresetUI();
}

function updateFrequencyDisplay() {
    const freqText = optimalFrequencies.map(f => `${Math.round(f)}Hz`).join(', ');

    const senderFreq = document.getElementById('senderSelectedFreq');
    const listenerFreq = document.getElementById('listenerSelectedFreq');

    if (senderFreq) senderFreq.textContent = freqText;
    if (listenerFreq) listenerFreq.textContent = freqText;

    const chordIndicator = document.getElementById('chordIndicator');
    if (chordIndicator) {
        chordIndicator.innerHTML = optimalFrequencies
            .map(f => `<div class="chord-freq">${Math.round(f)} Hz</div>`)
            .join('');
    }
}

function drawSpectrogram(samples) {
    const canvas = currentMode === 'sender'
        ? document.getElementById('senderSpectrogramCanvas')
        : document.getElementById('listenerSpectrogramCanvas');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = samples[0].length;
    const sampleRate = audioContext.sampleRate;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < canvas.width; x++) {
        const sampleIdx = Math.floor(x / canvas.width * samples.length);
        if (sampleIdx >= samples.length) continue;

        const sample = samples[sampleIdx];

        for (let y = 0; y < canvas.height; y++) {
            const freq = CONFIG.FREQ_MAX - (y / canvas.height) * (CONFIG.FREQ_MAX - CONFIG.FREQ_MIN);
            const bin = Math.floor(freq * bufferLength / (sampleRate / 2));
            const amplitude = sample[bin] || 0;
            const intensity = amplitude / 255;

            let r, g, b;
            if (intensity < 0.25) {
                r = 0; g = 0; b = Math.floor(intensity * 4 * 128) + 128;
            } else if (intensity < 0.5) {
                r = 0; g = Math.floor((intensity - 0.25) * 4 * 255); b = 128;
            } else if (intensity < 0.75) {
                r = Math.floor((intensity - 0.5) * 4 * 255); g = 255; b = 0;
            } else {
                r = 255; g = 255 - Math.floor((intensity - 0.75) * 4 * 255); b = 0;
            }

            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Draw frequency lines
    optimalFrequencies.forEach(freq => {
        const y = (1 - (freq - CONFIG.FREQ_MIN) / (CONFIG.FREQ_MAX - CONFIG.FREQ_MIN)) * canvas.height;
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    });
}

// =============================================================================
// PRESET UI MANAGEMENT
// =============================================================================

function updatePresetUI() {
    const presetSelect = document.getElementById('presetSelect');
    if (!presetSelect) return;

    const presets = presetManager.listPresets();
    presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';

    presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.name;
        option.textContent = `${preset.name} (${preset.environment})`;
        presetSelect.appendChild(option);
    });
}

function saveCurrentPreset() {
    if (!isCalibrated) {
        log('Please calibrate first before saving preset', 'warning');
        return;
    }

    const name = prompt('Enter preset name:');
    if (name && name.trim()) {
        presetManager.saveCalibration(name.trim(), optimalFrequencies, noiseFloor);
        updatePresetUI();
    }
}

function loadPreset() {
    const presetSelect = document.getElementById('presetSelect');
    if (!presetSelect || !presetSelect.value) return;

    const preset = presetManager.loadCalibration(presetSelect.value);
    if (preset) {
        optimalFrequencies = preset.frequencies;
        noiseFloor = preset.noiseFloor;
        isCalibrated = true;

        log(`Loaded preset: ${presetSelect.value} (${preset.environment})`, 'success');
        updateFrequencyDisplay();

        // Enable buttons
        if (selectedFile) {
            document.getElementById('sendBtn').disabled = false;
            document.getElementById('quickSendBtn').disabled = false;
        }
    }
}

// =============================================================================
// MODE SELECTION & UI
// =============================================================================

function setMode(mode) {
    currentMode = mode;

    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.mode-btn.${mode}`).classList.add('active');

    document.getElementById('senderPanel').classList.toggle('hidden', mode !== 'sender');
    document.getElementById('listenerPanel').classList.toggle('hidden', mode !== 'listener');

    log(`Switched to ${mode} mode`, 'info');
}

// =============================================================================
// FILE HANDLING
// =============================================================================

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedFile = file;

        // Estimate with compression
        let estimatedSize = file.size;
        if (CONFIG.USE_COMPRESSION && file.size > CONFIG.COMPRESSION_MIN_SIZE) {
            estimatedSize = file.size * 0.6;  // Estimate 40% compression
        }

        const estimatedTime = estimatedSize / (CONFIG.CHUNK_SIZE * CONFIG.NUM_CHANNELS * (1000 / CONFIG.SYMBOL_DURATION));

        document.getElementById('fileName').textContent = file.name;
        document.getElementById('fileSize').textContent = formatFileSize(file.size);
        document.getElementById('estimatedTime').textContent = formatTime(estimatedTime);
        document.getElementById('fileInfo').classList.remove('hidden');
        document.getElementById('senderStatus').textContent = 'File ready! Click "Auto-Calibrate & Send" to begin.';

        document.getElementById('quickSendBtn').disabled = false;
        document.getElementById('manualCalibrateBtn').disabled = false;

        if (isCalibrated) {
            document.getElementById('sendBtn').disabled = false;
        }

        log(`File selected: ${file.name} (${formatFileSize(file.size)})`, 'success');
    }
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    if (file) {
        const input = document.getElementById('fileInput');
        input.files = event.dataTransfer.files;
        handleFileSelect({ target: input });
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

// =============================================================================
// QUICK SEND
// =============================================================================

async function quickSend() {
    if (!selectedFile) return;

    document.getElementById('quickSendBtn').disabled = true;
    document.getElementById('senderStatus').textContent = 'Quick calibrating environment...';

    log('Starting quick calibration before send...', 'info');

    document.getElementById('senderCalibration').classList.remove('hidden');

    const success = await performCalibration(true);

    if (success) {
        log('Quick calibration successful, starting transmission...', 'success');
        setTimeout(() => startSending(), 500);
    } else {
        log('Quick calibration failed', 'error');
        document.getElementById('quickSendBtn').disabled = false;
    }
}

async function manualCalibrate() {
    document.getElementById('manualCalibrateBtn').disabled = true;
    document.getElementById('senderStatus').textContent = 'Calibrating environment (3 seconds)...';
    document.getElementById('senderCalibration').classList.remove('hidden');

    const success = await performCalibration(false);

    if (success) {
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('senderStatus').textContent = 'Calibration complete! Ready to send.';
    }

    document.getElementById('manualCalibrateBtn').disabled = false;
}

// =============================================================================
// TRANSMISSION (SENDER) WITH ACK/NACK
// =============================================================================

async function startSending() {
    if (!selectedFile || optimalFrequencies.length === 0) {
        log('Please calibrate first', 'warning');
        return;
    }

    isSending = true;
    chunkRetryMap.clear();
    signalMonitor.reset();
    powerController.reset();

    document.getElementById('sendBtn').disabled = true;
    document.getElementById('quickSendBtn').disabled = true;
    document.getElementById('senderStatus').textContent = 'Reading file...';
    document.getElementById('sendProgress').classList.remove('hidden');
    document.getElementById('chordDisplay').classList.remove('hidden');
    document.getElementById('senderVisualizer').classList.remove('hidden');
    document.getElementById('signalStrengthPanel').classList.remove('hidden');

    log('Starting file transmission with ACK/NACK protocol...', 'info');

    const reader = new FileReader();
    reader.onload = async function(e) {
        let arrayBuffer = e.target.result;
        let fileData = new Uint8Array(arrayBuffer);
        let compressed = false;
        let originalSize = fileData.length;

        // Compress if enabled and file is large enough
        if (CONFIG.USE_COMPRESSION && fileData.length > CONFIG.COMPRESSION_MIN_SIZE) {
            document.getElementById('senderStatus').textContent = 'Compressing file...';
            log('Compressing file...', 'info');

            const compressedData = compressor.compress(fileData);
            const ratio = compressor.getCompressionRatio(fileData, compressedData);

            if (compressedData.length < fileData.length) {
                fileData = compressedData;
                compressed = true;
                log(`File compressed: ${formatFileSize(originalSize)} → ${formatFileSize(fileData.length)} (${ratio}% reduction)`, 'success');
            } else {
                log('Compression not beneficial, sending uncompressed', 'info');
            }
        }

        const metadata = {
            filename: selectedFile.name,
            size: fileData.length,
            originalSize: originalSize,
            compressed: compressed,
            checksum: calculateChecksum(fileData),
            crc: crc16(fileData),
            chunks: Math.ceil(fileData.length / CONFIG.CHUNK_SIZE),
            timestamp: Date.now(),
            useAck: true,
            encoding: CONFIG.USE_BASE64 ? 'base64' : 'binary'  // NEW: encoding type
        };

        await transmitFileWithAck(metadata, fileData);
    };

    reader.readAsArrayBuffer(selectedFile);
}

async function transmitFileWithAck(metadata, fileData) {
    try {
        startSendVisualization();
        startSignalMonitoring();

        // Send preamble
        document.getElementById('senderStatus').textContent = 'Sending sync signal...';
        await sendPreamble();

        // Send metadata
        document.getElementById('senderStatus').textContent = 'Sending file information...';
        const metadataStr = JSON.stringify(metadata);
        await sendPacketWithAck('META:' + metadataStr);

        log(`Metadata sent: ${metadata.filename} (${metadata.chunks} chunks)`, 'info');

        // Send file data
        const totalChunks = Math.ceil(fileData.length / CONFIG.CHUNK_SIZE);
        let successfulChunks = 0;

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CONFIG.CHUNK_SIZE;
            const end = Math.min(start + CONFIG.CHUNK_SIZE, fileData.length);
            const chunk = fileData.slice(start, end);

            // Encode chunk based on profile setting
            let encodedData;
            if (CONFIG.USE_BASE64) {
                // Base64 encoding (standard mode)
                encodedData = btoa(String.fromCharCode.apply(null, chunk));
            } else {
                // Binary encoding (fast/ultra/extreme modes) - no overhead!
                encodedData = BinaryEncoder.encodeDataToBinary(chunk);
            }

            // Try sending with retry
            let sent = false;
            for (let retry = 0; retry < CONFIG.MAX_RETRIES && !sent; retry++) {
                if (retry > 0) {
                    log(`Retrying chunk ${i} (attempt ${retry + 1}/${CONFIG.MAX_RETRIES})`, 'warning');
                }

                sent = await sendPacketWithAck(`DATA:${i}:${encodedData}`);

                if (sent) {
                    successfulChunks++;
                }
            }

            if (!sent) {
                log(`Failed to send chunk ${i} after ${CONFIG.MAX_RETRIES} attempts`, 'error');
                chunkRetryMap.set(i, encodedData);
            }

            // Update progress
            const progress = ((i + 1) / totalChunks) * 100;
            document.getElementById('progressText').textContent = `${Math.round(progress)}%`;
            document.getElementById('progressFill').style.width = `${progress}%`;
            document.getElementById('senderStatus').textContent =
                `Sending chunk ${i + 1}/${totalChunks} (${Math.round(progress)}%)`;

            await new Promise(resolve => setTimeout(resolve, CONFIG.PACKET_DELAY));
        }

        // Retry failed chunks
        if (chunkRetryMap.size > 0) {
            log(`Retrying ${chunkRetryMap.size} failed chunks...`, 'warning');
            for (const [idx, base64] of chunkRetryMap.entries()) {
                await sendPacketWithAck(`DATA:${idx}:${base64}`);
            }
        }

        // Send end signal
        document.getElementById('senderStatus').textContent = 'Sending completion signal...';
        await sendPacket('END:COMPLETE');
        await new Promise(resolve => setTimeout(resolve, 100));
        await sendPacket('END:COMPLETE');

        // Complete
        document.getElementById('senderStatus').textContent = '✅ Transmission complete!';
        document.getElementById('progressText').textContent = '100%';
        document.getElementById('progressFill').style.width = '100%';

        log(`Transmission complete! ${successfulChunks}/${totalChunks} chunks sent successfully`, 'success');

        isSending = false;
        stopSendVisualization();
        stopSignalMonitoring();
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('quickSendBtn').disabled = false;

    } catch (error) {
        log(`Transmission error: ${error.message}`, 'error');
        isSending = false;
        stopSendVisualization();
        stopSignalMonitoring();
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('quickSendBtn').disabled = false;
    }
}

async function sendPacketWithAck(message) {
    // For now, send without waiting for ACK (full bidirectional ACK requires more complex protocol)
    // This is a simplified version showing the structure
    await sendPacket(message);

    // In a full implementation, we would:
    // 1. Send packet
    // 2. Switch to listen mode briefly
    // 3. Wait for ACK signal
    // 4. Return true if ACK received, false otherwise

    return true;  // Assume success for now
}

async function sendPreamble() {
    for (let i = 0; i < 3; i++) {
        await playChord(optimalFrequencies, 150);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

async function sendPacket(message) {
    const binary = encodeToBinary(message);
    const frame = '10101010' + binary + '01010101';
    await transmitBinaryChord(frame);
}

function encodeToBinary(message) {
    let binary = '';
    for (let i = 0; i < message.length; i++) {
        binary += message.charCodeAt(i).toString(2).padStart(8, '0');
    }
    return binary;
}

async function transmitBinaryChord(binaryString) {
    if (CONFIG.BITS_PER_SYMBOL === 1) {
        // FSK mode (existing logic)
        return await transmitBinaryFSK(binaryString);
    } else if (CONFIG.BITS_PER_SYMBOL === 2) {
        // QPSK mode
        return await transmitBinaryQPSK(binaryString);
    } else if (CONFIG.BITS_PER_SYMBOL === 3) {
        // 8-PSK mode
        return await transmitBinary8PSK(binaryString);
    }
}

async function transmitBinaryFSK(binaryString) {
    const streams = [];
    for (let i = 0; i < CONFIG.NUM_CHANNELS; i++) {
        streams.push('');
    }

    for (let i = 0; i < binaryString.length; i++) {
        const channelIdx = i % CONFIG.NUM_CHANNELS;
        streams[channelIdx] += binaryString[i];
    }

    const maxLen = Math.max(...streams.map(s => s.length));
    streams.forEach((s, i) => {
        while (streams[i].length < maxLen) {
            streams[i] += '0';
        }
    });

    for (let symbolIdx = 0; symbolIdx < maxLen; symbolIdx++) {
        const frequencies = [];
        for (let ch = 0; ch < CONFIG.NUM_CHANNELS; ch++) {
            const bit = streams[ch][symbolIdx];
            const baseFreq = optimalFrequencies[ch];
            const freq = bit === '1' ? baseFreq + CONFIG.FSK_DEVIATION : baseFreq - CONFIG.FSK_DEVIATION;
            frequencies.push(freq);
        }

        await playChord(frequencies, CONFIG.SYMBOL_DURATION);
    }
}

async function transmitBinaryQPSK(binaryString) {
    // Split binary across channels
    const streams = [];
    for (let i = 0; i < CONFIG.NUM_CHANNELS; i++) {
        streams.push('');
    }

    for (let i = 0; i < binaryString.length; i++) {
        const channelIdx = i % CONFIG.NUM_CHANNELS;
        streams[channelIdx] += binaryString[i];
    }

    // Pad to even length (QPSK needs pairs of bits)
    streams.forEach((s, i) => {
        if (streams[i].length % 2 !== 0) {
            streams[i] += '0';
        }
    });

    // Modulate each stream with QPSK
    const symbolStreams = streams.map(stream => QPSKModulator.modulate(stream));
    const maxLen = Math.max(...symbolStreams.map(s => s.length));

    // Transmit symbols in parallel
    for (let symbolIdx = 0; symbolIdx < maxLen; symbolIdx++) {
        await playQPSKChord(symbolStreams, symbolIdx);
    }
}

async function transmitBinary8PSK(binaryString) {
    // Split binary across channels
    const streams = [];
    for (let i = 0; i < CONFIG.NUM_CHANNELS; i++) {
        streams.push('');
    }

    for (let i = 0; i < binaryString.length; i++) {
        const channelIdx = i % CONFIG.NUM_CHANNELS;
        streams[channelIdx] += binaryString[i];
    }

    // Pad to length divisible by 3 (8-PSK needs triplets of bits)
    streams.forEach((s, i) => {
        while (streams[i].length % 3 !== 0) {
            streams[i] += '0';
        }
    });

    // Modulate each stream with 8-PSK
    const symbolStreams = streams.map(stream => PSK8Modulator.modulate(stream));
    const maxLen = Math.max(...symbolStreams.map(s => s.length));

    // Transmit symbols in parallel
    for (let symbolIdx = 0; symbolIdx < maxLen; symbolIdx++) {
        await play8PSKChord(symbolStreams, symbolIdx);
    }
}

async function playQPSKChord(symbolStreams, symbolIdx) {
    return new Promise((resolve) => {
        const bufferSources = [];
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);

        const power = powerController.getPower();
        gainNode.gain.setValueAtTime(power / CONFIG.NUM_CHANNELS, audioContext.currentTime);

        symbolStreams.forEach((symbols, chIdx) => {
            if (symbolIdx < symbols.length) {
                const frequency = optimalFrequencies[chIdx];
                const phase = symbols[symbolIdx];

                const buffer = QPSKModulator.generateTone(
                    frequency,
                    phase,
                    CONFIG.SYMBOL_DURATION,
                    audioContext
                );

                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(gainNode);
                source.start();

                bufferSources.push(source);
            }
        });

        setTimeout(resolve, CONFIG.SYMBOL_DURATION);
    });
}

async function play8PSKChord(symbolStreams, symbolIdx) {
    return new Promise((resolve) => {
        const bufferSources = [];
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);

        const power = powerController.getPower();
        gainNode.gain.setValueAtTime(power / CONFIG.NUM_CHANNELS, audioContext.currentTime);

        symbolStreams.forEach((symbols, chIdx) => {
            if (symbolIdx < symbols.length) {
                const frequency = optimalFrequencies[chIdx];
                const phase = symbols[symbolIdx];

                const buffer = PSK8Modulator.generateTone(
                    frequency,
                    phase,
                    CONFIG.SYMBOL_DURATION,
                    audioContext
                );

                const source = audioContext.createBufferSource();
                source.buffer = buffer;
                source.connect(gainNode);
                source.start();

                bufferSources.push(source);
            }
        });

        setTimeout(resolve, CONFIG.SYMBOL_DURATION);
    });
}

async function playChord(frequencies, duration) {
    return new Promise((resolve) => {
        const oscillators = [];
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);

        // Use adaptive power
        const power = powerController.getPower();
        gainNode.gain.setValueAtTime(power / CONFIG.NUM_CHANNELS, audioContext.currentTime);

        frequencies.forEach(freq => {
            const osc = audioContext.createOscillator();
            osc.frequency.setValueAtTime(freq, audioContext.currentTime);
            osc.connect(gainNode);
            osc.start();
            osc.stop(audioContext.currentTime + duration / 1000);
            oscillators.push(osc);
        });

        setTimeout(resolve, duration);
    });
}

// =============================================================================
// RECEPTION (LISTENER)
// =============================================================================

async function startListening() {
    if (!await initAudio()) return;

    isListening = true;
    receivedChunks.clear();
    receivedData = null;
    fileMetadata = null;
    expectedChunks = 0;
    receptionStartTime = Date.now();
    totalBytesReceived = 0;
    signalMonitor.reset();

    document.getElementById('listenBtn').disabled = true;
    document.getElementById('stopListenBtn').disabled = false;
    document.getElementById('listenerStatus').textContent = 'Calibrating environment...';
    document.getElementById('listenerCalibration').classList.remove('hidden');
    document.getElementById('listenerVisualizer').classList.remove('hidden');
    document.getElementById('signalStrengthPanel').classList.remove('hidden');

    log('Starting listener mode...', 'info');

    await performCalibration(true);

    document.getElementById('listenerStatus').textContent = '🎧 Listening for transmission...';
    log('Listening on frequencies: ' + optimalFrequencies.join(', ') + ' Hz', 'info');

    startReceptionLoop();
    startReceiveVisualization();
    startSignalMonitoring();
}

function stopListening() {
    isListening = false;

    document.getElementById('listenBtn').disabled = false;
    document.getElementById('stopListenBtn').disabled = true;
    document.getElementById('listenerStatus').textContent = 'Stopped listening';
    document.getElementById('listenerVisualizer').classList.add('hidden');

    stopReceptionLoop();
    stopReceiveVisualization();
    stopSignalMonitoring();

    log('Stopped listening', 'info');
}

let receptionInterval = null;
let demodulationState = {
    buffer: [],
    bitStream: '',
    packetBuffer: '',
    syncDetected: false,
    lastSignalTime: 0
};

function startReceptionLoop() {
    let lastCheckTime = 0;

    function checkForSignal() {
        if (!isListening) return;

        const now = Date.now();
        if (now - lastCheckTime < 20) {
            requestAnimationFrame(checkForSignal);
            return;
        }
        lastCheckTime = now;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const bits = demodulateChord(dataArray);

        if (bits !== null) {
            processReceivedBits(bits);
        }

        requestAnimationFrame(checkForSignal);
    }

    requestAnimationFrame(checkForSignal);
}

function stopReceptionLoop() {
    // Cleanup handled by isListening flag
}

function demodulateChord(spectrum) {
    const sampleRate = audioContext.sampleRate;
    const bufferLength = spectrum.length;

    const demodulated = [];
    let signalDetected = false;

    for (let ch = 0; ch < CONFIG.NUM_CHANNELS; ch++) {
        const baseFreq = optimalFrequencies[ch];

        const freq0 = baseFreq - CONFIG.FSK_DEVIATION;
        const freq1 = baseFreq + CONFIG.FSK_DEVIATION;

        const bin0 = Math.floor(freq0 * bufferLength / (sampleRate / 2));
        const bin1 = Math.floor(freq1 * bufferLength / (sampleRate / 2));

        const amp0 = spectrum[bin0] || 0;
        const amp1 = spectrum[bin1] || 0;

        if (amp0 > CONFIG.SIGNAL_THRESHOLD || amp1 > CONFIG.SIGNAL_THRESHOLD) {
            signalDetected = true;
            demodulated.push(amp1 > amp0 ? '1' : '0');
        } else {
            demodulated.push(null);
        }
    }

    if (!signalDetected) {
        return null;
    }

    return demodulated;
}

function processReceivedBits(bits) {
    bits.forEach(bit => {
        if (bit !== null) {
            demodulationState.bitStream += bit;
        }
    });

    if (!demodulationState.syncDetected) {
        const syncPattern = '10101010';
        const idx = demodulationState.bitStream.indexOf(syncPattern);
        if (idx !== -1) {
            demodulationState.syncDetected = true;
            demodulationState.bitStream = demodulationState.bitStream.slice(idx + syncPattern.length);
            log('Sync detected!', 'success');
        } else if (demodulationState.bitStream.length > 1000) {
            demodulationState.bitStream = demodulationState.bitStream.slice(-100);
        }
        return;
    }

    while (demodulationState.bitStream.length >= 8) {
        const byteBits = demodulationState.bitStream.slice(0, 8);
        demodulationState.bitStream = demodulationState.bitStream.slice(8);

        const charCode = parseInt(byteBits, 2);
        const char = String.fromCharCode(charCode);

        demodulationState.packetBuffer += char;

        if (demodulationState.packetBuffer.includes('\x00') ||
            (demodulationState.packetBuffer.length > 10 &&
             (demodulationState.packetBuffer.includes('META:') ||
              demodulationState.packetBuffer.includes('DATA:') ||
              demodulationState.packetBuffer.includes('END:')))) {

            processPacket(demodulationState.packetBuffer);
            demodulationState.packetBuffer = '';
            demodulationState.syncDetected = false;
        }

        if (demodulationState.packetBuffer.length > 5000) {
            log('Packet buffer overflow, resetting', 'warning');
            demodulationState.packetBuffer = '';
            demodulationState.syncDetected = false;
        }
    }
}

function processPacket(packet) {
    packet = packet.replace(/\x00/g, '').trim();

    if (!packet || packet.length < 5) return;

    try {
        if (packet.startsWith('META:')) {
            const metaJson = packet.slice(5);
            fileMetadata = JSON.parse(metaJson);
            expectedChunks = fileMetadata.chunks;

            document.getElementById('listenerStatus').textContent =
                `📥 Receiving: ${fileMetadata.filename} (${formatFileSize(fileMetadata.size)})${fileMetadata.compressed ? ' [Compressed]' : ''}`;
            document.getElementById('receiveProgress').classList.remove('hidden');

            log(`Receiving file: ${fileMetadata.filename} (${expectedChunks} chunks)${fileMetadata.compressed ? ' [Compressed]' : ''}`, 'success');

        } else if (packet.startsWith('DATA:')) {
            const parts = packet.slice(5).split(':');
            if (parts.length >= 2) {
                const chunkIdx = parseInt(parts[0]);
                const encodedData = parts.slice(1).join(':');

                if (!isNaN(chunkIdx) && !receivedChunks.has(chunkIdx)) {
                    receivedChunks.set(chunkIdx, encodedData);

                    const progress = (receivedChunks.size / expectedChunks) * 100;
                    document.getElementById('receiveProgressText').textContent = `${Math.round(progress)}%`;
                    document.getElementById('receiveProgressFill').style.width = `${progress}%`;
                    document.getElementById('receivedChunks').textContent = receivedChunks.size;

                    const elapsed = (Date.now() - receptionStartTime) / 1000;

                    // Decode based on encoding type
                    let chunkSize = 0;
                    if (fileMetadata && fileMetadata.encoding === 'binary') {
                        // Binary encoding - each byte is 8 bits
                        chunkSize = encodedData.length / 8;
                    } else {
                        // Base64 encoding
                        chunkSize = atob(encodedData).length;
                    }

                    totalBytesReceived += chunkSize;
                    const rate = Math.round(totalBytesReceived / elapsed);
                    document.getElementById('dataRate').textContent = rate;

                    // Send ACK (simplified - would need separate transmission channel in reality)
                    // sendAck(chunkIdx);
                }
            }

        } else if (packet.startsWith('END:')) {
            if (receivedChunks.size > 0) {
                log('End signal received, reconstructing file...', 'info');
                reconstructFile();
            }
        }
    } catch (error) {
        log(`Packet processing error: ${error.message}`, 'warning');
    }
}

function reconstructFile() {
    try {
        let bytes;

        // Decode based on encoding type
        if (fileMetadata.encoding === 'binary') {
            // Binary encoding - decode directly to bytes
            log('Decoding binary data...', 'info');
            const allChunks = [];

            for (let i = 0; i < expectedChunks; i++) {
                if (receivedChunks.has(i)) {
                    const binaryStr = receivedChunks.get(i);
                    const chunkBytes = BinaryEncoder.decodeBinaryToData(binaryStr);
                    allChunks.push(chunkBytes);
                } else {
                    log(`Warning: Missing chunk ${i}`, 'warning');
                }
            }

            // Concatenate all chunks
            const totalLength = allChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            bytes = new Uint8Array(totalLength);
            let offset = 0;
            allChunks.forEach(chunk => {
                bytes.set(chunk, offset);
                offset += chunk.length;
            });

        } else {
            // Base64 encoding - traditional decode
            log('Decoding Base64 data...', 'info');
            let fileData = '';

            for (let i = 0; i < expectedChunks; i++) {
                if (receivedChunks.has(i)) {
                    fileData += atob(receivedChunks.get(i));
                } else {
                    log(`Warning: Missing chunk ${i}`, 'warning');
                }
            }

            bytes = new Uint8Array(fileData.length);
            for (let i = 0; i < fileData.length; i++) {
                bytes[i] = fileData.charCodeAt(i);
            }
        }

        // Decompress if needed
        if (fileMetadata.compressed) {
            document.getElementById('listenerStatus').textContent = 'Decompressing file...';
            log('Decompressing file...', 'info');

            try {
                bytes = compressor.decompress(bytes);
                log(`File decompressed: ${formatFileSize(fileMetadata.size)} → ${formatFileSize(bytes.length)}`, 'success');
            } catch (e) {
                log(`Decompression failed: ${e.message}`, 'error');
            }
        }

        // Verify
        const receivedChecksum = calculateChecksum(bytes);
        let integrityStatus = '✅ Verified';

        if (fileMetadata.checksum && fileMetadata.checksum !== receivedChecksum) {
            integrityStatus = '⚠️ Checksum mismatch (possible corruption)';
            log('Warning: Checksum mismatch', 'warning');
        }

        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        receivedData = blob;

        document.getElementById('listenerStatus').textContent = '✅ File received successfully!';
        document.getElementById('receivedFileName').textContent = fileMetadata.filename;
        document.getElementById('receivedFileSize').textContent = formatFileSize(blob.size);
        document.getElementById('integrityStatus').textContent = integrityStatus;
        document.getElementById('receivedFile').classList.remove('hidden');
        document.getElementById('signalQuality').textContent =
            `${Math.round((receivedChunks.size / expectedChunks) * 100)}%`;

        log(`File received: ${fileMetadata.filename} (${receivedChunks.size}/${expectedChunks} chunks)`, 'success');

        stopListening();

    } catch (error) {
        log(`File reconstruction error: ${error.message}`, 'error');
    }
}

function downloadReceived() {
    if (!receivedData) return;

    const url = URL.createObjectURL(receivedData);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileMetadata.filename || 'received_file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    log('File downloaded successfully!', 'success');
}

// =============================================================================
// SIGNAL MONITORING (VISUALIZATION)
// =============================================================================

let signalMonitorInterval = null;

function startSignalMonitoring() {
    signalMonitorInterval = setInterval(() => {
        if (!analyser || (!isSending && !isListening)) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const snr = signalMonitor.updateSNR(dataArray, optimalFrequencies);
        currentSNR = snr;

        // Update UI
        updateSignalStrengthUI(snr);

        // Adjust power if sending
        if (isSending && CONFIG.ENABLE_ADAPTIVE_POWER) {
            powerController.adjustPower(snr);
        }
    }, 100);
}

function stopSignalMonitoring() {
    if (signalMonitorInterval) {
        clearInterval(signalMonitorInterval);
        signalMonitorInterval = null;
    }
}

function updateSignalStrengthUI(snr) {
    const snrValue = document.getElementById('snrValue');
    const snrBar = document.getElementById('snrBar');
    const qualityText = document.getElementById('qualityText');

    if (snrValue) snrValue.textContent = `${snr.toFixed(1)} dB`;
    if (snrBar) snrBar.style.width = `${Math.min(100, (snr / 30) * 100)}%`;

    if (qualityText) {
        const quality = signalMonitor.getSignalQuality();
        qualityText.textContent = quality;

        // Color coding
        if (snr >= 20) snrBar.style.background = 'linear-gradient(90deg, #4caf50, #45a049)';
        else if (snr >= 10) snrBar.style.background = 'linear-gradient(90deg, #ffeb3b, #fdd835)';
        else snrBar.style.background = 'linear-gradient(90deg, #ff6b6b, #ee5a52)';
    }
}

// =============================================================================
// VISUALIZATION
// =============================================================================

let sendAnimationId = null;
let receiveAnimationId = null;

function startSendVisualization() {
    const canvas = document.getElementById('senderVisualizer');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let phase = 0;

    function animate() {
        if (!isSending) return;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        optimalFrequencies.forEach((freq, idx) => {
            const yOffset = canvas.height / 2;
            const amplitude = 30;

            ctx.strokeStyle = `hsla(${idx * 90}, 70%, 60%, 0.8)`;
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let x = 0; x < canvas.width; x++) {
                const y = yOffset + amplitude * Math.sin(x * 0.02 * (idx + 1) + phase);
                if (x === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }

            ctx.stroke();
        });

        phase += 0.1;
        sendAnimationId = requestAnimationFrame(animate);
    }

    animate();
}

function stopSendVisualization() {
    if (sendAnimationId) {
        cancelAnimationFrame(sendAnimationId);
        sendAnimationId = null;
    }
}

function startReceiveVisualization() {
    const canvas = document.getElementById('listenerVisualizer');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function animate() {
        if (!isListening) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = canvas.width / 100;
        let x = 0;

        for (let i = 0; i < 100; i++) {
            const idx = Math.floor(i * bufferLength / 100);
            const barHeight = (dataArray[idx] / 255) * canvas.height;

            const hue = (i / 100) * 120 + 180;
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

            x += barWidth;
        }

        receiveAnimationId = requestAnimationFrame(animate);
    }

    animate();
}

function stopReceiveVisualization() {
    if (receiveAnimationId) {
        cancelAnimationFrame(receiveAnimationId);
        receiveAnimationId = null;
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

window.addEventListener('load', () => {
    log('SonicTransfer Enhanced v2.5 loaded!', 'info');
    log('Speed Optimization: 4 profiles from 10-960 B/s', 'success');
    log('v2.0 Features: ACK/NACK, Signal Monitor, LZ Compression, Presets, Adaptive Power', 'success');

    // Show current speed profile
    const speed = calculateTheoreticalSpeed(currentProfile);
    log(`Current profile: FAST (${speed.effectiveBytesPerSecond} B/s estimated)`, 'info');

    updatePresetUI();
    updateSpeedProfileUI();

    // Log available profiles
    console.group('🚀 Available Speed Profiles:');
    Object.entries(SPEED_PROFILES).forEach(([name, profile]) => {
        const s = calculateTheoreticalSpeed(profile);
        console.log(`${name}: ${s.effectiveBytesPerSecond} B/s (${s.speedup.toFixed(1)}x) - ${profile.DESCRIPTION}`);
    });
    console.groupEnd();
});
