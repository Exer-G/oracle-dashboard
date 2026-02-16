// Oracle Time Tracker - Screenshot Capture (Electron Desktop)
// Uses Electron desktopCapturer via IPC for silent screen capture
// ============================================================

class ScreenshotCapture {
    constructor() {
        this.lastScreenshot = null;
        this.lastScreenshotTime = null;
        this.hasPermission = false;
        this.previewInterval = null;
    }

    async requestPermission() {
        // In Electron, desktopCapturer doesn't need user permission
        // It captures silently - no popup needed
        this.hasPermission = true;
        this._updateCaptureStatus(true);
        console.log('[Screenshot] Electron desktop capture ready (no permission needed)');
        return true;
    }

    async captureFrame() {
        if (!this.hasPermission) return null;

        try {
            const quality = parseFloat(document.getElementById('settingsQuality')?.value) || TT_CONFIG.screenshotQuality;
            const base64 = await window.electronAPI.captureScreen(quality);

            if (base64) {
                this.lastScreenshot = base64;
                this.lastScreenshotTime = new Date();
                return base64;
            }

            return null;
        } catch (err) {
            console.error('[Screenshot] Capture error:', err);
            return null;
        }
    }

    getLastScreenshot() {
        return this.lastScreenshot;
    }

    async uploadToStorage(supabaseClient, userId, sessionId, blockNumber) {
        if (!this.lastScreenshot) return null;

        try {
            const filePath = `${userId}/${sessionId}/${blockNumber}.jpg`;

            // Convert base64 to blob
            const response = await fetch(this.lastScreenshot);
            const blob = await response.blob();

            const { data, error } = await supabaseClient.storage
                .from(TT_CONFIG.storageBucket)
                .upload(filePath, blob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) {
                console.error('[Screenshot] Upload error:', error);
                return null;
            }

            // Get public URL
            const { data: urlData } = supabaseClient.storage
                .from(TT_CONFIG.storageBucket)
                .getPublicUrl(filePath);

            return urlData.publicUrl;
        } catch (err) {
            console.error('[Screenshot] Upload error:', err);
            return null;
        }
    }

    startPreviewUpdates(callback) {
        if (this.previewInterval) clearInterval(this.previewInterval);

        this.previewInterval = setInterval(async () => {
            if (this.hasPermission) {
                const frame = await this.captureFrame();
                if (frame && callback) callback(frame);
            }
        }, TT_CONFIG.previewInterval * 1000);
    }

    stopPreviewUpdates() {
        if (this.previewInterval) {
            clearInterval(this.previewInterval);
            this.previewInterval = null;
        }
    }

    revokePermission() {
        this.stopPreviewUpdates();
        // No stream to revoke in Electron - just clear state
        this.hasPermission = false;
        this.lastScreenshot = null;
        this._updateCaptureStatus(false);
        console.log('[Screenshot] Capture stopped');
    }

    _updateCaptureStatus(active) {
        const statusEl = document.getElementById('screenshotStatus');
        const captureStatusEl = document.getElementById('captureStatus');

        if (statusEl) {
            statusEl.textContent = active ? 'Desktop Capture Active' : 'Not Active';
            statusEl.className = 'badge ' + (active ? 'badge-success' : 'badge-neutral');
        }
        if (captureStatusEl) {
            captureStatusEl.textContent = active ? 'Active' : 'Not Active';
            captureStatusEl.className = 'badge ' + (active ? 'badge-success' : 'badge-neutral');
        }
    }
}

// Global instance
window.screenshotCapture = new ScreenshotCapture();
