// Browser Compatibility Checker for SonicTransfer
// Checks for required APIs and features

(function() {
    'use strict';

    const REQUIRED_FEATURES = {
        audioContext: {
            name: 'Web Audio API',
            check: () => !!(window.AudioContext || window.webkitAudioContext),
            critical: true,
            description: 'Required for audio generation and analysis'
        },
        getUserMedia: {
            name: 'MediaDevices.getUserMedia',
            check: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            critical: true,
            description: 'Required for microphone access'
        },
        canvas: {
            name: 'HTML5 Canvas',
            check: () => {
                const canvas = document.createElement('canvas');
                return !!(canvas.getContext && canvas.getContext('2d'));
            },
            critical: true,
            description: 'Required for spectrogram visualization'
        },
        localStorage: {
            name: 'localStorage API',
            check: () => {
                try {
                    const test = '__storage_test__';
                    localStorage.setItem(test, test);
                    localStorage.removeItem(test);
                    return true;
                } catch(e) {
                    return false;
                }
            },
            critical: false,
            description: 'Required for calibration presets (v2.0 feature)'
        },
        fileReader: {
            name: 'FileReader API',
            check: () => !!(window.FileReader),
            critical: true,
            description: 'Required for reading files'
        },
        blob: {
            name: 'Blob API',
            check: () => !!(window.Blob),
            critical: true,
            description: 'Required for file download'
        },
        uint8Array: {
            name: 'Typed Arrays',
            check: () => !!(window.Uint8Array),
            critical: true,
            description: 'Required for binary data handling'
        },
        requestAnimationFrame: {
            name: 'requestAnimationFrame',
            check: () => !!(window.requestAnimationFrame),
            critical: false,
            description: 'Required for smooth visualizations'
        }
    };

    class BrowserCompatChecker {
        constructor() {
            this.results = {};
            this.isCompatible = true;
            this.warnings = [];
        }

        checkAll() {
            for (const [key, feature] of Object.entries(REQUIRED_FEATURES)) {
                const supported = feature.check();
                this.results[key] = {
                    ...feature,
                    supported
                };

                if (!supported) {
                    if (feature.critical) {
                        this.isCompatible = false;
                    } else {
                        this.warnings.push(feature);
                    }
                }
            }

            return {
                compatible: this.isCompatible,
                warnings: this.warnings,
                results: this.results
            };
        }

        getReport() {
            const report = {
                compatible: this.isCompatible,
                browser: this.detectBrowser(),
                features: {}
            };

            for (const [key, result] of Object.entries(this.results)) {
                report.features[key] = {
                    name: result.name,
                    supported: result.supported,
                    critical: result.critical
                };
            }

            return report;
        }

        detectBrowser() {
            const ua = navigator.userAgent;
            let browser = 'Unknown';
            let version = 'Unknown';

            if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
                browser = 'Chrome';
                version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
            } else if (ua.indexOf('Edg') > -1) {
                browser = 'Edge';
                version = ua.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
            } else if (ua.indexOf('Firefox') > -1) {
                browser = 'Firefox';
                version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
            } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
                browser = 'Safari';
                version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
            }

            return {
                name: browser,
                version: version,
                userAgent: ua
            };
        }

        displayResults(containerId = 'compatCheckResults') {
            const container = document.getElementById(containerId);
            if (!container) {
                console.warn('Compatibility check container not found');
                return;
            }

            const results = this.checkAll();
            const browser = this.detectBrowser();

            let html = '<div style="padding: 15px; border-radius: 10px; margin: 20px 0;">';

            if (results.compatible) {
                html += `
                    <div style="background: rgba(76, 175, 80, 0.2); padding: 15px; border-radius: 8px; border-left: 4px solid #4caf50;">
                        <h3 style="margin: 0 0 10px 0; color: #4caf50;">✅ Browser Compatible!</h3>
                        <p style="margin: 0; opacity: 0.9;">
                            ${browser.name} ${browser.version} supports all required features for SonicTransfer.
                        </p>
                    </div>
                `;
            } else {
                html += `
                    <div style="background: rgba(244, 67, 54, 0.2); padding: 15px; border-radius: 8px; border-left: 4px solid #f44336;">
                        <h3 style="margin: 0 0 10px 0; color: #f44336;">❌ Browser Not Compatible</h3>
                        <p style="margin: 0 0 10px 0; opacity: 0.9;">
                            ${browser.name} ${browser.version} is missing critical features.
                        </p>
                        <ul style="margin: 10px 0 0 20px;">
                `;

                for (const [key, result] of Object.entries(this.results)) {
                    if (!result.supported && result.critical) {
                        html += `<li><strong>${result.name}</strong>: ${result.description}</li>`;
                    }
                }

                html += `
                        </ul>
                        <p style="margin: 10px 0 0 0; opacity: 0.8;">
                            Please use a modern browser: Chrome 60+, Firefox 55+, Safari 14+, or Edge 79+
                        </p>
                    </div>
                `;
            }

            // Show warnings for non-critical features
            if (results.warnings.length > 0) {
                html += `
                    <div style="background: rgba(255, 235, 59, 0.2); padding: 15px; border-radius: 8px; border-left: 4px solid #ffeb3b; margin-top: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #f9a825;">⚠️ Optional Features Not Available:</h4>
                        <ul style="margin: 0 0 0 20px; opacity: 0.9;">
                `;

                results.warnings.forEach(warning => {
                    html += `<li><strong>${warning.name}</strong>: ${warning.description}</li>`;
                });

                html += `
                        </ul>
                        <p style="margin: 10px 0 0 0; opacity: 0.8; font-size: 0.9rem;">
                            SonicTransfer will work, but some features may be limited.
                        </p>
                    </div>
                `;
            }

            // Detailed feature list
            html += `
                <details style="margin-top: 15px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                    <summary style="cursor: pointer; font-weight: bold;">📋 Detailed Feature Support</summary>
                    <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.2);">
                                <th style="text-align: left; padding: 8px;">Feature</th>
                                <th style="text-align: center; padding: 8px;">Status</th>
                                <th style="text-align: center; padding: 8px;">Critical</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            for (const [key, result] of Object.entries(this.results)) {
                const statusIcon = result.supported ? '✅' : '❌';
                const criticalIcon = result.critical ? '🔴' : '🟡';
                html += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <td style="padding: 8px;">${result.name}</td>
                        <td style="text-align: center; padding: 8px;">${statusIcon}</td>
                        <td style="text-align: center; padding: 8px;">${criticalIcon}</td>
                    </tr>
                `;
            }

            html += `
                        </tbody>
                    </table>
                    <p style="margin: 10px 0 0 0; opacity: 0.7; font-size: 0.85rem;">
                        🔴 = Critical (required), 🟡 = Optional (enhanced features)
                    </p>
                </details>
            `;

            html += '</div>';

            container.innerHTML = html;
            container.style.display = 'block';
        }

        logResults() {
            const results = this.checkAll();
            const browser = this.detectBrowser();

            console.group('🔍 SonicTransfer Browser Compatibility Check');
            console.log(`Browser: ${browser.name} ${browser.version}`);
            console.log(`Compatible: ${results.compatible ? '✅ Yes' : '❌ No'}`);
            console.log(`Warnings: ${results.warnings.length}`);

            console.group('Feature Support:');
            for (const [key, result] of Object.entries(this.results)) {
                const status = result.supported ? '✅' : '❌';
                const critical = result.critical ? '🔴 Critical' : '🟡 Optional';
                console.log(`${status} ${result.name} [${critical}]`);
            }
            console.groupEnd();

            console.groupEnd();

            return results;
        }
    }

    // Auto-run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.sonicTransferCompatCheck = new BrowserCompatChecker();
            window.sonicTransferCompatCheck.logResults();
        });
    } else {
        window.sonicTransferCompatCheck = new BrowserCompatChecker();
        window.sonicTransferCompatCheck.logResults();
    }

    // Export for manual use
    window.BrowserCompatChecker = BrowserCompatChecker;
})();
