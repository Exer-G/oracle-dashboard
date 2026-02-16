// Oracle Time Tracker - Activity Tracker (Electron Desktop)
// Uses uiohook-napi via IPC for global keyboard/mouse tracking
// Tracks activity even when the app is minimized to system tray
// ============================================================

class ActivityTracker {
    constructor() {
        this.isTracking = false;
        this.keyboardCount = 0;
        this.mouseCount = 0;
        this.clickCount = 0;
        this.activeSamples = 0;
        this.totalSamples = 0;
        this._windowKeyboard = 0;
        this._windowMouse = 0;
        this._windowClicks = 0;
        this.sampleInterval = null;
    }

    async start() {
        if (this.isTracking) return;
        this.isTracking = true;
        this.resetBlock();

        // Start global OS-level keyboard/mouse hooks via Electron IPC
        if (window.electronAPI) {
            const result = await window.electronAPI.startActivityTracking();
            if (result) {
                console.log('[Activity] Global OS hooks started');
            } else {
                console.warn('[Activity] Global hooks failed, falling back to DOM events');
                this._startDOMFallback();
            }
        } else {
            // Fallback for non-Electron (shouldn't happen in desktop app)
            this._startDOMFallback();
        }

        // Sample every N seconds (same as web version)
        this.sampleInterval = setInterval(() => this._sample(), TT_CONFIG.activitySampleInterval * 1000);
        console.log('[Activity] Started tracking');
    }

    async stop() {
        this.isTracking = false;

        // Stop global hooks
        if (window.electronAPI) {
            await window.electronAPI.stopActivityTracking();
        } else {
            this._stopDOMFallback();
        }

        if (this.sampleInterval) {
            clearInterval(this.sampleInterval);
            this.sampleInterval = null;
        }
        console.log('[Activity] Stopped tracking');
    }

    resetBlock() {
        this.keyboardCount = 0;
        this.mouseCount = 0;
        this.clickCount = 0;
        this.activeSamples = 0;
        this.totalSamples = 0;
        this._windowKeyboard = 0;
        this._windowMouse = 0;
        this._windowClicks = 0;
    }

    getBlockActivity() {
        // Do a final sample before returning
        this._sampleSync();

        const percent = this.totalSamples > 0
            ? Math.round((this.activeSamples / this.totalSamples) * 100)
            : 0;

        return {
            percent: Math.min(percent, 100),
            keyboard: this.keyboardCount,
            mouse: this.mouseCount,
            clicks: this.clickCount
        };
    }

    getLivePercent() {
        if (this.totalSamples === 0) return 0;
        return Math.min(Math.round((this.activeSamples / this.totalSamples) * 100), 100);
    }

    async _sample() {
        if (!this.isTracking) return;

        // Get counts from main process (global hooks)
        if (window.electronAPI) {
            try {
                const counts = await window.electronAPI.getActivityCounts();
                this._windowKeyboard = counts.keyboard;
                this._windowMouse = counts.mouse;
                this._windowClicks = counts.clicks;

                // Accumulate totals
                this.keyboardCount += counts.keyboard;
                this.mouseCount += counts.mouse;
                this.clickCount += counts.clicks;
            } catch (err) {
                console.error('[Activity] IPC error:', err);
            }
        }

        this.totalSamples++;

        if (this._windowKeyboard > 0 || this._windowMouse > 0 || this._windowClicks > 0) {
            this.activeSamples++;
        }

        // Reset window counters (main process resets on read, but also reset local)
        this._windowKeyboard = 0;
        this._windowMouse = 0;
        this._windowClicks = 0;
    }

    // Synchronous version for getBlockActivity() final sample
    _sampleSync() {
        if (!this.isTracking) return;

        this.totalSamples++;

        if (this._windowKeyboard > 0 || this._windowMouse > 0 || this._windowClicks > 0) {
            this.activeSamples++;
        }

        this._windowKeyboard = 0;
        this._windowMouse = 0;
        this._windowClicks = 0;
    }

    // ---- DOM Fallback (if uiohook fails to load) ----
    _startDOMFallback() {
        this._onKeyDown = () => { this._windowKeyboard++; this.keyboardCount++; };
        this._onMouseMove = () => { this._windowMouse++; this.mouseCount++; };
        this._onClick = () => { this._windowClicks++; this.clickCount++; };

        document.addEventListener('keydown', this._onKeyDown);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('click', this._onClick);
    }

    _stopDOMFallback() {
        if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
        if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove);
        if (this._onClick) document.removeEventListener('click', this._onClick);
    }
}

// Global instance
window.activityTracker = new ActivityTracker();
