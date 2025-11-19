# SonicTransfer

> Transfer files using only sound waves - no cables, WiFi, or Bluetooth required!

## Overview

SonicTransfer is an experimental web application that enables file transfer between devices using acoustic communication. By encoding data as sound waves (using FSK modulation), files can be transmitted through the air using only speakers and microphones.

## Features

### Core Functionality
- **Dual Mode Operation**: Switch between Sender and Listener modes
- **Acoustic File Transfer**: Transmit files using sound waves in the 1-11 kHz frequency range
- **Environment Calibration**: Automatically analyzes ambient noise to select optimal transmission frequency
- **Real-time Spectrogram**: Visual representation of frequency spectrum and noise levels
- **Manual/Auto Frequency Selection**: Choose transmission frequency automatically or manually

### User Interface
- **Interactive Spectrogram**: Click or drag to manually select transmission frequency
- **Drag & Drop File Upload**: Easy file selection for transmission
- **Progress Tracking**: Real-time transmission and reception progress indicators
- **Visual Audio Feedback**: Animated wave visualizer during transmission
- **Activity Log**: Detailed logging of all transmission events

## How It Works

### Technology Stack
- **Web Audio API**: For audio generation and analysis
- **FSK Modulation**: Frequency Shift Keying for binary data encoding
- **Canvas API**: For spectrogram visualization
- **HTML5 File API**: For file reading and download

### Transmission Process

1. **Calibration Phase**
   - Analyzes ambient noise across 10 frequency bands (1-11 kHz)
   - Records 6-second noise profile
   - Automatically selects quietest frequency range
   - Displays real-time spectrogram

2. **Encoding**
   - File metadata (name, size, checksum) transmitted as header
   - Data split into 50-byte chunks
   - Each chunk encoded to binary then FSK modulated
   - FSK uses optimal frequency ±50 Hz for binary 0/1

3. **Transmission**
   - 1-second calibration tone at optimal frequency
   - Header packet with file information
   - Sequential data chunks with 50ms bit duration
   - Completion signal at end

4. **Reception** (Simplified in prototype)
   - Monitors optimal frequency for signal detection
   - Decodes FSK modulated audio stream
   - Reconstructs file from received chunks
   - Verifies integrity using checksum

## Usage

### Getting Started

1. **Open the Application**
   ```bash
   # Simply open the HTML file in a modern web browser
   open "html prototype"
   ```

2. **Grant Microphone Access**
   - Browser will request microphone permissions
   - Required for both sending and receiving

### Sending Files

1. Click **"Sender"** mode button
2. Click **"Start Calibration"** to analyze environment
3. Wait for 6-second calibration to complete
4. Drag and drop a file (or click to browse)
5. Click **"Start Transmission"**
6. Keep devices close together during transmission

### Receiving Files

1. Click **"Listener"** mode button
2. Click **"Start Calibration"** to sync frequency
3. Click **"Start Listening"**
4. Wait for sender to begin transmission
5. Download received file when complete

### Calibration Controls

- **Spectrogram**: Click anywhere to manually set frequency
- **Frequency Line**: Drag the red line vertically to adjust frequency
- **Frequency Bar**: Click or drag the horizontal bar to set frequency
- **Auto/Manual Toggle**: Switch between automatic and manual frequency selection

## Technical Specifications

### Audio Parameters
- **Frequency Range**: 1,000 - 11,000 Hz
- **Sample Rate**: System default (typically 44.1 or 48 kHz)
- **FFT Size**: 2048 bins
- **Modulation**: FSK (Frequency Shift Keying)
- **Frequency Deviation**: ±50 Hz from carrier
- **Bit Duration**: 50 milliseconds

### Performance
- **Data Rate**: ~100 bytes/second (conservative estimate)
- **Recommended File Size**: < 1 MB
- **Chunk Size**: 50 bytes
- **Analysis Duration**: 6 seconds for calibration

### Frequency Bands
The calibration system analyzes 10 frequency ranges:
- 1-2 kHz
- 2-3 kHz
- 3-4 kHz
- 4-5 kHz
- 5-6 kHz
- 6-7 kHz
- 7-8 kHz
- 8-9 kHz
- 9-10 kHz
- 10-11 kHz

## Browser Compatibility

Requires a modern browser with support for:
- Web Audio API
- MediaDevices API (getUserMedia)
- HTML5 Canvas
- ES6+ JavaScript

### Tested Browsers
- Chrome/Chromium 60+
- Firefox 55+
- Safari 14+
- Edge 79+

## Limitations

### Current Prototype Limitations
- **Simplified Decoding**: Reception uses simulated decoding (not full FSK demodulation)
- **Error Correction**: No FEC (Forward Error Correction) implemented
- **Distance**: Effective range limited to close proximity (~1-2 meters)
- **Noise Sensitivity**: Performance degrades in noisy environments
- **Data Rate**: Very low throughput compared to modern wireless protocols

### Recommended Use Cases
- Demonstrations and educational purposes
- Proof of concept for acoustic data transmission
- Air-gapped data transfer scenarios
- Device pairing without network infrastructure

## Security Considerations

- Transmissions are **not encrypted** in this prototype
- Anyone within audio range can intercept transmissions
- Suitable only for non-sensitive data transfers
- Consider adding encryption layer for production use

## Future Enhancements

Potential improvements for production implementation:

- [ ] Full FSK demodulation and decoding
- [ ] Error detection and correction (CRC, Reed-Solomon)
- [ ] Encryption and authentication
- [ ] Higher modulation schemes (QPSK, QAM)
- [ ] Adaptive data rate based on channel quality
- [ ] Multi-frequency transmission (OFDM)
- [ ] Automatic gain control
- [ ] Echo cancellation
- [ ] Compression before transmission

## Troubleshooting

### No Sound During Transmission
- Check browser audio permissions
- Verify speaker volume is adequate
- Ensure audio output device is working

### Listener Not Detecting Signal
- Run calibration on both devices
- Position devices closer together (< 1 meter)
- Reduce ambient noise
- Check microphone is not muted
- Try different frequency (use manual selection)

### Poor Transmission Quality
- Increase distance from noise sources
- Use quieter environment
- Select different frequency band
- Reduce speaker volume (prevent distortion)
- Ensure microphone is not clipping

## Development

### Project Structure
```
SonicTransfer/
├── html prototype    # Complete web application
└── README.md        # This file
```

### Key Functions

**Calibration**
- `startCalibration()`: Initiates 6-second noise analysis
- `completeCalibration()`: Processes results and selects optimal frequency
- `drawAggregatedSpectrogram()`: Renders frequency visualization

**Transmission**
- `startSending()`: Initiates file transmission
- `transmitData()`: Manages transmission sequence
- `sendPacket()`: FSK encodes and plays audio packet
- `playTone()`: Generates audio tones at specified frequency

**Reception**
- `startListening()`: Begins monitoring for transmissions
- `listenForTransmission()`: Detects signals at optimal frequency
- `simulateFileReception()`: Demo reception handler

## Contributing

This is a prototype demonstration. Contributions welcome for:
- Implementing real FSK demodulation
- Adding error correction
- Performance optimization
- Cross-browser compatibility
- Documentation improvements

## License

This project is provided as-is for educational and experimental purposes.

## Acknowledgments

Built using Web Audio API and modern browser capabilities. Inspired by acoustic data transmission protocols like FSK and AFSK used in modems and amateur radio.

---

**Note**: This is a prototype/proof-of-concept. For production file transfers, use established wireless protocols (WiFi, Bluetooth, NFC) which offer better speed, reliability, and security.
