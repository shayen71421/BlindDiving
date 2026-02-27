import './style.css';
import { FaceTracker } from './face-tracking.js';
import { GravityGame } from './game.js';

const webcam = document.getElementById('webcam');
const landmarks = document.getElementById('landmark-overlay');
const calibrationMenu = document.getElementById('calibration-menu');
const instructionMenu = document.getElementById('instructions-menu');
const startCalibrationBtn = document.getElementById('start-calibration');
const startGameBtn = document.getElementById('start-game');
const gameOverMenu = document.getElementById('game-over-menu');
const restartBtn = document.getElementById('restart-game');
const sensitivitySlider = document.getElementById('sensitivity-slider');
const landmarkToggle = document.getElementById('toggle-landmarks');
const progressLine = document.getElementById('calibration-progress');
const statusText = document.getElementById('calibration-status');

let faceTracker;
let game;
let calibrationSteps = 0;
const MAX_CALIBRATION_STEPS = 5;

async function init() {
    faceTracker = new FaceTracker(webcam, landmarks);

    try {
        await faceTracker.init();
        statusText.innerText = "Camera ready. Click start and blink 5 times.";
        startCalibrationBtn.innerText = "Start Calibration";
        startCalibrationBtn.disabled = false;
    } catch (err) {
        statusText.innerText = "Error: Camera access denied.";
        console.error(err);
    }

    game = new GravityGame('game-container', (finalScore) => {
        document.getElementById('final-score').innerText = finalScore;
        gameOverMenu.classList.remove('hidden');
    });

    setupListeners();
}

function setupListeners() {
    startCalibrationBtn.onclick = () => {
        startCalibrationBtn.disabled = true;
        statusText.innerText = "Blink now!";
        let minEARDuringBlink = 1.0;

        // Sample EAR during calibration to find the best threshold
        const calibrationInterval = setInterval(() => {
            if (faceTracker.lastEAR > 0 && faceTracker.lastEAR < minEARDuringBlink) {
                minEARDuringBlink = faceTracker.lastEAR;
            }
        }, 50);

        faceTracker.onBlink = () => {
            calibrationSteps++;
            const progress = (calibrationSteps / MAX_CALIBRATION_STEPS) * 100;
            progressLine.style.width = `${progress}%`;

            if (calibrationSteps >= MAX_CALIBRATION_STEPS) {
                clearInterval(calibrationInterval);
                finishCalibration(minEARDuringBlink);
            }
        };
    };

    startGameBtn.onclick = () => {
        instructionMenu.classList.add('hidden');
        game.init();

        faceTracker.onBlink = () => {
            game.flipGravity();
        };

        faceTracker.onRightWink = () => {
            game.shoot();
        };
    };

    restartBtn.onclick = () => {
        gameOverMenu.classList.add('hidden');
        game.restart();
    };

    sensitivitySlider.oninput = (e) => {
        faceTracker.setThreshold(parseFloat(e.target.value));
    };

    landmarkToggle.onchange = (e) => {
        faceTracker.setShowLandmarks(e.target.checked);
    };

    // Update UI/Game state
    setInterval(() => {
        if (faceTracker && faceTracker.lastEAR) {
            const earVal = faceTracker.lastEAR.toFixed(3);
            if (game && game.game && game.player && game.player.active) {
                game.lastEAR = faceTracker.lastEAR;
            } else {
                const fpsDisp = document.getElementById('fps-display');
                if (fpsDisp) fpsDisp.innerText = `FPS: 0 | EAR: ${earVal}`;
            }
        }
    }, 100);
}

function finishCalibration(minEAR) {
    // Set threshold slightly above the minimum detected EAR during blink
    // Default is 0.25, if user's blink is 0.15, we set it to ~0.20
    const newThreshold = Math.min(0.35, minEAR + 0.05);
    faceTracker.setThreshold(newThreshold);
    sensitivitySlider.value = newThreshold;

    calibrationMenu.classList.add('hidden');
    instructionMenu.classList.remove('hidden');
}

init();
