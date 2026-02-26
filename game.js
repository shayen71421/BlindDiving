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
    }

    init() {
        const config = {
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: this.containerId,
            backgroundColor: '#0a0a0a',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 1500 },
                    debug: false
                }
            },
            scene: {
                preload: this.preload,
                create: this.create,
                update: this.update
            }
        };

        this.game = new Phaser.Game(config);
        this.game.gravityFlip = this;
    }

    preload() { }

    create() {
        const self = this.game.gravityFlip;
        const scene = this; // The Phaser Scene

        self.player = scene.physics.add.sprite(200, scene.cameras.main.centerY, null);
        self.player.setSize(30, 30);
        self.player.setCollideWorldBounds(true);

        self.playerGfx = scene.add.graphics();
        self.obstacleGfx = scene.add.graphics();

        self.obstacles = scene.physics.add.group();

        self.spawnTimer = scene.time.addEvent({
            delay: 1500,
            callback: self.spawnObstacle,
            callbackScope: self,
            loop: true
        });

        scene.physics.add.overlap(self.player, self.obstacles, self.handleCollision, null, self);

        self.scoreText = document.getElementById('score-display');
        self.fpsText = document.getElementById('fps-display');
    }

    update(time, delta) {
        const self = this.game.gravityFlip;
        if (!self.player || !self.player.active) return;

        // Smooth rotation
        const targetRotation = self.isGravityFlipped ? Math.PI : 0;
        self.player.rotation = Phaser.Math.Angle.RotateTo(self.player.rotation, targetRotation, 0.1);

        // Draw Player
        self.playerGfx.clear();
        self.drawPlayer();

        // Score
        self.score += delta * 0.01;
        if (self.scoreText) self.scoreText.innerText = `Score: ${Math.floor(self.score)}`;

        const earVal = self.lastEAR ? self.lastEAR.toFixed(3) : '0.000';
        if (self.fpsText) self.fpsText.innerText = `FPS: ${Math.round(this.game.loop.actualFps)} | EAR: ${earVal}`;

        // Update Obstacles Graphics
        self.obstacleGfx.clear();
        self.obstacles.getChildren().forEach(obstacle => {
            if (obstacle.x < -100) {
                obstacle.destroy();
            } else {
                self.obstacleGfx.fillStyle(0xef4444, 1);
                self.obstacleGfx.fillRoundedRect(
                    obstacle.x - obstacle.displayWidth / 2,
                    obstacle.y - obstacle.displayHeight / 2,
                    obstacle.displayWidth,
                    obstacle.displayHeight,
                    4
                );
            }
        });

        // Difficulty
        if (self.spawnTimer.delay > 600) {
            self.spawnTimer.delay -= 0.1;
        }
    }

    drawPlayer() {
        const { x, y, rotation } = this.player;
        this.playerGfx.save();
        this.playerGfx.translateCanvas(x, y);
        this.playerGfx.rotateCanvas(rotation);

        this.playerGfx.fillStyle(0x3b82f6, 1);
        this.playerGfx.fillRoundedRect(-20, -20, 40, 40, 8);
        this.playerGfx.lineStyle(2, 0xffffff, 1);
        this.playerGfx.strokeRoundedRect(-20, -20, 40, 40, 8);

        // Eyes
        this.playerGfx.fillStyle(0xffffff, 1);
        this.playerGfx.fillCircle(-8, -8, 4);
        this.playerGfx.fillCircle(8, -8, 4);

        this.playerGfx.restore();
    }

    spawnObstacle() {
        const scene = this.game.scene.scenes[0];
        const x = scene.scale.width + 100;
        const height = Phaser.Math.Between(150, 400);
        const isCeiling = Phaser.Math.Between(0, 1) === 0;
        const y = isCeiling ? height / 2 : scene.scale.height - height / 2;

        const obstacle = this.obstacles.create(x, y, null);
        obstacle.setSize(40, height - 40); // Forgiving hitbox
        obstacle.setDisplaySize(60, height);
        obstacle.setImmovable(true);
        obstacle.body.setAllowGravity(false);
        obstacle.setVelocityX(-350 - (this.score * 1.0));
    }

    flipGravity() {
        const currentTime = Date.now();
        if (!this.game || !this.player || !this.player.active || (currentTime - this.lastFlipTime < 300)) return;

        this.lastFlipTime = currentTime;
        this.isGravityFlipped = !this.isGravityFlipped;
        const scene = this.game.scene.scenes[0];
        scene.physics.world.gravity.y = this.isGravityFlipped ? -2000 : 2000;

        scene.cameras.main.shake(100, 0.005);
        scene.cameras.main.flash(50, 59, 130, 246, 0.2);
    }

    handleCollision() {
        this.player.setActive(false).setVisible(false);
        this.spawnTimer.remove();
        this.obstacles.setVelocityX(0);
        if (this.onGameOver) this.onGameOver(Math.floor(this.score));
    }

    restart() {
        this.score = 0;
        this.isGravityFlipped = false;
        const scene = this.game.scene.scenes[0];
        scene.scene.restart();
    }
}
