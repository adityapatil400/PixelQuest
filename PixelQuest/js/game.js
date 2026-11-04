/**
 * PixelQuest - Game Engine Module
 * Core game loop, finite state machine, camera tracking, parallax menu animation,
 * responsive canvas scaling, and input dispatching.
 */

(function (window) {
  'use strict';

  window.PixelQuest = window.PixelQuest || {};

  const GameState = Object.freeze({
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE'
  });

  class Game {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      this.ctx = this.canvas.getContext('2d');

      // Virtual arcade resolution (16:9)
      this.virtualWidth = 800;
      this.virtualHeight = 450;

      // State machine
      this.state = GameState.MENU;

      // Game Entities & Systems
      this.player = null;
      this.currentLevel = null;
      this.currentLevelIndex = 0;
      this.enemyManager = new window.PixelQuest.EnemyManager();

      // Camera
      this.camera = {
        x: 0,
        y: 0,
        width: this.virtualWidth,
        height: this.virtualHeight
      };

      // Input Tracking
      this.keys = {};
      this.touchState = {
        left: false,
        right: false,
        jump: false
      };
      this.inputState = {
        left: false,
        right: false,
        jump: false,
        jumpPressed: false,
        down: false
      };

      // Game Loop Metrics
      this.lastTime = 0;
      this.fps = 60;
      this.frameCount = 0;
      this.fpsTimer = 0;

      // Screen Shake
      this.shakeDuration = 0;
      this.shakeIntensity = 0;

      // Menu Screen Ambient Particles & Animation
      this.menuTime = 0;
      this.menuParticles = this.createMenuParticles(36);
      this.menuTorchEmbers = this.createTorchEmbers(18);

      // In-Game Forest Ambient Wind Leaves & Lava Embers
      this.gameplayTime = 0;
      this.ambientLeaves = this.createAmbientLeaves(22);
      this.ambientEmbers = this.createAmbientEmbers(24);
      this.ambientMotes = this.createAmbientMotes(22);
      this.lastLevelStats = null;
      this.portalLockMessageCooldown = 0;

      // Event Listeners
      this.bindInputEvents();
      this.setupResponsiveCanvas();
    }

    /**
     * Initialize canvas size and window resize scaling
     */
    setupResponsiveCanvas() {
      this.canvas.width = this.virtualWidth;
      this.canvas.height = this.virtualHeight;

      const resizeHandler = () => {
        // Enforce pixelated crisp rendering on all browsers
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
      };

      window.addEventListener('resize', resizeHandler);
      resizeHandler();

      // Ensure crisp pixel scaling when entering/exiting fullscreen
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        fsEvents.forEach(evt => {
          document.addEventListener(evt, () => {
            this.onFullscreenChange();
          });
        });
      }

      // Prevent default gestures (scrolling, zooming, pull-to-refresh) on game canvas during gameplay
      const preventCanvasTouch = (e) => {
        if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      };

      this.canvas.addEventListener('touchstart', preventCanvasTouch, { passive: false });
      this.canvas.addEventListener('touchmove', preventCanvasTouch, { passive: false });
      this.canvas.addEventListener('touchend', preventCanvasTouch, { passive: false });
      this.canvas.addEventListener('touchcancel', preventCanvasTouch, { passive: false });
    }

    /**
     * Handle fullscreen transition: recalculate/ensure crisp rendering
     */
    onFullscreenChange() {
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
      }
    }

    /**
     * Bind keyboard listeners
     */
    bindInputEvents() {
      window.addEventListener('keydown', (e) => {
        // Prevent default browser page scrolling on game controls
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }

        // Pause Game shortcut with Escape (or exit pseudo-fullscreen)
        if (e.code === 'Escape') {
          if (typeof document !== 'undefined' && document.body && document.body.classList.contains('is-pseudo-fullscreen')) {
            if (window.PixelQuest.UI && typeof window.PixelQuest.UI.exitFullscreen === 'function') {
              window.PixelQuest.UI.exitFullscreen();
              return;
            }
          }

          if (this.state === GameState.PLAYING) {
            this.pauseGame();
            return;
          } else if (this.state === GameState.PAUSED) {
            this.resumeGame();
            return;
          }
        }

        if (!this.keys[e.code]) {
          if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            this.inputState.jumpPressed = true;
          }
        }
        this.keys[e.code] = true;
        this.syncInput();

        // Start game from menu with Space / Enter
        if (this.state === GameState.MENU && (e.code === 'Space' || e.code === 'Enter')) {
          this.startNewGame();
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
        this.syncInput();
      });
    }

    /**
     * Update touch control state independently from keyboard
     * @param {'left'|'right'|'jump'} control
     * @param {boolean} active
     */
    setTouchInput(control, active) {
      if (!this.touchState) {
        this.touchState = { left: false, right: false, jump: false };
      }
      this.touchState[control] = !!active;
      if (control === 'jump' && active) {
        this.inputState.jumpPressed = true;
      }
      this.syncInput();
    }

    /**
     * Map active keys and touch state to standardized inputState
     */
    syncInput() {
      const touchLeft = this.touchState ? this.touchState.left : false;
      const touchRight = this.touchState ? this.touchState.right : false;
      const touchJump = this.touchState ? this.touchState.jump : false;

      this.inputState.left = !!(this.keys['ArrowLeft'] || this.keys['KeyA'] || touchLeft);
      this.inputState.right = !!(this.keys['ArrowRight'] || this.keys['KeyD'] || touchRight);
      this.inputState.jump = !!(this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW'] || touchJump);
      this.inputState.down = !!(this.keys['ArrowDown'] || this.keys['KeyS']);
    }

    /**
     * Create floating decorative particles for start screen
     */
    createMenuParticles(count) {
      const particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * this.virtualWidth,
          y: Math.random() * this.virtualHeight,
          size: Math.random() < 0.6 ? 2 : 3,
          speedX: (Math.random() - 0.5) * 0.4,
          speedY: -0.2 - Math.random() * 0.5,
          alpha: 0.3 + Math.random() * 0.7,
          color: Math.random() < 0.5 ? '#f1c40f' : '#00d2d3'
        });
      }
      return particles;
    }

    /**
     * Create torch ember particles for start screen cliff
     */
    createTorchEmbers(count) {
      const embers = [];
      for (let i = 0; i < count; i++) {
        embers.push({
          x: 236 + (Math.random() - 0.5) * 6,
          y: 290 - Math.random() * 20,
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: -0.8 - Math.random() * 1.2,
          life: Math.random(),
          size: 2
        });
      }
      return embers;
    }

    /**
     * Create ambient drifting leaves for in-game forest atmosphere
     */
    createAmbientLeaves(count) {
      const leaves = [];
      for (let i = 0; i < count; i++) {
        leaves.push({
          x: Math.random() * 800,
          y: Math.random() * 450,
          speedX: 25 + Math.random() * 35,
          speedY: 18 + Math.random() * 22,
          oscSpeed: 2 + Math.random() * 3,
          size: Math.random() < 0.5 ? 3 : 4,
          color: Math.random() < 0.5 ? '#2ecc71' : '#f1c40f'
        });
      }
      return leaves;
    }

    /**
     * Create floating glowing ember sparks for Lava Caves
     */
    createAmbientEmbers(count) {
      const embers = [];
      for (let i = 0; i < count; i++) {
        embers.push({
          x: Math.random() * 800,
          y: Math.random() * 450,
          speedX: (Math.random() - 0.5) * 30,
          speedY: -25 - Math.random() * 35,
          size: Math.random() < 0.6 ? 2 : 3,
          color: Math.random() < 0.5 ? '#f39c12' : '#e74c3c'
        });
      }
      return embers;
    }

    /**
     * Create floating mystic magical particles for Dark Castle
     */
    createAmbientMotes(count) {
      const motes = [];
      for (let i = 0; i < count; i++) {
        motes.push({
          x: Math.random() * 800,
          y: Math.random() * 450,
          speedX: (Math.random() - 0.5) * 20,
          speedY: (Math.random() - 0.5) * 15,
          size: Math.random() < 0.5 ? 2 : 3,
          color: Math.random() < 0.5 ? '#9b59b6' : '#00d2d3'
        });
      }
      return motes;
    }

    /**
     * Trigger screen shake effect
     * @param {number} duration - seconds
     * @param {number} intensity - pixels
     */
    triggerShake(duration = 0.25, intensity = 4) {
      const storage = window.PixelQuest.Storage;
      if (storage && !storage.getSettings().screenShake) return;

      this.shakeDuration = duration;
      this.shakeIntensity = intensity;
    }

    /**
     * Transition finite state machine
     * @param {string} newState
     */
    setState(newState) {
      this.state = newState;
      if (window.PixelQuest.UI) {
        window.PixelQuest.UI.showScreen(newState);

        // Synchronize procedural background music
        const audio = window.PixelQuest.UI.audio;
        if (audio) {
          if (newState === GameState.PLAYING) {
            const theme = (this.currentLevel && this.currentLevel.theme) || 'forest';
            audio.startMusic(theme);
          } else if (newState === GameState.PAUSED) {
            audio.pauseMusic();
          } else if (newState === GameState.MENU) {
            audio.startMusic('menu');
          } else if (newState === GameState.GAME_OVER) {
            audio.stopMusic();
          } else if (newState === GameState.LEVEL_COMPLETE) {
            audio.pauseMusic();
          }
        }
      }
    }

    /**
     * Start fresh new playthrough or jump to specific unlocked level
     * @param {number} levelIndex (0-based)
     */
    startNewGame(levelIndex = 0) {
      this.currentLevelIndex = levelIndex;
      this.currentLevel = new window.PixelQuest.Level(this.currentLevelIndex);
      this.player = new window.PixelQuest.Player(
        this.currentLevel.playerSpawn.x,
        this.currentLevel.playerSpawn.y
      );
      this.enemyManager.loadFromLevel(this.currentLevel);

      this.camera.x = 0;
      this.camera.y = 0;

      this.setState(GameState.PLAYING);
    }

    /**
     * Launch directly into a chosen unlocked level
     * @param {number} levelIndex
     */
    startLevel(levelIndex) {
      const storage = window.PixelQuest.Storage;
      const maxUnlocked = storage ? storage.getUnlockedLevel() : 1;
      if (levelIndex + 1 > maxUnlocked) {
        console.warn('Level locked!');
        return false;
      }
      this.startNewGame(levelIndex);
      return true;
    }

    /**
     * Pause game
     */
    pauseGame() {
      if (this.state === GameState.PLAYING) {
        this.setState(GameState.PAUSED);
      }
    }

    /**
     * Resume game
     */
    resumeGame() {
      if (this.state === GameState.PAUSED) {
        this.setState(GameState.PLAYING);
      }
    }

    /**
     * Restart current level
     */
    restartLevel() {
      if (!this.currentLevel) {
        this.startNewGame();
        return;
      }
      this.currentLevel = new window.PixelQuest.Level(this.currentLevelIndex);
      this.player.reset(this.currentLevel.playerSpawn.x, this.currentLevel.playerSpawn.y);
      this.enemyManager.loadFromLevel(this.currentLevel);
      this.setState(GameState.PLAYING);
    }

    /**
     * Return to Main Menu
     */
    goToMenu() {
      this.setState(GameState.MENU);
    }

    /**
     * Advance to next level or trigger victory
     */
    nextLevel() {
      this.currentLevelIndex++;
      if (this.currentLevelIndex >= (window.PixelQuest.LEVEL_DATA ? window.PixelQuest.LEVEL_DATA.length : 3)) {
        // Complete campaign victory! Return to menu
        this.goToMenu();
        return;
      }

      const prevScore = this.player ? this.player.score : 0;
      const prevCoins = this.player ? this.player.coins : 0;

      this.currentLevel = new window.PixelQuest.Level(this.currentLevelIndex);
      if (!this.player) {
        this.player = new window.PixelQuest.Player(this.currentLevel.playerSpawn.x, this.currentLevel.playerSpawn.y);
      } else {
        this.player.reset(this.currentLevel.playerSpawn.x, this.currentLevel.playerSpawn.y);
        this.player.score = prevScore;
        this.player.coins = prevCoins;
      }

      this.enemyManager.loadFromLevel(this.currentLevel);
      this.camera.x = 0;
      this.camera.y = 0;
      this.setState(GameState.PLAYING);
    }

    /**
     * Main animation loop entrypoint
     */
    start() {
      this.lastTime = performance.now();
      const loop = (currentTime) => {
        let dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Clamp dt to prevent physics tunneling
        if (dt > 0.1) dt = 0.1;

        // FPS calculation
        this.frameCount++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 0.5) {
          this.fps = this.frameCount / this.fpsTimer;
          this.frameCount = 0;
          this.fpsTimer = 0;
        }

        this.update(dt);
        this.render();

        // Reset single-frame jump triggers
        this.inputState.jumpPressed = false;

        requestAnimationFrame(loop);
      };

      requestAnimationFrame(loop);
    }

    /**
     * Engine Update
     */
    update(dt) {
      if (this.shakeDuration > 0) {
        this.shakeDuration -= dt;
      }

      if (this.state === GameState.MENU) {
        this.updateMenuAnimation(dt);
      } else if (this.state === GameState.PLAYING) {
        this.updateGameplay(dt);
      }
    }

    /**
     * Update menu ambient effects
     */
    updateMenuAnimation(dt) {
      this.menuTime += dt;

      // Update background floating particles
      for (let p of this.menuParticles) {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.y < 0) {
          p.y = this.virtualHeight;
          p.x = Math.random() * this.virtualWidth;
        }
      }

      // Update torch embers
      for (let e of this.menuTorchEmbers) {
        e.y += e.speedY;
        e.x += e.speedX;
        e.life += dt * 1.5;
        if (e.life > 1.0) {
          e.life = 0;
          e.x = 236 + (Math.random() - 0.5) * 6;
          e.y = 290;
        }
      }
    }

    /**
     * Update gameplay physics, entities, camera, win/lose conditions
     */
    updateGameplay(dt) {
      if (!this.player || !this.currentLevel) return;

      this.gameplayTime += dt;

      // Update level (moving platforms, disappearing platforms, traps, obstacles, particles)
      this.currentLevel.update(dt, this.player);

      // Update player with frame-rate independent dt
      this.player.handleInput(this.inputState, dt);
      this.player.update(dt, this.currentLevel);

      // Update enemies
      this.enemyManager.update(dt, this.currentLevel, this.player);

      // Update ambient particles based on level theme
      if (this.currentLevel.theme === 'lava') {
        for (let ember of this.ambientEmbers) {
          ember.x += ember.speedX * dt;
          ember.y += ember.speedY * dt;
          if (ember.y < -10 || ember.x < -10 || ember.x > this.virtualWidth + 10) {
            ember.y = this.virtualHeight + 10;
            ember.x = Math.random() * this.virtualWidth;
          }
        }
      } else if (this.currentLevel.theme === 'castle') {
        for (let mote of this.ambientMotes) {
          mote.x += (mote.speedX + Math.sin(this.gameplayTime * 2 + mote.y) * 12) * dt;
          mote.y += mote.speedY * dt;
          if (mote.x > this.virtualWidth + 10) mote.x = -10;
          if (mote.x < -10) mote.x = this.virtualWidth + 10;
          if (mote.y < -10) mote.y = this.virtualHeight + 10;
          if (mote.y > this.virtualHeight + 10) mote.y = -10;
        }
      } else {
        // Forest leaves
        for (let leaf of this.ambientLeaves) {
          leaf.x += (leaf.speedX + Math.sin(this.gameplayTime * leaf.oscSpeed) * 16) * dt;
          leaf.y += leaf.speedY * dt;
          if (leaf.x > this.virtualWidth + 20 || leaf.y > this.virtualHeight + 20) {
            leaf.x = -10;
            leaf.y = Math.random() * (this.virtualHeight * 0.7);
          }
        }
      }

      // Camera smooth follow with subtle look-ahead based on facing direction
      const lookAhead = (this.player.facing === 'right' ? 35 : -35);
      const targetCamX = this.player.x + this.player.width / 2 - this.virtualWidth / 2 + lookAhead;
      const targetCamY = this.player.y + this.player.height / 2 - this.virtualHeight / 2 - 15;

      const levelPixelWidth = this.currentLevel.width * this.currentLevel.tileSize;
      const levelPixelHeight = this.currentLevel.height * this.currentLevel.tileSize;

      // Smooth lerp camera tracking
      this.camera.x += (targetCamX - this.camera.x) * 0.08;
      this.camera.y += (targetCamY - this.camera.y) * 0.08;

      // Clamp camera strictly within map world boundaries
      this.camera.x = Math.max(0, Math.min(this.camera.x, Math.max(0, levelPixelWidth - this.virtualWidth)));
      this.camera.y = Math.max(0, Math.min(this.camera.y, Math.max(0, levelPixelHeight - this.virtualHeight)));

      if (this.portalLockMessageCooldown > 0) {
        this.portalLockMessageCooldown -= dt;
      }

      // Win condition: reach portal
      if (this.currentLevel.exitPortal) {
        if (window.PixelQuest.Collision && window.PixelQuest.Collision.checkAABB(this.player, this.currentLevel.exitPortal)) {
          if (this.currentLevel.bossRequired && !this.currentLevel.bossDefeated) {
            // Portal sealed until boss is defeated!
            if (this.portalLockMessageCooldown <= 0) {
              if (this.currentLevel.spawnFloatingText) {
                this.currentLevel.spawnFloatingText(
                  this.currentLevel.exitPortal.x + 16,
                  this.currentLevel.exitPortal.y - 12,
                  'DEFEAT THE OVERLORD FIRST!',
                  '#e74c3c'
                );
              }
              if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
                window.PixelQuest.UI.audio.playTone(180, 100, 0.15, 'sawtooth', 0.15);
              }
              this.portalLockMessageCooldown = 1.8;
            }
          } else {
            this.handleLevelCompletion();
            return;
          }
        }
      }

      // Lose condition: zero health or falling into bottomless gaps
      if (this.player.health <= 0 || this.player.y > levelPixelHeight + 16) {
        const storage = window.PixelQuest.Storage;
        if (storage && this.player) {
          storage.saveHighScore(this.player.score);
          storage.addCoins(this.player.coins);
          storage.clearPlayerSession();
        }
        if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
          window.PixelQuest.UI.audio.playGameOver();
        }
        this.triggerShake(0.3, 5);
        this.setState(GameState.GAME_OVER);
        return;
      }

      // Update HUD
      if (window.PixelQuest.UI) {
        window.PixelQuest.UI.updateHUD(this.player, this.currentLevel.name, this.fps);
      }
    }

    /**
     * Handle Stage Completion, scoring calculations & level unlocking
     */
    handleLevelCompletion() {
      if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
        window.PixelQuest.UI.audio.playLevelComplete();
      }

      // Calculate score breakdown
      const healthBonus = (this.player ? this.player.health : 0) * 50;
      const stageClearBonus = 200 * (this.currentLevelIndex + 1);
      if (this.player) {
        this.player.score += healthBonus + stageClearBonus;
      }

      const totalScore = this.player ? this.player.score : 0;
      const isGameVictory = (this.currentLevelIndex >= (window.PixelQuest.LEVEL_DATA ? window.PixelQuest.LEVEL_DATA.length - 1 : 2));

      const storage = window.PixelQuest.Storage;
      if (storage) {
        storage.saveHighScore(totalScore);
        storage.markLevelCompleted(this.currentLevelIndex + 1);
        storage.unlockLevel(this.currentLevelIndex + 2);
        storage.addCoins(this.player ? this.player.coins : 0);
        if (isGameVictory) {
          storage.clearPlayerSession();
        } else {
          storage.savePlayerSession({
            levelIndex: this.currentLevelIndex + 1,
            score: totalScore,
            health: this.player ? this.player.health : 3,
            coins: 0
          });
        }
      }

      this.lastLevelStats = {
        levelId: this.currentLevel.id,
        levelName: this.currentLevel.name,
        coins: this.player ? this.player.coins : 0,
        health: this.player ? this.player.health : 0,
        healthBonus: healthBonus,
        clearBonus: stageClearBonus,
        totalScore: totalScore,
        isGameVictory: isGameVictory
      };

      this.setState(GameState.LEVEL_COMPLETE);
    }

    /**
     * Render Dispatcher
     */
    render() {
      this.ctx.save();

      // Screen shake translation
      if (this.shakeDuration > 0) {
        const ox = (Math.random() - 0.5) * this.shakeIntensity * 2;
        const oy = (Math.random() - 0.5) * this.shakeIntensity * 2;
        this.ctx.translate(ox, oy);
      }

      if (this.state === GameState.MENU) {
        this.renderMenuScene();
      } else {
        this.renderGameScene();
      }

      this.ctx.restore();
    }

    /**
     * Render animated Start Screen background on canvas
     */
    renderMenuScene() {
      const ctx = this.ctx;
      const w = this.virtualWidth;
      const h = this.virtualHeight;
      const t = this.menuTime;

      // 1. Night Sky Gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#0a0d1a');
      skyGrad.addColorStop(0.5, '#161936');
      skyGrad.addColorStop(1, '#2c2d5b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Pixel Stars with Twinkle
      for (let p of this.menuParticles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (0.6 + 0.4 * Math.sin(t * 3 + p.x));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1.0;

      // 3. Pixel Crescent Moon
      this.drawPixelMoon(ctx, 640, 80);

      // 4. Parallax Mountain Ridges (Layer 1 - Far)
      this.drawMountainRange(ctx, '#1e2044', 210, 0.05, 70);

      // 5. Parallax Mountain Ridges (Layer 2 - Mid)
      this.drawMountainRange(ctx, '#262953', 270, 0.12, 50);

      // 6. Pine Forest Silhouette
      this.drawForestSilhouette(ctx, '#14152b', 330, 0.25);

      // 7. Floating Hero Cliff Island
      this.drawHeroCliffIsland(ctx);

      // 8. Animated Torch & Fire Particles
      this.drawTorch(ctx, 236, 292);

      // 9. Idle Pixel Hero standing on cliff edge
      this.drawMenuHero(ctx, 276, 280);
    }

    /**
     * Draw retro pixel moon
     */
    drawPixelMoon(ctx, mx, my) {
      ctx.fillStyle = '#f6e58d';
      ctx.beginPath();
      ctx.arc(mx, my, 34, 0, Math.PI * 2);
      ctx.fill();

      // Moon glow
      ctx.fillStyle = '#f9ca24';
      ctx.beginPath();
      ctx.arc(mx + 6, my - 2, 28, 0, Math.PI * 2);
      ctx.fill();

      // Shadow overlay to create crescent
      ctx.fillStyle = '#161936';
      ctx.beginPath();
      ctx.arc(mx - 10, my - 6, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    /**
     * Draw procedural mountain silhouette
     */
    drawMountainRange(ctx, color, baseY, scrollSpeed, peakHeight) {
      const offset = (this.menuTime * scrollSpeed * 40) % 800;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, this.virtualHeight);

      for (let x = -80; x <= this.virtualWidth + 80; x += 80) {
        const peakX = x - offset;
        const peakY = baseY - Math.sin((x + offset) * 0.015) * peakHeight;
        ctx.lineTo(peakX, peakY);
        ctx.lineTo(peakX + 40, baseY + 10);
      }

      ctx.lineTo(this.virtualWidth, this.virtualHeight);
      ctx.closePath();
      ctx.fill();
    }

    /**
     * Draw pine tree forest silhouettes
     */
    drawForestSilhouette(ctx, color, baseY, scrollSpeed) {
      ctx.fillStyle = color;
      const offset = (this.menuTime * scrollSpeed * 60) % 60;
      ctx.fillRect(0, baseY, this.virtualWidth, this.virtualHeight - baseY);

      for (let x = -60; x <= this.virtualWidth + 60; x += 24) {
        const tx = x - offset;
        ctx.beginPath();
        ctx.moveTo(tx, baseY);
        ctx.lineTo(tx + 12, baseY - 32);
        ctx.lineTo(tx + 24, baseY);
        ctx.closePath();
        ctx.fill();
      }
    }

    /**
     * Draw floating cliff island where hero stands
     */
    drawHeroCliffIsland(ctx) {
      const ix = 190;
      const iy = 310;
      const iw = 180;

      // Grass top
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(ix, iy, iw, 12);

      // Dark grass fringe
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(ix + 6, iy + 12, 10, 4);
      ctx.fillRect(ix + 34, iy + 12, 12, 5);
      ctx.fillRect(ix + 80, iy + 12, 14, 4);
      ctx.fillRect(ix + 130, iy + 12, 16, 5);

      // Stone under-structure
      ctx.fillStyle = '#576574';
      ctx.beginPath();
      ctx.moveTo(ix, iy + 12);
      ctx.lineTo(ix + iw, iy + 12);
      ctx.lineTo(ix + iw - 20, iy + 64);
      ctx.lineTo(ix + 80, iy + 92);
      ctx.lineTo(ix + 20, iy + 60);
      ctx.closePath();
      ctx.fill();

      // Stone cracks and highlights
      ctx.fillStyle = '#8395a7';
      ctx.fillRect(ix + 30, iy + 24, 20, 6);
      ctx.fillRect(ix + 90, iy + 36, 24, 7);
      ctx.fillStyle = '#222f3e';
      ctx.fillRect(ix + 55, iy + 30, 4, 18);
    }

    /**
     * Draw animated torch and embers
     */
    drawTorch(ctx, tx, ty) {
      // Sconce post
      ctx.fillStyle = '#795548';
      ctx.fillRect(tx, ty, 6, 18);

      // Torch head
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(tx - 3, ty, 12, 5);

      // Animated Fire
      const flicker = Math.sin(this.menuTime * 18) * 2;
      ctx.fillStyle = '#ff7675';
      ctx.fillRect(tx - 2, ty - 12 + flicker, 10, 12);
      ctx.fillStyle = '#fdcb6e';
      ctx.fillRect(tx, ty - 10 + flicker, 6, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx + 2, ty - 8 + flicker, 2, 4);

      // Draw embers
      for (let e of this.menuTorchEmbers) {
        ctx.fillStyle = e.life < 0.6 ? '#f9ca24' : '#eb4d4b';
        ctx.globalAlpha = 1.0 - e.life;
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }
      ctx.globalAlpha = 1.0;
    }

    /**
     * Draw cute pixel adventurer standing on cliff edge in start screen
     */
    drawMenuHero(ctx, hx, hy) {
      const bounce = Math.sin(this.menuTime * 3.5) > 0 ? 1 : 0;
      const featherWave = Math.sin(this.menuTime * 6) * 2;

      ctx.save();
      ctx.translate(hx, hy);

      // Satchel / Backpack
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(1, 14 + bounce, 5, 8);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(2, 17 + bounce, 2, 2);

      // Crimson feather
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(4, 1 + bounce + featherWave, 3, 4);
      ctx.fillRect(6, 0 + bounce + featherWave, 2, 2);

      // Green adventurer cap
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(5, 4 + bounce, 14, 7);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(7, 3 + bounce, 10, 3);
      ctx.fillStyle = '#1e8449';
      ctx.fillRect(4, 9 + bounce, 16, 2);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(7, 6 + bounce, 2, 3);

      // Hair & Face
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(4, 11 + bounce, 2, 4);
      ctx.fillRect(6, 11 + bounce, 3, 2);
      ctx.fillRect(16, 11 + bounce, 3, 2);

      ctx.fillStyle = '#fcd5a0'; // Face
      ctx.fillRect(6, 11 + bounce, 12, 7);

      // Cheeks & Eyes
      ctx.fillStyle = '#ff7675';
      ctx.fillRect(6, 16 + bounce, 2, 1);
      ctx.fillRect(15, 16 + bounce, 2, 1);

      ctx.fillStyle = '#1e272e';
      ctx.fillRect(12, 12 + bounce, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(12, 12 + bounce, 2, 2);

      // Tunic
      ctx.fillStyle = '#3498db';
      ctx.fillRect(5, 18 + bounce, 12, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 18 + bounce, 5, 2);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(10, 20 + bounce, 2, 2);

      // Arms
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(14, 19 + bounce, 3, 5);
      ctx.fillStyle = '#fcd5a0';
      ctx.fillRect(14, 23 + bounce, 3, 2);

      // Belt
      ctx.fillStyle = '#4a2810';
      ctx.fillRect(5, 24 + bounce, 12, 2);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(9, 24 + bounce, 3, 2);

      // Boots
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(6, 25 + bounce, 10, 2);
      ctx.fillStyle = '#6d4c41';
      ctx.fillRect(5, 26, 5, 4);
      ctx.fillRect(12, 26, 5, 4);
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(5, 26, 5, 1);
      ctx.fillRect(12, 26, 5, 1);

      ctx.restore();
    }

    /**
     * Render the active game level, parallax background layers, and entities
     */
    renderGameScene() {
      const ctx = this.ctx;
      const theme = this.currentLevel ? this.currentLevel.theme : 'forest';

      if (theme === 'lava') {
        this.drawParallaxLavaSky(ctx);
        this.drawParallaxLavaMountains(ctx);
        this.drawParallaxBasaltColumns(ctx);
      } else if (theme === 'castle') {
        this.drawParallaxCastleSky(ctx);
        this.drawParallaxCastleTowers(ctx);
        this.drawParallaxGothicRamparts(ctx);
      } else {
        // Forest
        this.drawParallaxSky(ctx);
        this.drawParallaxClouds(ctx);
        this.drawParallaxMountains(ctx);
        this.drawParallaxMidgroundForest(ctx);
        this.drawParallaxAncientTrees(ctx);
      }

      // Interactive Level Gameplay Layer (Layer 5 - 1.0x)
      if (this.currentLevel) {
        this.currentLevel.render(ctx, this.camera);
      }

      // Render Enemies
      this.enemyManager.render(ctx, this.camera);

      // Render Player using separate draw() function
      if (this.player) {
        this.player.draw(ctx, this.camera);
      }

      // Foreground ambient particles (Layer 6 - 1.2x)
      if (theme === 'lava') {
        this.drawForegroundEmbers(ctx);
      } else if (theme === 'castle') {
        this.drawForegroundMotes(ctx);
      } else {
        this.drawForegroundLeaves(ctx);
      }
    }

    /**
     * Layer 0: Sky Gradient and Radiant Sun with Canopy Light Shafts
     */
    drawParallaxSky(ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.virtualHeight);
      grad.addColorStop(0, '#192a56');
      grad.addColorStop(0.35, '#273c75');
      grad.addColorStop(0.7, '#40739e');
      grad.addColorStop(1, '#74b9ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

      // Radiant Sun
      const sunX = Math.round(620 - (this.camera.x * 0.04));
      const sunY = Math.round(95 - (this.camera.y * 0.04));

      ctx.fillStyle = '#fff9d2';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
      ctx.fill();

      // Soft Sun Bloom Halo
      ctx.fillStyle = 'rgba(253, 203, 110, 0.22)';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 68, 0, Math.PI * 2);
      ctx.fill();

      // Ambient God Rays / Light Shafts streaming through forest
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#ffffff';
      for (let r = -2; r <= 2; r++) {
        ctx.beginPath();
        ctx.moveTo(sunX + r * 28, sunY);
        ctx.lineTo(sunX + r * 180 - 120, this.virtualHeight);
        ctx.lineTo(sunX + r * 180 + 70, this.virtualHeight);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    /**
     * Layer 1: Parallax Floating Clouds (0.08x)
     */
    drawParallaxClouds(ctx) {
      const camX = this.camera.x * 0.08;
      const t = this.gameplayTime * 6;
      const clouds = [
        { x: 60, y: 35, w: 96, h: 26 },
        { x: 260, y: 70, w: 120, h: 30 },
        { x: 520, y: 40, w: 84, h: 24 },
        { x: 780, y: 80, w: 140, h: 34 },
        { x: 1040, y: 45, w: 110, h: 28 }
      ];

      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      for (let c of clouds) {
        const cx = Math.round((c.x + t - camX) % (this.virtualWidth + 300)) - 100;
        ctx.fillRect(cx, c.y, c.w, c.h);
        ctx.fillRect(cx + 12, c.y - 8, c.w - 24, 8);
        ctx.fillRect(cx + 24, c.y - 14, c.w - 48, 6);
      }
    }

    /**
     * Layer 2: Parallax Distant Mountains (0.18x)
     */
    drawParallaxMountains(ctx) {
      const camX = this.camera.x * 0.18;
      const baseY = 320 - (this.camera.y * 0.05);

      ctx.save();
      ctx.fillStyle = '#2c3558'; // Distant misty indigo mountain
      ctx.beginPath();
      ctx.moveTo(0, this.virtualHeight);

      const peakWidth = 140;
      const startX = -((camX) % peakWidth) - peakWidth;

      for (let x = startX; x <= this.virtualWidth + peakWidth * 2; x += peakWidth) {
        ctx.lineTo(x, baseY + 20);
        ctx.lineTo(x + peakWidth * 0.5, baseY - 85);
        ctx.lineTo(x + peakWidth, baseY + 20);
      }

      ctx.lineTo(this.virtualWidth, this.virtualHeight);
      ctx.closePath();
      ctx.fill();

      // Mountain Peak Snow / Rock Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      for (let x = startX; x <= this.virtualWidth + peakWidth * 2; x += peakWidth) {
        ctx.beginPath();
        ctx.moveTo(x + peakWidth * 0.5, baseY - 85);
        ctx.lineTo(x + peakWidth * 0.5 - 12, baseY - 60);
        ctx.lineTo(x + peakWidth * 0.5 + 12, baseY - 60);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    /**
     * Layer 3: Parallax Midground Forest Ridge (0.35x)
     */
    drawParallaxMidgroundForest(ctx) {
      const camX = this.camera.x * 0.35;
      const baseY = 360 - (this.camera.y * 0.08);

      ctx.save();
      ctx.fillStyle = '#173f38'; // Deep forest teal silhouette

      const treeSpacing = 28;
      const startX = -((camX) % treeSpacing) - treeSpacing;

      for (let x = startX; x <= this.virtualWidth + treeSpacing * 2; x += treeSpacing) {
        const treeH = 50 + ((Math.abs(Math.sin(x * 0.04)) * 30));
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + treeSpacing * 0.5, baseY - treeH);
        ctx.lineTo(x + treeSpacing, baseY);
        ctx.closePath();
        ctx.fill();
      }

      // Base solid fill
      ctx.fillRect(0, baseY, this.virtualWidth, this.virtualHeight - baseY);
      ctx.restore();
    }

    /**
     * Layer 4: Parallax Background Ancient Trees & Hanging Vines (0.60x)
     */
    drawParallaxAncientTrees(ctx) {
      const camX = this.camera.x * 0.60;
      const camY = this.camera.y * 0.15;

      ctx.save();
      const treeSpacing = 360;
      const startX = -((camX) % treeSpacing) - treeSpacing;

      for (let x = startX; x <= this.virtualWidth + treeSpacing * 2; x += treeSpacing) {
        const tx = Math.round(x);
        const ty = Math.round(180 - camY);

        // Giant Trunk
        ctx.fillStyle = '#2f241d';
        ctx.fillRect(tx, ty, 32, 280);
        ctx.fillStyle = '#1f1712';
        ctx.fillRect(tx, ty, 8, 280);

        // Spreading Branch Canopy
        ctx.fillStyle = '#145a32';
        ctx.beginPath();
        ctx.arc(tx + 16, ty - 10, 64, 0, Math.PI * 2);
        ctx.arc(tx - 32, ty + 12, 42, 0, Math.PI * 2);
        ctx.arc(tx + 64, ty + 12, 42, 0, Math.PI * 2);
        ctx.fill();

        // Canopy Highlights
        ctx.fillStyle = '#1e824c';
        ctx.beginPath();
        ctx.arc(tx + 16, ty - 24, 38, 0, Math.PI * 2);
        ctx.fill();

        // Hanging Vines
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(tx - 18, ty + 24, 3, 36);
        ctx.fillRect(tx + 36, ty + 30, 3, 44);
      }
      ctx.restore();
    }

    /**
     * Layer 6: Foreground Ambient Drifting Leaves (1.2x)
     */
    drawForegroundLeaves(ctx) {
      ctx.save();
      for (let leaf of this.ambientLeaves) {
        ctx.fillStyle = leaf.color;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(Math.round(leaf.x), Math.round(leaf.y), leaf.size, leaf.size);
      }
      ctx.restore();
    }

    /**
     * Lava Theme: Dark Volcanic Cavern Sky with Magma Horizon
     */
    drawParallaxLavaSky(ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.virtualHeight);
      grad.addColorStop(0, '#0c0202');
      grad.addColorStop(0.4, '#240606');
      grad.addColorStop(0.75, '#450f08');
      grad.addColorStop(1, '#852107');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

      // Distant magma glow along horizon
      ctx.save();
      ctx.globalAlpha = 0.2 + Math.sin(this.gameplayTime * 3) * 0.08;
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(0, 240 - this.camera.y * 0.05, this.virtualWidth, 60);
      ctx.restore();
    }

    /**
     * Lava Theme: Jagged Volcanic Basalt Peaks (0.18x)
     */
    drawParallaxLavaMountains(ctx) {
      const camX = this.camera.x * 0.18;
      const baseY = 340 - (this.camera.y * 0.05);

      ctx.save();
      ctx.fillStyle = '#210808';
      ctx.beginPath();
      ctx.moveTo(0, this.virtualHeight);

      const peakWidth = 120;
      const startX = -((camX) % peakWidth) - peakWidth;

      for (let x = startX; x <= this.virtualWidth + peakWidth * 2; x += peakWidth) {
        ctx.lineTo(x, baseY + 15);
        ctx.lineTo(x + peakWidth * 0.5, baseY - 90);
        ctx.lineTo(x + peakWidth, baseY + 15);
      }

      ctx.lineTo(this.virtualWidth, this.virtualHeight);
      ctx.closePath();
      ctx.fill();

      // Glowing magma fissures on peaks
      ctx.fillStyle = '#e74c3c';
      for (let x = startX; x <= this.virtualWidth + peakWidth * 2; x += peakWidth) {
        ctx.beginPath();
        ctx.moveTo(x + peakWidth * 0.5, baseY - 90);
        ctx.lineTo(x + peakWidth * 0.5 - 4, baseY - 60);
        ctx.lineTo(x + peakWidth * 0.5 + 4, baseY - 60);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    /**
     * Lava Theme: Basalt Columns & Cavern Stalagmites (0.40x)
     */
    drawParallaxBasaltColumns(ctx) {
      const camX = this.camera.x * 0.40;
      const baseY = 370 - (this.camera.y * 0.08);

      ctx.save();
      ctx.fillStyle = '#170606';

      const colSpacing = 48;
      const startX = -((camX) % colSpacing) - colSpacing;

      for (let x = startX; x <= this.virtualWidth + colSpacing * 2; x += colSpacing) {
        const h = 40 + (Math.abs(Math.sin(x * 0.05)) * 45);
        ctx.fillRect(x, baseY - h, 20, h + 80);
        ctx.fillStyle = '#2b0b0b';
        ctx.fillRect(x + 2, baseY - h, 4, h + 80);
        ctx.fillStyle = '#170606';
      }

      ctx.restore();
    }

    /**
     * Lava Theme: Foreground Floating Embers (1.2x)
     */
    drawForegroundEmbers(ctx) {
      ctx.save();
      for (let e of this.ambientEmbers) {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
      }
      ctx.restore();
    }

    /**
     * Castle Theme: Midnight Storm Sky with Crimson Blood Moon
     */
    drawParallaxCastleSky(ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.virtualHeight);
      grad.addColorStop(0, '#04050e');
      grad.addColorStop(0.4, '#0d0f26');
      grad.addColorStop(0.8, '#18153b');
      grad.addColorStop(1, '#2c1e48');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.virtualWidth, this.virtualHeight);

      // Crimson Full Moon
      const moonX = Math.round(650 - (this.camera.x * 0.03));
      const moonY = Math.round(80 - (this.camera.y * 0.03));

      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
      ctx.fill();

      // Crimson Halo
      ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 70, 0, Math.PI * 2);
      ctx.fill();
    }

    /**
     * Castle Theme: Distant Gothic Castle Spires & Towers (0.18x)
     */
    drawParallaxCastleTowers(ctx) {
      const camX = this.camera.x * 0.18;
      const baseY = 340 - (this.camera.y * 0.05);

      ctx.save();
      ctx.fillStyle = '#0f1124';

      const towerSpacing = 160;
      const startX = -((camX) % towerSpacing) - towerSpacing;

      for (let x = startX; x <= this.virtualWidth + towerSpacing * 2; x += towerSpacing) {
        // High Spire
        ctx.beginPath();
        ctx.moveTo(x + 20, baseY);
        ctx.lineTo(x + 35, baseY - 120);
        ctx.lineTo(x + 50, baseY);
        ctx.closePath();
        ctx.fill();

        // Tower Body
        ctx.fillRect(x + 15, baseY - 40, 40, 100);
        // Battlements
        ctx.fillRect(x + 10, baseY - 45, 10, 8);
        ctx.fillRect(x + 30, baseY - 45, 10, 8);
        ctx.fillRect(x + 50, baseY - 45, 10, 8);
      }

      ctx.restore();
    }

    /**
     * Castle Theme: Midground Castle Ramparts & Stained Glass (0.40x)
     */
    drawParallaxGothicRamparts(ctx) {
      const camX = this.camera.x * 0.40;
      const baseY = 360 - (this.camera.y * 0.08);

      ctx.save();
      ctx.fillStyle = '#181b33';
      ctx.fillRect(0, baseY, this.virtualWidth, this.virtualHeight - baseY);

      const wallSpacing = 64;
      const startX = -((camX) % wallSpacing) - wallSpacing;

      for (let x = startX; x <= this.virtualWidth + wallSpacing * 2; x += wallSpacing) {
        // Crenellations
        ctx.fillRect(x, baseY - 20, 28, 20);

        // Glowing Gothic Arched Windows
        ctx.fillStyle = '#6c5ce7';
        ctx.fillRect(x + 8, baseY + 12, 10, 18);
        ctx.beginPath();
        ctx.arc(x + 13, baseY + 12, 5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#181b33';
      }

      ctx.restore();
    }

    /**
     * Castle Theme: Foreground Mystic Magic Motes (1.2x)
     */
    drawForegroundMotes(ctx) {
      ctx.save();
      for (let m of this.ambientMotes) {
        ctx.fillStyle = m.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
      }
      ctx.restore();
    }
  }

  window.PixelQuest.GameState = GameState;
  window.PixelQuest.Game = Game;

})(typeof window !== 'undefined' ? window : this);

