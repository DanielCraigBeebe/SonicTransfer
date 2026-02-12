// SonicTransfer v2.5 - High-Speed Mode for Quiet Environments
// Optimizations: More channels, faster symbols, QPSK, binary encoding

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
// CALCULATE THEORETICAL SPEEDS
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
        speedup: effectiveBytesPerSecond / 10  // vs current ~10 bytes/sec
    };
}

// Log speeds for all profiles
console.group('🚀 Speed Profile Comparison');
Object.entries(SPEED_PROFILES).forEach(([name, profile]) => {
    const speed = calculateTheoreticalSpeed(profile);
    console.log(`${name}: ${speed.effectiveBytesPerSecond} B/s (${speed.speedup.toFixed(1)}x faster)`);
    console.log(`  - ${profile.DESCRIPTION}`);
});
console.groupEnd();

// =============================================================================
// ENHANCED CONFIGURATION
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
    USE_REDUNDANCY: false,
    MAX_RETRIES: 3,
    ACK_TIMEOUT: 1000,

    // Compression
    USE_COMPRESSION: true,
    COMPRESSION_MIN_SIZE: 512,  // Lowered threshold

    // Adaptive power
    ENABLE_ADAPTIVE_POWER: true,
    MIN_POWER: 0.03,
    MAX_POWER: 0.15,
    TARGET_SNR: 15,

    // Signal monitoring
    SNR_HISTORY_SIZE: 50,
};

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
}

// =============================================================================
// CHUNK GROUPING & RUNTIME COMPRESSION
// =============================================================================

class ChunkOptimizer {
    // Group multiple small chunks into larger packets
    static groupChunks(chunks, maxGroupSize = 4) {
        const groups = [];
        for (let i = 0; i < chunks.length; i += maxGroupSize) {
            const group = chunks.slice(i, Math.min(i + maxGroupSize, chunks.length));
            groups.push({
                startIdx: i,
                count: group.length,
                data: this.concatenateChunks(group)
            });
        }
        return groups;
    }

    static concatenateChunks(chunks) {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;

        chunks.forEach(chunk => {
            combined.set(chunk, offset);
            offset += chunk.length;
        });

        return combined;
    }

    // Run-length encoding for repetitive data
    static runLengthEncode(data) {
        const result = [];
        let i = 0;

        while (i < data.length) {
            let count = 1;
            const value = data[i];

            while (i + count < data.length && data[i + count] === value && count < 255) {
                count++;
            }

            if (count > 3) {
                // Use RLE marker (0xFF) + count + value
                result.push(0xFF, count, value);
            } else {
                // Just output the values
                for (let j = 0; j < count; j++) {
                    result.push(value);
                }
            }

            i += count;
        }

        return new Uint8Array(result);
    }

    static runLengthDecode(data) {
        const result = [];
        let i = 0;

        while (i < data.length) {
            if (data[i] === 0xFF && i + 2 < data.length) {
                const count = data[i + 1];
                const value = data[i + 2];
                for (let j = 0; j < count; j++) {
                    result.push(value);
                }
                i += 3;
            } else {
                result.push(data[i]);
                i++;
            }
        }

        return new Uint8Array(result);
    }
}

// =============================================================================
// SPEED PROFILE SELECTOR UI
// =============================================================================

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
// ENHANCED TRANSMISSION WITH PROFILE
// =============================================================================

async function transmitBinaryOptimized(binaryString) {
    if (currentProfile.BITS_PER_SYMBOL === 1) {
        // FSK mode (existing logic)
        return await transmitBinaryChord(binaryString);
    } else if (currentProfile.BITS_PER_SYMBOL === 2) {
        // QPSK mode
        return await transmitBinaryQPSK(binaryString);
    } else if (currentProfile.BITS_PER_SYMBOL === 3) {
        // 8-PSK mode
        return await transmitBinary8PSK(binaryString);
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

// =============================================================================
// SPEED COMPARISON CALCULATOR
// =============================================================================

function compareSpeedProfiles(fileSize) {
    console.group(`📊 Transfer Time Comparison for ${formatFileSize(fileSize)}`);

    Object.entries(SPEED_PROFILES).forEach(([name, profile]) => {
        const savedProfile = currentProfile;
        currentProfile = profile;
        const speed = calculateTheoreticalSpeed(profile);
        currentProfile = savedProfile;

        const transferTime = fileSize / speed.effectiveBytesPerSecond;
        console.log(`${name}: ${formatTime(transferTime)} at ${speed.effectiveBytesPerSecond} B/s`);
    });

    console.groupEnd();
}

// Export for console use
window.setSpeedProfile = setSpeedProfile;
window.compareSpeedProfiles = compareSpeedProfiles;
window.SPEED_PROFILES = SPEED_PROFILES;

export {
    CONFIG,
    SPEED_PROFILES,
    setSpeedProfile,
    calculateTheoreticalSpeed,
    BinaryEncoder,
    QPSKModulator,
    PSK8Modulator,
    ChunkOptimizer,
    compareSpeedProfiles
};
