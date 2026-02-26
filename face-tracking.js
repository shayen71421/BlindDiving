import { FaceMesh } from '@mediapipe/face_mesh';

export class FaceTracker {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.faceMesh = null;
        this.results = null;
        this.showLandmarks = true;

        // Eye landmark indices (MediaPipe FaceMesh)
        this.LEFT_EYE = [362, 385, 387, 263, 373, 380];
        this.RIGHT_EYE = [33, 160, 158, 133, 153, 144];

        // Eye state
        this.blinkThreshold = 0.25;
        this.isBlinking = false;
        this.onBlink = null;
        this.lastEAR = 0;
    }

    async init() {
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => {
            this.results = results;
            this.detectBlink();
            if (this.showLandmarks) {
                this.drawLandmarks();
            }
        });

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
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

    // Eye Aspect Ratio (EAR) calculation
    getEAR(landmarks, eyeIndices) {
        const p1 = landmarks[eyeIndices[0]];
        const p2 = landmarks[eyeIndices[1]];
        const p3 = landmarks[eyeIndices[2]];
        const p4 = landmarks[eyeIndices[3]];
        const p5 = landmarks[eyeIndices[4]];
        const p6 = landmarks[eyeIndices[5]];

        // Linear distances
        const dist = (p, q) => Math.sqrt(Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2));

        const vertical1 = dist(p2, p6);
        const vertical2 = dist(p3, p5);
        const horizontal = dist(p1, p4);

        return (vertical1 + vertical2) / (2.0 * horizontal);
    }

    detectBlink() {
        if (!this.results || !this.results.multiFaceLandmarks || this.results.multiFaceLandmarks.length === 0) return;

        const landmarks = this.results.multiFaceLandmarks[0];
        const leftEAR = this.getEAR(landmarks, this.LEFT_EYE);
        const rightEAR = this.getEAR(landmarks, this.RIGHT_EYE);
        const avgEAR = (leftEAR + rightEAR) / 2;
        this.lastEAR = avgEAR;

        if (avgEAR < this.blinkThreshold) {
            if (!this.isBlinking) {
                this.isBlinking = true;
                if (this.onBlink) this.onBlink();
            }
        } else {
            this.isBlinking = false;
        }
    }

    drawLandmarks() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.results || !this.results.multiFaceLandmarks) return;

        for (const landmarks of this.results.multiFaceLandmarks) {
            this.ctx.fillStyle = '#00ff00';
            // Draw eyes only for performance and clarity
            [...this.LEFT_EYE, ...this.RIGHT_EYE].forEach(idx => {
                const p = landmarks[idx];
                this.ctx.beginPath();
                this.ctx.arc(p.x * this.canvas.width, p.y * this.canvas.height, 2, 0, 2 * Math.PI);
                this.ctx.fill();
            });
        }
    }

    setThreshold(val) {
        this.blinkThreshold = val;
    }

    setShowLandmarks(val) {
        this.showLandmarks = val;
        if (!val) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
