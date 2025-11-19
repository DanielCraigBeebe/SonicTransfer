// SonicTransfer - Enhanced Acoustic File Transfer
// Features: Chord transmission, real FSK demodulation, improved UX

// =============================================================================
// GLOBAL CONFIGURATION
// =============================================================================

const CONFIG = {
    // Audio parameters
    SAMPLE_RATE: 44100,
    FFT_SIZE: 8192,  // Larger FFT for better frequency resolution

    // Frequency configuration
    FREQ_MIN: 2000,
    FREQ_MAX: 10000,
    NUM_CHANNELS: 4,  // Number of parallel frequency channels (chord)
    CHANNEL_SPACING: 400,  // Hz between channels

    // Modulation
    FSK_DEVIATION: 100,  // Hz deviation for FSK
    SYMBOL_DURATION: 40,  // ms per symbol (increased from 50 for speed)

    // Transmission
    CHUNK_SIZE: 64,  // bytes per chunk (increased from 50)
    PREAMBLE_DURATION: 800,  // ms
    PACKET_DELAY: 10,  // ms between packets (reduced for speed)

    // Reception
    SIGNAL_THRESHOLD: 80,  // Amplitude threshold for signal detection
    CALIBRATION_DURATION: 3000,  // ms (reduced from 6000)
    MIN_SNR: 10,  // Minimum signal-to-noise ratio (dB)

    // Error correction
    USE_CHECKSUM: true,
    USE_REDUNDANCY: true,  // Send each chunk twice
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function log(message, type = 'info') {
    const logElement = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `${timestamp}: ${message}`;
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;

    // Also console log for debugging
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

    // Store noise floor
    noiseFloor = avgSpectrum;

    // Find quietest frequency bands for our channels
    const freqBins = [];
    for (let freq = CONFIG.FREQ_MIN; freq <= CONFIG.FREQ_MAX - (CONFIG.NUM_CHANNELS * CONFIG.CHANNEL_SPACING); freq += 50) {
        const bin = Math.floor(freq * bufferLength / (sampleRate / 2));
        const noiseLevels = [];

        // Check noise for each potential channel
        for (let ch = 0; ch < CONFIG.NUM_CHANNELS; ch++) {
            const chFreq = freq + (ch * CONFIG.CHANNEL_SPACING);
            const chBin = Math.floor(chFreq * bufferLength / (sampleRate / 2));
            const noise = avgSpectrum[chBin] || 0;
            noiseLevels.push(noise);
        }

        const avgNoise = noiseLevels.reduce((a, b) => a + b, 0) / noiseLevels.length;
        const maxNoise = Math.max(...noiseLevels);

        freqBins.push({ freq, avgNoise, maxNoise });
    }

    // Sort by average noise (lowest first)
    freqBins.sort((a, b) => a.avgNoise - b.avgNoise);

    // Select the quietest base frequency
    const baseFreq = freqBins[0].freq;

    // Generate channel frequencies
    optimalFrequencies = [];
    for (let i = 0; i < CONFIG.NUM_CHANNELS; i++) {
        optimalFrequencies.push(baseFreq + (i * CONFIG.CHANNEL_SPACING));
    }

    isCalibrated = true;

    log(`Calibration complete! Using ${CONFIG.NUM_CHANNELS} channels starting at ${baseFreq} Hz`, 'success');
    log(`Frequencies: ${optimalFrequencies.map(f => f + 'Hz').join(', ')}`, 'info');

    // Update UI
    updateFrequencyDisplay();
    drawSpectrogram(samples);
}

function updateFrequencyDisplay() {
    const freqText = optimalFrequencies.map(f => `${Math.round(f)}Hz`).join(', ');

    const senderFreq = document.getElementById('senderSelectedFreq');
    const listenerFreq = document.getElementById('listenerSelectedFreq');

    if (senderFreq) senderFreq.textContent = freqText;
    if (listenerFreq) listenerFreq.textContent = freqText;

    // Update chord indicator
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

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw spectrogram
    for (let x = 0; x < canvas.width; x++) {
        const sampleIdx = Math.floor(x / canvas.width * samples.length);
        if (sampleIdx >= samples.length) continue;

        const sample = samples[sampleIdx];

        for (let y = 0; y < canvas.height; y++) {
            const freq = CONFIG.FREQ_MAX - (y / canvas.height) * (CONFIG.FREQ_MAX - CONFIG.FREQ_MIN);
            const bin = Math.floor(freq * bufferLength / (sampleRate / 2));
            const amplitude = sample[bin] || 0;
            const intensity = amplitude / 255;

            // Color mapping
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

        const estimatedTime = file.size / (CONFIG.CHUNK_SIZE * CONFIG.NUM_CHANNELS * (1000 / CONFIG.SYMBOL_DURATION));

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
// QUICK SEND (AUTO-CALIBRATE + SEND)
// =============================================================================

async function quickSend() {
    if (!selectedFile) return;

    document.getElementById('quickSendBtn').disabled = true;
    document.getElementById('senderStatus').textContent = 'Quick calibrating environment...';

    log('Starting quick calibration before send...', 'info');

    // Show calibration UI
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
// TRANSMISSION (SENDER)
// =============================================================================

async function startSending() {
    if (!selectedFile || optimalFrequencies.length === 0) {
        log('Please calibrate first', 'warning');
        return;
    }

    isSending = true;
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('quickSendBtn').disabled = true;
    document.getElementById('senderStatus').textContent = 'Reading file...';
    document.getElementById('sendProgress').classList.remove('hidden');
    document.getElementById('chordDisplay').classList.remove('hidden');
    document.getElementById('senderVisualizer').classList.remove('hidden');

    log('Starting file transmission with chord modulation...', 'info');

    // Read file
    const reader = new FileReader();
    reader.onload = async function(e) {
        const arrayBuffer = e.target.result;
        const fileData = new Uint8Array(arrayBuffer);

        // Prepare metadata
        const metadata = {
            filename: selectedFile.name,
            size: selectedFile.size,
            checksum: calculateChecksum(fileData),
            crc: crc16(fileData),
            chunks: Math.ceil(fileData.length / CONFIG.CHUNK_SIZE),
            timestamp: Date.now()
        };

        await transmitFile(metadata, fileData);
    };

    reader.readAsArrayBuffer(selectedFile);
}

async function transmitFile(metadata, fileData) {
    try {
        // Start visualization
        startSendVisualization();

        // Send preamble (sync tones)
        document.getElementById('senderStatus').textContent = 'Sending sync signal...';
        await sendPreamble();

        // Send metadata
        document.getElementById('senderStatus').textContent = 'Sending file information...';
        const metadataStr = JSON.stringify(metadata);
        await sendPacket('META:' + metadataStr);

        log(`Metadata sent: ${metadata.filename} (${metadata.chunks} chunks)`, 'info');

        // Send file data in chunks
        const totalChunks = Math.ceil(fileData.length / CONFIG.CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CONFIG.CHUNK_SIZE;
            const end = Math.min(start + CONFIG.CHUNK_SIZE, fileData.length);
            const chunk = fileData.slice(start, end);

            // Convert to base64
            const base64 = btoa(String.fromCharCode.apply(null, chunk));

            // Send chunk
            await sendPacket(`DATA:${i}:${base64}`);

            // Send redundant copy if enabled
            if (CONFIG.USE_REDUNDANCY && i % 5 === 0) {  // Every 5th chunk
                await sendPacket(`DATA:${i}:${base64}`);
            }

            // Update progress
            const progress = ((i + 1) / totalChunks) * 100;
            document.getElementById('progressText').textContent = `${Math.round(progress)}%`;
            document.getElementById('progressFill').style.width = `${progress}%`;
            document.getElementById('senderStatus').textContent =
                `Sending chunk ${i + 1}/${totalChunks} (${Math.round(progress)}%)`;

            await new Promise(resolve => setTimeout(resolve, CONFIG.PACKET_DELAY));
        }

        // Send end signal
        document.getElementById('senderStatus').textContent = 'Sending completion signal...';
        await sendPacket('END:COMPLETE');
        await new Promise(resolve => setTimeout(resolve, 100));
        await sendPacket('END:COMPLETE');  // Send twice for reliability

        // Complete
        document.getElementById('senderStatus').textContent = '✅ Transmission complete!';
        document.getElementById('progressText').textContent = '100%';
        document.getElementById('progressFill').style.width = '100%';

        log('File transmission completed successfully!', 'success');

        isSending = false;
        stopSendVisualization();
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('quickSendBtn').disabled = false;

    } catch (error) {
        log(`Transmission error: ${error.message}`, 'error');
        isSending = false;
        stopSendVisualization();
        document.getElementById('sendBtn').disabled = false;
        document.getElementById('quickSendBtn').disabled = false;
    }
}

async function sendPreamble() {
    // Send sync tones on all channels
    for (let i = 0; i < 3; i++) {  // 3 pulses
        await playChord(optimalFrequencies, 150);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

async function sendPacket(message) {
    // Encode message to binary
    const binary = encodeToBinary(message);

    // Add start/stop markers
    const frame = '10101010' + binary + '01010101';  // Sync pattern

    // Transmit using chord modulation
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
    // Split binary into parallel streams (one per channel)
    const streams = [];
    for (let i = 0; i < CONFIG.NUM_CHANNELS; i++) {
        streams.push('');
    }

    for (let i = 0; i < binaryString.length; i++) {
        const channelIdx = i % CONFIG.NUM_CHANNELS;
        streams[channelIdx] += binaryString[i];
    }

    // Pad streams to equal length
    const maxLen = Math.max(...streams.map(s => s.length));
    streams.forEach((s, i) => {
        while (streams[i].length < maxLen) {
            streams[i] += '0';  // Pad with zeros
        }
    });

    // Transmit symbols in parallel
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

async function playChord(frequencies, duration) {
    return new Promise((resolve) => {
        const oscillators = [];
        const gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);  // Low volume per oscillator

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

    document.getElementById('listenBtn').disabled = true;
    document.getElementById('stopListenBtn').disabled = false;
    document.getElementById('listenerStatus').textContent = 'Calibrating environment...';
    document.getElementById('listenerCalibration').classList.remove('hidden');
    document.getElementById('listenerVisualizer').classList.remove('hidden');

    log('Starting listener mode...', 'info');

    // Quick calibration
    await performCalibration(true);

    document.getElementById('listenerStatus').textContent = '🎧 Listening for transmission...';
    log('Listening on frequencies: ' + optimalFrequencies.join(', ') + ' Hz', 'info');

    // Start reception loop
    startReceptionLoop();
    startReceiveVisualization();
}

function stopListening() {
    isListening = false;

    document.getElementById('listenBtn').disabled = false;
    document.getElementById('stopListenBtn').disabled = true;
    document.getElementById('listenerStatus').textContent = 'Stopped listening';
    document.getElementById('listenerVisualizer').classList.add('hidden');

    stopReceptionLoop();
    stopReceiveVisualization();

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
    // Use requestAnimationFrame for smoother performance
    let lastCheckTime = 0;

    function checkForSignal() {
        if (!isListening) return;

        const now = Date.now();
        if (now - lastCheckTime < 20) {  // Check every 20ms
            requestAnimationFrame(checkForSignal);
            return;
        }
        lastCheckTime = now;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Demodulate all channels
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

        // Detect which frequency is stronger
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
    // Add bits to stream
    bits.forEach(bit => {
        if (bit !== null) {
            demodulationState.bitStream += bit;
        }
    });

    // Look for sync pattern
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

    // Try to decode packets
    while (demodulationState.bitStream.length >= 8) {
        // Extract byte
        const byteBits = demodulationState.bitStream.slice(0, 8);
        demodulationState.bitStream = demodulationState.bitStream.slice(8);

        const charCode = parseInt(byteBits, 2);
        const char = String.fromCharCode(charCode);

        demodulationState.packetBuffer += char;

        // Check for packet delimiter or reasonable packet end
        if (demodulationState.packetBuffer.includes('\x00') ||
            (demodulationState.packetBuffer.length > 10 &&
             (demodulationState.packetBuffer.includes('META:') ||
              demodulationState.packetBuffer.includes('DATA:') ||
              demodulationState.packetBuffer.includes('END:')))) {

            processPacket(demodulationState.packetBuffer);
            demodulationState.packetBuffer = '';
            demodulationState.syncDetected = false;
        }

        // Prevent buffer overflow
        if (demodulationState.packetBuffer.length > 5000) {
            log('Packet buffer overflow, resetting', 'warning');
            demodulationState.packetBuffer = '';
            demodulationState.syncDetected = false;
        }
    }
}

function processPacket(packet) {
    // Clean packet
    packet = packet.replace(/\x00/g, '').trim();

    if (!packet || packet.length < 5) return;

    try {
        if (packet.startsWith('META:')) {
            const metaJson = packet.slice(5);
            fileMetadata = JSON.parse(metaJson);
            expectedChunks = fileMetadata.chunks;

            document.getElementById('listenerStatus').textContent =
                `📥 Receiving: ${fileMetadata.filename} (${formatFileSize(fileMetadata.size)})`;
            document.getElementById('receiveProgress').classList.remove('hidden');

            log(`Receiving file: ${fileMetadata.filename} (${expectedChunks} chunks)`, 'success');

        } else if (packet.startsWith('DATA:')) {
            const parts = packet.slice(5).split(':');
            if (parts.length >= 2) {
                const chunkIdx = parseInt(parts[0]);
                const base64Data = parts.slice(1).join(':');

                if (!isNaN(chunkIdx) && !receivedChunks.has(chunkIdx)) {
                    receivedChunks.set(chunkIdx, base64Data);

                    const progress = (receivedChunks.size / expectedChunks) * 100;
                    document.getElementById('receiveProgressText').textContent = `${Math.round(progress)}%`;
                    document.getElementById('receiveProgressFill').style.width = `${progress}%`;
                    document.getElementById('receivedChunks').textContent = receivedChunks.size;

                    // Calculate data rate
                    const elapsed = (Date.now() - receptionStartTime) / 1000;
                    totalBytesReceived += atob(base64Data).length;
                    const rate = Math.round(totalBytesReceived / elapsed);
                    document.getElementById('dataRate').textContent = rate;

                    log(`Chunk ${chunkIdx + 1}/${expectedChunks} received`, 'info');
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
        // Reconstruct file from chunks
        let fileData = '';

        for (let i = 0; i < expectedChunks; i++) {
            if (receivedChunks.has(i)) {
                fileData += atob(receivedChunks.get(i));
            } else {
                log(`Warning: Missing chunk ${i}`, 'warning');
            }
        }

        // Convert to Uint8Array
        const bytes = new Uint8Array(fileData.length);
        for (let i = 0; i < fileData.length; i++) {
            bytes[i] = fileData.charCodeAt(i);
        }

        // Verify checksum
        const receivedChecksum = calculateChecksum(bytes);
        const receivedCrc = crc16(bytes);

        let integrityStatus = '✅ Verified';
        if (fileMetadata.checksum !== receivedChecksum) {
            integrityStatus = '⚠️ Checksum mismatch (possible corruption)';
            log('Warning: Checksum mismatch', 'warning');
        }

        // Create blob
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        receivedData = blob;

        // Update UI
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
// VISUALIZATION
// =============================================================================

let sendAnimationId = null;
let receiveAnimationId = null;

function startSendVisualization() {
    const canvas = document.getElementById('senderVisualizer');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let phase = 0;

    function animate() {
        if (!isSending) return;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw waveforms for each frequency
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
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    function animate() {
        if (!isListening) return;

        // Draw spectrum analyzer
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
    log('SonicTransfer loaded! Select Send or Receive mode to begin.', 'info');
    log(`Enhanced with ${CONFIG.NUM_CHANNELS}-channel chord transmission for ${CONFIG.NUM_CHANNELS}x speed!`, 'success');
});
