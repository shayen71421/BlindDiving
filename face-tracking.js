import { FaceMesh } from '@mediapipe/face_mesh';

export class FaceTracker {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.faceMesh = null;
        this.showLandmarks = true;

        // Eye landmark indices (MediaPipe FaceMesh)
        this.LEFT_EYE = [362, 385, 387, 263, 373, 380];
        this.RIGHT_EYE = [33, 160, 158, 133, 153, 144];

        // Thresholds & state
        this.blinkThreshold = 0.25;
        this.winkDiff = 0.06;       // how much one eye must be *lower* than the other to count as a wink

        this.isBothBlinking = false;
        this.isLeftWinking = false;
        this.isRightWinking = false;

        this.lastEAR = 0;
        this.lastLeftEAR = 0;
        this.lastRightEAR = 0;

        // Callbacks
        this.onBlink = null;   // both eyes closed → gravity flip
        this.onRightWink = null;   // right eye wink → shoot
        this.onLeftWink = null;   // left eye wink (reserved)
    }

    async init() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => {
            this.results = results;
            this.detectBlinks();
            if (this.showLandmarks) this.drawLandmarks();
        });

        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        this.video.srcObject = stream;

        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
                this.runDetection();
                resolve();
            };
        });
    }

    async runDetection() {
        if (this.video.paused || this.video.ended) return;
        await this.faceMesh.send({ image: this.video });
        requestAnimationFrame(() => this.runDetection());
    }

    getEAR(landmarks, eyeIndices) {
        const p = eyeIndices.map(i => landmarks[i]);
        const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        return (dist(p[1], p[5]) + dist(p[2], p[4])) / (2 * dist(p[0], p[3]));
    }

    detectBlinks() {
        if (!this.results?.multiFaceLandmarks?.length) return;
        const lm = this.results.multiFaceLandmarks[0];

        const leftEAR = this.getEAR(lm, this.LEFT_EYE);
        const rightEAR = this.getEAR(lm, this.RIGHT_EYE);
        const avgEAR = (leftEAR + rightEAR) / 2;

        this.lastLeftEAR = leftEAR;
        this.lastRightEAR = rightEAR;
        this.lastEAR = avgEAR;

        const T = this.blinkThreshold;

        const leftClosed = leftEAR < T;
        const rightClosed = rightEAR < T;

        // --- Both eyes closed (blink) ---
        if (leftClosed && rightClosed) {
            if (!this.isBothBlinking) {
                this.isBothBlinking = true;
                this.onBlink?.();
            }
        } else {
            this.isBothBlinking = false;
        }

        // --- Right wink: right eye closed, left eye clearly open ---
        const rightWink = rightClosed && leftEAR > T + this.winkDiff;
        if (rightWink) {
            if (!this.isRightWinking) {
                this.isRightWinking = true;
                this.onRightWink?.();
            }
        } else {
            this.isRightWinking = false;
        }

        // --- Left wink: left eye closed, right eye clearly open ---
        const leftWink = leftClosed && rightEAR > T + this.winkDiff;
        if (leftWink) {
            if (!this.isLeftWinking) {
                this.isLeftWinking = true;
                this.onLeftWink?.();
            }
        } else {
            this.isLeftWinking = false;
        }
    }

    drawLandmarks() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.results?.multiFaceLandmarks) return;
        for (const lm of this.results.multiFaceLandmarks) {
            const W = this.canvas.width;
            const H = this.canvas.height;

            // Left eye - green
            this.ctx.fillStyle = this.isLeftWinking ? '#ff0' : '#00ff00';
            this.LEFT_EYE.forEach(i => {
                this.ctx.beginPath();
                this.ctx.arc(lm[i].x * W, lm[i].y * H, 2.5, 0, 2 * Math.PI);
                this.ctx.fill();
            });

            // Right eye - cyan (lights up on wink)
            this.ctx.fillStyle = this.isRightWinking ? '#ff0' : '#00ffff';
            this.RIGHT_EYE.forEach(i => {
                this.ctx.beginPath();
                this.ctx.arc(lm[i].x * W, lm[i].y * H, 2.5, 0, 2 * Math.PI);
                this.ctx.fill();
            });
        }
    }

    setThreshold(val) { this.blinkThreshold = parseFloat(val); }
    setShowLandmarks(val) {
        this.showLandmarks = val;
        if (!val) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
