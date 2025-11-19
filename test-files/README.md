# Test Files for SonicTransfer

This directory contains sample files for testing SonicTransfer's acoustic file transfer capabilities.

## Files

### 📄 small-text.txt (~700 bytes)
**Purpose**: Basic functionality test
**Expected compression**: ~50-60% reduction
**Transfer time (v2.0)**: ~2-3 seconds
**Best for**: First-time users, quick verification

### 📊 sample-data.json (~2 KB)
**Purpose**: JSON compression test
**Expected compression**: ~45-55% reduction
**Transfer time (v2.0)**: ~5-7 seconds
**Best for**: Testing structured data and high compression ratio

### 📈 sample-data.csv (~800 bytes)
**Purpose**: CSV compression test
**Expected compression**: ~40-50% reduction
**Transfer time (v2.0)**: ~3-4 seconds
**Best for**: Testing tabular data transfer

## Usage Instructions

### For Sender:
1. Open SonicTransfer (`index-enhanced.html`)
2. Click "📤 Send File" mode
3. Drag and drop one of these test files
4. Click "🚀 Auto-Calibrate & Send"
5. Keep devices close together (~1 meter)

### For Receiver:
1. Open SonicTransfer on another device
2. Click "📥 Receive File" mode
3. Click "🎧 Start Listening"
4. Position device near sender's speaker
5. Wait for transmission to complete
6. Verify file integrity (checksum should match)

## What to Observe

### Compression Performance
Watch the log for compression messages:
```
File compressed: 700B → 350B (50% reduction)
```

### Transfer Speed
Monitor real-time statistics:
- **Chunks Received**: Progress indicator
- **Bytes/sec**: Current transfer rate
- **Signal Quality**: Reception reliability

### Signal Quality
Watch the SNR monitor:
- **Green (≥15dB)**: Excellent conditions
- **Yellow (10-15dB)**: Acceptable
- **Red (<10dB)**: Move devices closer

## Expected Results

### small-text.txt
```
Original size: 700 bytes
Compressed size: ~350 bytes (50% reduction)
Transfer time: ~2-3 seconds
Chunk success rate: ~99%
```

### sample-data.json
```
Original size: 2048 bytes
Compressed size: ~1000 bytes (51% reduction)
Transfer time: ~5-7 seconds
Chunk success rate: ~99%
```

### sample-data.csv
```
Original size: 800 bytes
Compressed size: ~450 bytes (44% reduction)
Transfer time: ~3-4 seconds
Chunk success rate: ~99%
```

## Troubleshooting

### Low Signal Quality
- Move devices closer (within 1 meter)
- Reduce ambient noise
- Increase speaker volume (but not to distortion)
- Try manual calibration for better frequency selection

### Slow Transfer
- Check SNR is above 10dB
- Ensure compression is enabled (`CONFIG.USE_COMPRESSION = true`)
- Verify adaptive power is working (watch logs)
- Try different environment or time of day

### Failed Chunks
- System will automatically retry (up to 3 attempts)
- If retries fail consistently, check microphone permissions
- Try lower speaker volume to prevent distortion
- Move devices to quieter environment

## Advanced Testing

### Test Compression Bypass
For already-compressed files (ZIP, PNG, JPEG), compression provides minimal benefit:
```javascript
// In sonic-transfer-enhanced.js
CONFIG.USE_COMPRESSION = false;  // Disable to test raw transfer
```

### Test Different Environments
Save calibration presets for:
- Quiet room (home office)
- Normal environment (living room)
- Noisy environment (cafe, open office)

### Test Distance Limits
Gradually increase distance between devices:
- 0.5m: Excellent (~25dB SNR)
- 1.0m: Good (~15-20dB SNR)
- 1.5m: Fair (~10-15dB SNR)
- 2.0m: Poor (<10dB SNR) - Adaptive power at maximum

## Performance Benchmarks

Use these files to benchmark your specific environment:

| File | Size | Compressed | Chunks | Time (v1.0) | Time (v2.0) | Improvement |
|------|------|-----------|--------|-------------|-------------|-------------|
| small-text.txt | 700B | 350B | 6 | ~10s | ~2s | **80%** |
| sample-data.json | 2KB | 1KB | 16 | ~28s | ~5s | **82%** |
| sample-data.csv | 800B | 450B | 7 | ~11s | ~3s | **73%** |

*Times are approximate and depend on environment noise and device positioning*

## Contributing Test Files

To add more test files:
1. Keep files small (<10KB recommended)
2. Include diverse formats (text, JSON, CSV, XML, etc.)
3. Document expected compression ratio
4. Test on multiple devices and environments

## Notes

- All times assume optimal conditions (quiet environment, 1m distance, good SNR)
- Compression ratios vary based on file content and structure
- Transfer speeds include protocol overhead (preamble, metadata, checksums)
- Actual results may vary based on browser, device, and environment
