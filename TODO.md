# TODO - SonicTransfer Future Features & Improvements

This document tracks potential enhancements, feature requests, and improvements for future versions of SonicTransfer.

---

## 🚀 High Priority (v2.1)

### 1. Full Bidirectional ACK/NACK Implementation
**Status**: Partially implemented (structure only)
**Effort**: High
**Impact**: High reliability improvement

- [ ] Implement true bidirectional communication
- [ ] Add separate ACK/NACK transmission channel
- [ ] Sender listens for acknowledgment after each packet
- [ ] Automatic retransmission on NACK
- [ ] Timeout handling for missing ACKs
- [ ] Display ACK statistics in UI

**Benefits**: Guaranteed delivery, real confirmation of received chunks

---

### 2. Pause/Resume Transmission
**Status**: Not implemented
**Effort**: Medium
**Impact**: Better UX for large files

- [ ] Add "Pause" button during transmission
- [ ] Save transmission state (which chunks sent)
- [ ] Resume from last successful chunk
- [ ] Persist state to localStorage
- [ ] Handle receiver reconnection
- [ ] Show "Resume Available" on page load

**Benefits**: Allows interruption without starting over, better for unreliable environments

---

### 3. Transfer History & Statistics
**Status**: Not implemented
**Effort**: Low-Medium
**Impact**: Better analytics and debugging

- [ ] Save transfer history to localStorage
- [ ] Display past transfers (filename, size, date, duration)
- [ ] Track success/failure rates
- [ ] Export statistics as CSV/JSON
- [ ] Clear history option
- [ ] Show average transfer speed over time

**Benefits**: Users can track performance, useful for debugging

---

### 4. Multi-File Queue
**Status**: Not implemented
**Effort**: Medium
**Impact**: Convenience for batch transfers

- [ ] Allow selecting multiple files
- [ ] Display queue with file list
- [ ] Transmit files sequentially
- [ ] Show overall progress (X of Y files)
- [ ] Allow reordering queue
- [ ] Remove files from queue
- [ ] Pause/resume entire queue

**Benefits**: Transfer multiple files without manual intervention

---

### 5. Dark Mode Toggle
**Status**: Not implemented
**Effort**: Low
**Impact**: User preference/accessibility

- [ ] Add theme toggle button in header
- [ ] Dark color scheme design
- [ ] Save preference to localStorage
- [ ] Respect system preference (prefers-color-scheme)
- [ ] Smooth transition animation
- [ ] Update all panels and visualizations

**Benefits**: Reduced eye strain, user preference

---

## 🎯 Medium Priority (v2.2 - v3.0)

### 6. Advanced Compression Algorithms
**Status**: LZ77 only
**Effort**: Medium
**Impact**: Better compression ratios

- [ ] Add Brotli compression option
- [ ] Add LZMA compression option
- [ ] Implement Huffman coding
- [ ] Automatic algorithm selection based on file type
- [ ] Compression ratio comparison in UI
- [ ] Configuration panel for compression settings

**Benefits**: Better compression for various file types, faster transfers

---

### 7. Reed-Solomon Error Correction
**Status**: Not implemented
**Effort**: High
**Impact**: Much better reliability in noisy environments

- [ ] Implement RS encoding library
- [ ] Add FEC to each packet
- [ ] Configurable redundancy level (10%, 25%, 50%)
- [ ] Recover corrupted packets without retransmission
- [ ] Show error correction stats
- [ ] Trade-off: slower speed for reliability

**Benefits**: Can recover from errors without retries, much more robust

---

### 8. AES Encryption
**Status**: Not implemented
**Effort**: Medium-High
**Impact**: Security for sensitive files

- [ ] Implement AES-256-GCM encryption
- [ ] Key exchange protocol (ECDH)
- [ ] Password-based encryption option
- [ ] QR code for key sharing
- [ ] Visual encryption indicator
- [ ] "Encrypted" badge in logs

**Benefits**: Secure transfer of sensitive data

---

### 9. Higher-Order Modulation (QPSK, 8-PSK)
**Status**: FSK only
**Effort**: High
**Impact**: 2-4x speed increase

- [ ] Implement QPSK (2 bits per symbol)
- [ ] Implement 8-PSK (3 bits per symbol)
- [ ] Implement 16-QAM (4 bits per symbol)
- [ ] Adaptive modulation based on SNR
- [ ] Configuration option for modulation type
- [ ] Fallback to simpler modulation if errors increase

**Benefits**: Much faster transfers in good conditions

---

### 10. OFDM (Orthogonal Frequency Division Multiplexing)
**Status**: Not implemented
**Effort**: Very High
**Impact**: Massive speed increase + robustness

- [ ] Design OFDM symbol structure
- [ ] Implement FFT/IFFT for modulation
- [ ] Add cyclic prefix for multipath resistance
- [ ] Pilot tones for channel estimation
- [ ] Subcarrier allocation algorithm
- [ ] Handle frequency-selective fading

**Benefits**: State-of-the-art performance, like WiFi/LTE

---

### 11. Automatic Retry with Exponential Backoff
**Status**: Fixed retry count
**Effort**: Low
**Impact**: Better handling of temporary issues

- [ ] Implement exponential backoff (1s, 2s, 4s, 8s...)
- [ ] Jitter to avoid synchronization
- [ ] Maximum backoff time limit
- [ ] Reset backoff on success
- [ ] Display retry countdown in UI

**Benefits**: Handles temporary noise spikes better

---

### 12. Channel Equalization
**Status**: Not implemented
**Effort**: High
**Impact**: Better performance in reverberant spaces

- [ ] Measure channel impulse response
- [ ] Implement frequency-domain equalization
- [ ] Adaptive equalizer coefficients
- [ ] Handle multipath interference
- [ ] Compensate for frequency-selective fading

**Benefits**: Works better in echoey rooms

---

## 💡 Nice to Have (v3.0+)

### 13. Voice Announcement
**Status**: Not implemented
**Effort**: Low
**Impact**: Accessibility

- [ ] Text-to-speech for status updates
- [ ] "Transfer starting", "Transfer complete", etc.
- [ ] Toggle option in settings
- [ ] Adjustable voice speed/volume
- [ ] Multiple language support

**Benefits**: Accessibility for visually impaired users

---

### 14. Mobile-Optimized UI
**Status**: Desktop-focused
**Effort**: Medium
**Impact**: Mobile usability

- [ ] Responsive design improvements
- [ ] Touch-optimized controls
- [ ] Larger buttons and text
- [ ] Vertical layout for portrait mode
- [ ] Mobile-specific gestures
- [ ] PWA manifest for "Add to Home Screen"

**Benefits**: Better experience on phones/tablets

---

### 15. Cloud Preset Sync
**Status**: localStorage only
**Effort**: Medium-High
**Impact**: Convenience across devices

- [ ] Design simple sync backend
- [ ] User accounts (optional)
- [ ] Sync presets across devices
- [ ] Share presets with others
- [ ] Public preset library
- [ ] Import/export as backup

**Benefits**: Presets available everywhere

---

### 16. QR Code File Transfer Initiation
**Status**: Not implemented
**Effort**: Low
**Impact**: Convenience

- [ ] Generate QR code with transfer metadata
- [ ] Scan QR to auto-configure receiver
- [ ] Include preset/frequency info
- [ ] Security: include encryption key in QR
- [ ] Display QR on sender, scan on receiver

**Benefits**: Easier setup for sender/receiver pairing

---

### 17. Waveform Editor / Custom Frequencies
**Status**: Auto-calibration only
**Effort**: Medium
**Impact**: Advanced user control

- [ ] Interactive frequency band selector
- [ ] Manual frequency input
- [ ] Visual frequency conflicts display
- [ ] Save custom frequency sets
- [ ] Test mode to hear frequencies
- [ ] Frequency response graph

**Benefits**: Power users can optimize manually

---

### 18. Waterfall Spectrum Display
**Status**: Basic spectrogram
**Effort**: Medium
**Impact**: Better visualization

- [ ] Continuous scrolling waterfall
- [ ] Color-coded intensity
- [ ] Show transmission in real-time
- [ ] Zoom controls
- [ ] Frequency markers
- [ ] Time markers

**Benefits**: Professional-looking visualization, easier debugging

---

### 19. Stereo Channel Usage
**Status**: Mono only
**Effort**: Medium
**Impact**: 2x speed increase

- [ ] Use left and right channels independently
- [ ] 8 frequency channels total (4 per channel)
- [ ] Proper stereo calibration
- [ ] Handle mono fallback
- [ ] Configuration toggle

**Benefits**: Double the bandwidth with stereo audio

---

### 20. Machine Learning for Environment Detection
**Status**: Rule-based detection
**Effort**: High
**Impact**: Better auto-configuration

- [ ] Train ML model on environment samples
- [ ] Classify: quiet, normal, noisy, very noisy, specific room types
- [ ] Recommend optimal settings automatically
- [ ] Learn from past transfers
- [ ] Predict best frequencies
- [ ] Edge ML (runs in browser)

**Benefits**: Smarter automatic configuration

---

### 21. Automatic Gain Control (AGC)
**Status**: Manual adaptive power
**Effort**: Medium
**Impact**: More stable transmissions

- [ ] Measure input signal level
- [ ] Adjust microphone gain dynamically
- [ ] Prevent clipping/saturation
- [ ] Smooth gain transitions
- [ ] Display gain level in UI

**Benefits**: Consistent audio levels, prevents distortion

---

### 22. Echo Cancellation
**Status**: Not implemented
**Effort**: High
**Impact**: Full-duplex communication (simultaneous send/receive)

- [ ] Implement acoustic echo cancellation (AEC)
- [ ] Allow simultaneous transmission and reception
- [ ] Bi-directional ACK without delays
- [ ] Handle feedback loops
- [ ] Adaptive filter for echo path

**Benefits**: True full-duplex, instant ACKs

---

### 23. File Integrity Verification UI
**Status**: Basic checksum display
**Effort**: Low
**Impact**: User confidence

- [ ] Visual checksum comparison
- [ ] Chunk-by-chunk integrity display
- [ ] Highlight corrupted chunks
- [ ] Option to request retransmission of specific chunks
- [ ] SHA-256 hash display
- [ ] Compare with original file hash

**Benefits**: Users can verify integrity visually

---

### 24. Bandwidth Profiler
**Status**: Not implemented
**Effort**: Medium
**Impact**: Optimization insights

- [ ] Measure actual throughput over time
- [ ] Display bandwidth usage graph
- [ ] Show theoretical vs actual speed
- [ ] Identify bottlenecks
- [ ] Export profiling data
- [ ] Recommendations for improvement

**Benefits**: Understand performance characteristics

---

### 25. Internationalization (i18n)
**Status**: English only
**Effort**: Medium
**Impact**: Global reach

- [ ] Extract all strings to language files
- [ ] Support multiple languages (ES, FR, DE, JP, CN, etc.)
- [ ] Language selector in UI
- [ ] RTL language support
- [ ] Localized number/date formats
- [ ] Community translation contributions

**Benefits**: Accessible to non-English speakers

---

## 🔧 Technical Debt & Refactoring

### 26. Modular Architecture
**Status**: Monolithic JS files
**Effort**: High
**Impact**: Maintainability

- [ ] Split into ES6 modules
- [ ] Separate concerns (audio, UI, compression, etc.)
- [ ] Build system (Webpack/Rollup)
- [ ] Tree-shaking for smaller bundle
- [ ] TypeScript conversion
- [ ] Unit tests for each module

---

### 27. Automated Testing
**Status**: Manual testing only
**Effort**: Medium-High
**Impact**: Reliability

- [ ] Unit tests (Jest)
- [ ] Integration tests
- [ ] Browser compatibility tests (Playwright)
- [ ] Performance regression tests
- [ ] CI/CD pipeline
- [ ] Code coverage tracking

---

### 28. Documentation Improvements
**Status**: Good, but can be better
**Effort**: Low-Medium
**Impact**: Developer onboarding

- [ ] Add JSDoc comments throughout
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Protocol specification document
- [ ] Contributing guidelines
- [ ] Video tutorials
- [ ] Interactive demo

---

### 29. Performance Optimization
**Status**: Good, but can be better
**Effort**: Medium
**Impact**: Faster, smoother experience

- [ ] Web Workers for compression/decompression
- [ ] OffscreenCanvas for visualizations
- [ ] Optimize FFT calculations
- [ ] Reduce memory allocations
- [ ] Profile and eliminate bottlenecks
- [ ] Lazy loading of features

---

### 30. Browser Extension
**Status**: Not implemented
**Effort**: High
**Impact**: Easy installation

- [ ] Chrome/Firefox extension
- [ ] Background page for persistent state
- [ ] Browser action button
- [ ] Context menu "Send via SonicTransfer"
- [ ] Notifications
- [ ] No need to open website

---

## 📱 Platform Expansions

### 31. Native Mobile Apps
**Status**: Web only
**Effort**: Very High
**Impact**: Native mobile experience

- [ ] React Native or Flutter app
- [ ] iOS App Store
- [ ] Google Play Store
- [ ] Native audio APIs
- [ ] Background transfers
- [ ] Share sheet integration

---

### 32. Desktop Application
**Status**: Web only
**Effort**: High
**Impact**: Desktop-native experience

- [ ] Electron app
- [ ] macOS, Windows, Linux
- [ ] System tray icon
- [ ] Native file picker
- [ ] Auto-update
- [ ] Installer packages

---

### 33. Command-Line Interface
**Status**: Web only
**Effort**: Medium
**Impact**: Automation/scripting

- [ ] Node.js CLI tool
- [ ] Send/receive from terminal
- [ ] Scriptable
- [ ] Batch processing
- [ ] Config file support
- [ ] Progress bar in terminal

---

## 🌟 Experimental / Research

### 34. Ultrasonic Frequencies (20kHz+)
**Status**: Audible range only
**Effort**: Medium
**Impact**: Inaudible transfers

- [ ] Use 20-24 kHz range
- [ ] Completely silent to humans
- [ ] Requires good speakers/mics
- [ ] May not work on all devices
- [ ] Toggle between audible/ultrasonic

**Benefits**: Silent transfers, less annoying

---

### 35. Quantum-Inspired Error Correction
**Status**: Not implemented
**Effort**: Very High (Research)
**Impact**: Theoretical

- [ ] Research quantum error correction codes
- [ ] Adapt for acoustic channel
- [ ] Implement if beneficial
- [ ] Academic paper?

---

### 36. AI-Powered Noise Reduction
**Status**: Not implemented
**Effort**: High
**Impact**: Better in noisy environments

- [ ] Train ML model for noise reduction
- [ ] Real-time denoising
- [ ] Improve SNR artificially
- [ ] TensorFlow.js integration
- [ ] Edge deployment

---

### 37. Mesh Network Protocol
**Status**: Point-to-point only
**Effort**: Very High
**Impact**: Multi-hop transfers

- [ ] Design mesh protocol
- [ ] Routing algorithm
- [ ] Multi-hop relaying
- [ ] Network discovery
- [ ] Topology visualization

**Benefits**: Transfer across rooms via intermediaries

---

### 38. Hardware Device
**Status**: Software only
**Effort**: Extreme
**Impact**: Dedicated hardware

- [ ] Design custom hardware device
- [ ] Dedicated DSP chip
- [ ] Optimized speakers/mics
- [ ] Standalone operation
- [ ] Physical buttons
- [ ] Production & sales

**Benefits**: Best possible performance, standalone device

---

## 🐛 Known Issues to Fix

### Bug Fixes
- [ ] Fix frequency line dragging on mobile (touch events)
- [ ] Handle browser tab going to background (audio context suspension)
- [ ] Improve error messages for microphone permission denial
- [ ] Fix spectrogram scaling on very wide screens
- [ ] Handle file size > 5MB (currently slow/unstable)
- [ ] Fix preset dropdown not updating after delete
- [ ] Improve chunk retry logic when receiver stops listening

### UX Improvements
- [ ] Add loading spinner during calibration
- [ ] Show "Waiting for receiver..." message
- [ ] Better error recovery (don't just disable buttons)
- [ ] Tooltips for all buttons and features
- [ ] Keyboard shortcuts (Space to start/stop, etc.)
- [ ] Drag-to-reorder files in queue

---

## 📊 Metrics & Analytics

### 39. Anonymous Usage Statistics
**Status**: Not implemented
**Effort**: Low
**Impact**: Product insights

- [ ] Opt-in analytics
- [ ] Track feature usage
- [ ] Track success/failure rates
- [ ] Browser/device stats
- [ ] Performance metrics
- [ ] Privacy-respecting (no PII)

---

## 🤝 Community & Collaboration

### 40. Public Roadmap
**Status**: This document
**Effort**: Low
**Impact**: Community engagement

- [ ] GitHub Projects board
- [ ] Vote on features
- [ ] Discussion forum
- [ ] Feature request process
- [ ] Contributor recognition

---

### 41. Plugin System
**Status**: Not implemented
**Effort**: High
**Impact**: Extensibility

- [ ] Define plugin API
- [ ] Allow community plugins
- [ ] Compression plugins
- [ ] Modulation plugins
- [ ] UI theme plugins
- [ ] Plugin marketplace

---

## 📝 Documentation Projects

### 42. Research Paper
**Status**: Not started
**Effort**: High
**Impact**: Academic contribution

- [ ] Write formal paper on system
- [ ] Performance analysis
- [ ] Comparison with other methods
- [ ] Submit to conference (ICASSP?)
- [ ] Open access publication

---

### 43. Video Tutorial Series
**Status**: Not started
**Effort**: Medium
**Impact**: User onboarding

- [ ] Introduction video
- [ ] How to send files
- [ ] How to receive files
- [ ] Advanced features
- [ ] Troubleshooting
- [ ] Developer deep-dive

---

## 🎓 Educational Features

### 44. Interactive Tutorial
**Status**: Not implemented
**Effort**: Medium
**Impact**: Better onboarding

- [ ] Step-by-step guided tour
- [ ] Highlight UI elements
- [ ] Try it yourself with test files
- [ ] Skip/replay options
- [ ] Different tutorial paths (beginner/advanced)

---

### 45. Signal Processing Visualizer
**Status**: Basic visualizations
**Effort**: Medium
**Impact**: Educational value

- [ ] Show FFT breakdown
- [ ] Display constellation diagram
- [ ] Show bit error rate
- [ ] Explain each step visually
- [ ] "Educational Mode" toggle

---

## Priority Legend

- 🔴 **Critical**: Fixes or features needed for stability/usability
- 🟠 **High**: Major features that significantly improve the product
- 🟡 **Medium**: Nice improvements with good ROI
- 🟢 **Low**: Nice-to-have features
- 🔵 **Research**: Experimental or exploratory work

---

## How to Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Picking a task from this list
- Proposing new features
- Submitting pull requests
- Code style and testing requirements

---

## Version Roadmap

**v2.1** (Q1 2025)
- Full ACK/NACK
- Pause/Resume
- Dark Mode
- Transfer History

**v2.2** (Q2 2025)
- Advanced Compression
- Reed-Solomon FEC
- Multi-File Queue

**v3.0** (Q3 2025)
- QPSK/8-PSK Modulation
- AES Encryption
- OFDM (stretch goal)

**v4.0** (2026)
- Native Apps
- Mesh Network
- Hardware Device (research)

---

**Last Updated**: 2024-11-19
**Maintainer**: SonicTransfer Team
**License**: Same as project
