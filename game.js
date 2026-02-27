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
        if (this.game) this.game.destroy(true);

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
        const W = scene.scale.width;
        const H = scene.scale.height;
        const cx = H / 2;

        // ---- Textures ----
        this._makeTexture(scene, 'player', (g) => {
            g.fillStyle(0x3b82f6, 1);
            g.fillRoundedRect(0, 0, 36, 36, 8);
            g.lineStyle(2, 0xffffff, 1);
            g.strokeRoundedRect(1, 1, 34, 34, 8);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(10, 12, 4);
            g.fillCircle(26, 12, 4);
        }, 36, 36);

        this._makeTexture(scene, 'obstacle', (g) => {
            g.fillStyle(0xcc2222, 1);
            g.fillRect(0, 0, 56, 600);
            g.lineStyle(1, 0xff6666, 0.6);
            g.strokeRect(0, 0, 56, 600);
        }, 56, 600);

        this._makeTexture(scene, 'enemy', (g) => {
            g.fillStyle(0xff8800, 1);
            g.fillCircle(18, 18, 18);
            g.lineStyle(2, 0xffcc00, 1);
            g.strokeCircle(18, 18, 18);
        }, 36, 36);

        this._makeTexture(scene, 'bullet', (g) => {
            g.fillStyle(0x00ffcc, 1);
            g.fillEllipse(20, 8, 20, 8);
        }, 20, 8);

        // ---- Player ----
        this.player = scene.physics.add.sprite(200, cx, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setSize(30, 30).setOffset(3, 3);
        this.player.setMaxVelocity(800, 900);

        // ---- Groups ----
        this.obstacles = scene.physics.add.group();
        this.enemies = scene.physics.add.group();
        this.bullets = scene.physics.add.group();

        scene.physics.world.OVERLAP_BIAS = 16;

        // ---- Timers ----
        this.spawnTimer = scene.time.addEvent({
            delay: 1600, callback: this._spawnObstacle, callbackScope: this, loop: true
        });
        this.enemyTimer = scene.time.addEvent({
            delay: 2800, callback: this._spawnEnemy, callbackScope: this, loop: true
        });

        // ---- Collisions ----
        // Obstacle kills player
        scene.physics.add.collider(this.player, this.obstacles, this._handleCollision, null, this);
        // Enemy kills player on contact
        scene.physics.add.overlap(this.player, this.enemies, this._handleCollision, null, this);
        // Bullet destroys enemy
        scene.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
            this._hitEnemy(bullet, enemy);
        }, null, this);

        // ---- HUD refs ----
        this.scoreText = document.getElementById('score-display');
        this.fpsText = document.getElementById('fps-display');

        // ---- Ground lines ----
        const lines = scene.add.graphics();
        lines.lineStyle(2, 0x333333, 1);
        lines.lineBetween(0, 0, W, 0);
        lines.lineBetween(0, H - 1, W, H - 1);
    }

    _makeTexture(scene, key, drawFn, w, h) {
        if (scene.textures.exists(key)) return;
        const g = scene.add.graphics();
        drawFn(g);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    _spawnObstacle() {
        if (!this.running) return;
        const scene = this.scene;
        const H = scene.scale.height;
        const W = scene.scale.width;
        const obsH = Phaser.Math.Between(160, Math.min(420, H * 0.55));
        const obsW = 56;
        const isCeiling = Phaser.Math.Between(0, 1) === 0;
        const y = isCeiling ? obsH / 2 : H - obsH / 2;
        const speed = (320 + this.score * 0.9) * (this._speedMultiplier || 1);

        const obs = this.obstacles.create(W + obsW, y, 'obstacle');
        obs.setDisplaySize(obsW, obsH);
        obs.setSize(obsW, obsH).setOffset(0, 0);
        obs.setImmovable(true);
        obs.body.setAllowGravity(false);
        obs.setVelocityX(-speed);
    }

    _spawnEnemy() {
        if (!this.running) return;
        const scene = this.scene;
        const H = scene.scale.height;
        const W = scene.scale.width;
        const y = Phaser.Math.Between(60, H - 60);
        const speed = (240 + this.score * 0.6) * (this._speedMultiplier || 1);

        const enemy = this.enemies.create(W + 40, y, 'enemy');
        enemy.setSize(28, 28).setOffset(4, 4);
        enemy.body.setAllowGravity(false);
        enemy.setVelocityX(-speed);
        // Wobble up/down
        scene.tweens.add({
            targets: enemy,
            y: y + Phaser.Math.Between(-80, 80),
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    shoot() {
        if (!this.running || !this.player?.active) return;
        const scene = this.scene;
        const bullet = this.bullets.create(this.player.x + 20, this.player.y, 'bullet');
        bullet.body.setAllowGravity(false);
        bullet.setVelocityX(900);
        // Auto-destroy when off screen
        scene.time.delayedCall(2000, () => { if (bullet.active) bullet.destroy(); });
    }

    _hitEnemy(bullet, enemy) {
        bullet.destroy();
        // Flash ring effect
        const flash = this.scene.add.graphics();
        flash.lineStyle(3, 0xffcc00, 1);
        flash.strokeCircle(enemy.x, enemy.y, 24);
        this.scene.tweens.add({
            targets: flash, alpha: 0, scale: 1.8, duration: 300,
            onComplete: () => flash.destroy()
        });
        enemy.destroy();
        this.score += 15; // bonus points
    }

    _update(scene, delta) {
        if (!this.running || !this.player?.active) return;

        // Smooth rotation on gravity flip
        const target = this.isGravityFlipped ? Math.PI : 0;
        this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, target, 0.12);

        // Clean up objects that flew off screen
        [this.obstacles, this.enemies, this.bullets].forEach(group => {
            group.getChildren().forEach(obj => {
                if (obj.x < -120 || obj.x > scene.scale.width + 120) obj.destroy();
            });
        });

        // Difficulty ramp
        if (this.spawnTimer.delay > 700) this.spawnTimer.delay = Math.max(700, this.spawnTimer.delay - 0.12);
        if (this.enemyTimer.delay > 1200) this.enemyTimer.delay = Math.max(1200, this.enemyTimer.delay - 0.08);

        this.score += delta * 0.01;
        if (this.scoreText) this.scoreText.innerText = `Score: ${Math.floor(this.score)}`;

        const ear = this.lastEAR ? this.lastEAR.toFixed(3) : '0.000';
        if (this.fpsText) this.fpsText.innerText = `FPS: ${Math.round(scene.game.loop.actualFps)} | EAR: ${ear}`;
    }

    _handleCollision() {
        if (!this.running) return;
        this.running = false;
        this.player.setActive(false).setVisible(false);
        this.spawnTimer.remove();
        this.enemyTimer?.remove();
        [this.obstacles, this.enemies, this.bullets].forEach(g => g.setVelocityX(0));
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

    boostSpeed() {
        if (!this.running || !this.player?.active || this._boosting) return;
        this._boosting = true;
        this._speedMultiplier = 1.6;

        // Visual flash — orange tint
        this.scene.cameras.main.flash(120, 245, 158, 11, 0.18);

        // Apply boost to all live obstacles and enemies
        const applyBoost = (obj) => {
            if (obj.body) obj.setVelocityX(obj.body.velocity.x * 1.6);
        };
        this.obstacles.getChildren().forEach(applyBoost);
        this.enemies.getChildren().forEach(applyBoost);

        // Reset after 2.5s
        this.scene.time.delayedCall(2500, () => {
            this._boosting = false;
            this._speedMultiplier = 1;
        });
    }

    restart() { this.init(); }
}
