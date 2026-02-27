import Phaser from 'phaser';

export class GravityGame {
    constructor(containerId, onGameOver) {
        this.containerId = containerId;
        this.onGameOver = onGameOver;
        this.game = null;
        this.score = 0;
        this.isGravityFlipped = false;
        this.lastEAR = 0;
        this.lastFlipTime = 0;
        this.running = false;
    }

    init() {
        if (this.game) {
            this.game.destroy(true);
        }

        this.score = 0;
        this.isGravityFlipped = false;
        this.lastFlipTime = 0;
        this.running = false;

        const self = this;

        const config = {
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: this.containerId,
            backgroundColor: '#0d0d0d',
            physics: {
                default: 'arcade',
                arcade: { gravity: { y: 1800 }, debug: false }
            },
            scene: {
                create() { self._create(this); },
                update(time, delta) { self._update(this, delta); }
            }
        };

        this.game = new Phaser.Game(config);
    }

    _create(scene) {
        this.scene = scene;
        this.running = true;

        const cx = scene.cameras.main.centerY;
        const W = scene.scale.width;
        const H = scene.scale.height;

        // --- Player: use a filled rectangle game object as the physics sprite ---
        // Draw it as a texture so physics + visual are the same rect
        const pGfx = scene.add.graphics();
        pGfx.fillStyle(0x3b82f6, 1);
        pGfx.fillRoundedRect(0, 0, 36, 36, 8);
        pGfx.lineStyle(2, 0xffffff, 1);
        pGfx.strokeRoundedRect(1, 1, 34, 34, 8);
        pGfx.fillStyle(0xffffff, 1);
        pGfx.fillCircle(10, 12, 4);
        pGfx.fillCircle(26, 12, 4);
        pGfx.generateTexture('player', 36, 36);
        pGfx.destroy();

        this.player = scene.physics.add.sprite(200, cx, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setSize(28, 28);       // hitbox a touch smaller than sprite
        this.player.setOffset(4, 4);

        // --- Obstacle group ---
        this.obstacles = scene.physics.add.group();

        // --- Spawn timer ---
        this.spawnTimer = scene.time.addEvent({
            delay: 1600,
            callback: this._spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // --- Collision ---
        scene.physics.add.overlap(
            this.player,
            this.obstacles,
            this._handleCollision,
            null,
            this
        );

        // --- UI refs ---
        this.scoreText = document.getElementById('score-display');
        this.fpsText = document.getElementById('fps-display');

        // --- Ground/ceiling visual lines ---
        const lines = scene.add.graphics();
        lines.lineStyle(2, 0x444444, 1);
        lines.lineBetween(0, 0, W, 0);
        lines.lineBetween(0, H - 1, W, H - 1);
    }

    _spawnObstacle() {
        if (!this.running) return;
        const scene = this.scene;
        const H = scene.scale.height;
        const W = scene.scale.width;

        const obsH = Phaser.Math.Between(160, Math.min(420, H * 0.55));
        const isCeiling = Phaser.Math.Between(0, 1) === 0;
        const obsW = 56;

        // y is center of the rectangle
        const y = isCeiling ? obsH / 2 : H - obsH / 2;
        const x = W + obsW;

        // Speed based on score
        const speed = 320 + this.score * 0.9;

        // Create obstacle as a physics-enabled image with a generated texture
        const key = isCeiling ? 'obs_ceil' : 'obs_floor';

        // Generate texture once per type
        if (!scene.textures.exists(key)) {
            const g = scene.add.graphics();
            g.fillStyle(0xcc2222, 1);
            g.fillRoundedRect(0, 0, obsW, 600, 4);    // tall enough for any height
            g.lineStyle(1, 0xff6666, 0.5);
            g.strokeRoundedRect(0, 0, obsW, 600, 4);
            g.generateTexture(key, obsW, 600);
            g.destroy();
        }

        const obs = this.obstacles.create(x, y, key);
        obs.setDisplaySize(obsW, obsH);
        obs.setSize(obsW - 16, obsH - 16);        // inner hitbox is smaller
        obs.setOffset(8, 8);
        obs.setImmovable(true);
        obs.body.setAllowGravity(false);
        obs.setVelocityX(-speed);
    }

    _update(scene, delta) {
        if (!this.running || !this.player || !this.player.active) return;

        // Smooth player rotation
        const target = this.isGravityFlipped ? Math.PI : 0;
        this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, target, 0.12);

        // Clean up off-screen obstacles
        this.obstacles.getChildren().forEach(obs => {
            if (obs.x < -100) obs.destroy();
        });

        // Score
        this.score += delta * 0.01;
        if (this.scoreText) this.scoreText.innerText = `Score: ${Math.floor(this.score)}`;

        const ear = this.lastEAR ? this.lastEAR.toFixed(3) : '0.000';
        if (this.fpsText) {
            this.fpsText.innerText = `FPS: ${Math.round(scene.game.loop.actualFps)} | EAR: ${ear}`;
        }

        // Ramp difficulty: tighten spawn interval
        if (this.spawnTimer && this.spawnTimer.delay > 700) {
            this.spawnTimer.delay = Math.max(700, this.spawnTimer.delay - 0.15);
        }
    }

    _handleCollision() {
        if (!this.running) return;
        this.running = false;
        this.player.setActive(false).setVisible(false);
        this.spawnTimer.remove();
        this.obstacles.setVelocityX(0);
        if (this.onGameOver) this.onGameOver(Math.floor(this.score));
    }

    flipGravity() {
        const now = Date.now();
        if (!this.running || !this.player?.active || now - this.lastFlipTime < 350) return;

        this.lastFlipTime = now;
        this.isGravityFlipped = !this.isGravityFlipped;

        const grav = this.isGravityFlipped ? -2000 : 2000;
        this.scene.physics.world.gravity.y = grav;

        this.scene.cameras.main.shake(80, 0.004);
        this.scene.cameras.main.flash(60, 59, 130, 246, 0.15);
    }

    restart() {
        this.init();
    }
}
