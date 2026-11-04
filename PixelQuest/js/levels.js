/**
 * PixelQuest - Levels & Environment Module
 * Defines tile types, tile properties, dynamic platforms (Moving & Disappearing),
 * hazards & obstacles (Spikes, Moving Traps, Lava Pits, Falling Obstacles),
 * coin collection animations & particle effects, and multi-tier side-scrolling level maps.
 */

(function (window) {
  'use strict';

  window.PixelQuest = window.PixelQuest || {};

  const TileTypes = Object.freeze({
    EMPTY: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    BRICK: 4,
    WOOD_PLATFORM: 5,
    SPIKE: 6,
    COIN: 7,
    GEM: 8,
    SPRING: 9,
    PORTAL: 10
  });

  const TileProperties = {
    [TileTypes.EMPTY]: { isSolid: false, isHazard: false, isCollectible: false, color: null },
    [TileTypes.GRASS]: { isSolid: true, isHazard: false, isCollectible: false, color: '#2ecc71', topColor: '#27ae60' },
    [TileTypes.DIRT]: { isSolid: true, isHazard: false, isCollectible: false, color: '#8d6e63' },
    [TileTypes.STONE]: { isSolid: true, isHazard: false, isCollectible: false, color: '#7f8c8d' },
    [TileTypes.BRICK]: { isSolid: true, isHazard: false, isCollectible: false, color: '#c0392b' },
    [TileTypes.WOOD_PLATFORM]: { isSolid: false, isOneWay: true, color: '#d35400' },
    [TileTypes.SPIKE]: { isSolid: false, isHazard: true, damage: 1, color: '#e74c3c' },
    [TileTypes.COIN]: { isSolid: false, isCollectible: true, points: 10, color: '#f1c40f' },
    [TileTypes.GEM]: { isSolid: false, isCollectible: true, points: 50, color: '#9b59b6' },
    [TileTypes.SPRING]: { isSolid: true, isBounce: true, boostY: -16, color: '#e67e22' },
    [TileTypes.PORTAL]: { isSolid: false, isExit: true, color: '#00cec9' }
  };

  /**
   * Floating Text Effect (+10 Coins / +50 Stomp)
   */
  class FloatingText {
    constructor(x, y, text, color = '#f1c40f') {
      this.x = x;
      this.y = y;
      this.text = text;
      this.color = color;
      this.life = 0.75;
      this.maxLife = 0.75;
      this.vy = -35; // floats upward at 35px/s
    }

    update(dt) {
      this.y += this.vy * dt;
      this.life -= dt;
      return this.life > 0;
    }

    draw(ctx, camera) {
      const alpha = Math.max(0, this.life / this.maxLife);
      const px = Math.round(this.x - camera.x);
      const py = Math.round(this.y - camera.y);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      // Drop shadow / outline
      ctx.fillStyle = '#000000';
      ctx.fillText(this.text, px + 1, py + 1);

      ctx.fillStyle = this.color;
      ctx.fillText(this.text, px, py);
      ctx.restore();
    }
  }

  /**
   * Sparkle Particle for Coin Pickup & Stomp Burst
   */
  class SparkleParticle {
    constructor(x, y, color = '#f1c40f') {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 20;
      this.size = Math.random() < 0.5 ? 2 : 3;
      this.life = 0.45;
      this.maxLife = 0.45;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.life -= dt;
      return this.life > 0;
    }

    draw(ctx, camera) {
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.fillRect(Math.round(this.x - camera.x), Math.round(this.y - camera.y), this.size, this.size);
      ctx.restore();
    }
  }

  /**
   * Dynamic Moving Platform
   */
  class MovingPlatform {
    constructor(startX, startY, endX, endY, width = 72, height = 16, speed = 65) {
      this.startX = startX;
      this.startY = startY;
      this.endX = endX;
      this.endY = endY;
      this.x = startX;
      this.y = startY;
      this.width = width;
      this.height = height;
      this.speed = speed;
      this.progress = 0;
      this.direction = 1;
      this.vx = 0;
      this.vy = 0;
      this.isSolid = true;
      this.isMoving = true;
      this.animTime = Math.random() * 10;
    }

    update(dt) {
      this.animTime += dt;
      const dx = this.endX - this.startX;
      const dy = this.endY - this.startY;
      const totalDist = Math.hypot(dx, dy);

      if (totalDist > 0) {
        const step = (this.speed * dt) / totalDist;
        this.progress += step * this.direction;

        if (this.progress >= 1) {
          this.progress = 1;
          this.direction = -1;
        } else if (this.progress <= 0) {
          this.progress = 0;
          this.direction = 1;
        }

        const prevX = this.x;
        const prevY = this.y;
        this.x = this.startX + dx * this.progress;
        this.y = this.startY + dy * this.progress;

        this.vx = (this.x - prevX) / dt;
        this.vy = (this.y - prevY) / dt;
      }
    }

    draw(ctx, camera) {
      const px = Math.round(this.x - camera.x);
      const py = Math.round(this.y - camera.y);

      if (px + this.width < -20 || px > 820 || py + this.height < -20 || py > 470) return;

      ctx.save();

      // Soft shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(px + this.width / 2, py + this.height + 6, this.width / 2 - 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wooden body
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(px, py + 3, this.width, this.height - 3);

      // Grass top
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(px, py, this.width, 4);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(px + 4, py + 4, 6, 2);
      ctx.fillRect(px + 20, py + 4, 8, 3);
      ctx.fillRect(px + 44, py + 4, 7, 2);

      // Brass brackets
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(px + 2, py + 5, 4, this.height - 6);
      ctx.fillRect(px + this.width - 6, py + 5, 4, this.height - 6);

      // Glowing crystal levitation core
      const pulse = 0.6 + 0.4 * Math.sin(this.animTime * 6);
      ctx.fillStyle = `rgba(0, 210, 211, ${pulse})`;
      ctx.fillRect(px + this.width / 2 - 6, py + this.height, 12, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + this.width / 2 - 2, py + this.height + 1, 4, 2);

      ctx.restore();
    }
  }

  /**
   * Temporary Disappearing Platform
   */
  class DisappearingPlatform {
    constructor(x, y, width = 64, height = 16) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.isSolid = true;
      this.isDisappearing = true;

      this.state = 'IDLE'; // 'IDLE', 'SHAKING', 'DISAPPEARED', 'REAPPEARING'
      this.stateTimer = 0;
      this.shakeDuration = 0.75;
      this.disappearedDuration = 2.0;
      this.reappearDuration = 0.35;
      this.rubbleParticles = [];
    }

    stepOn() {
      if (this.state === 'IDLE') {
        this.state = 'SHAKING';
        this.stateTimer = 0;
        if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
          window.PixelQuest.UI.audio.playTone(240, 180, 0.08, 'sawtooth', 0.1);
        }
      }
    }

    update(dt) {
      for (let i = this.rubbleParticles.length - 1; i >= 0; i--) {
        const p = this.rubbleParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 800 * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this.rubbleParticles.splice(i, 1);
        }
      }

      if (this.state === 'SHAKING') {
        this.stateTimer += dt;
        if (this.stateTimer >= this.shakeDuration) {
          this.state = 'DISAPPEARED';
          this.stateTimer = 0;
          this.isSolid = false;
          this.spawnRubble();
          if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
            window.PixelQuest.UI.audio.playTone(180, 70, 0.15, 'square', 0.12);
          }
        }
      } else if (this.state === 'DISAPPEARED') {
        this.stateTimer += dt;
        if (this.stateTimer >= this.disappearedDuration) {
          this.state = 'REAPPEARING';
          this.stateTimer = 0;
        }
      } else if (this.state === 'REAPPEARING') {
        this.stateTimer += dt;
        if (this.stateTimer >= this.reappearDuration) {
          this.state = 'IDLE';
          this.stateTimer = 0;
          this.isSolid = true;
        }
      }
    }

    spawnRubble() {
      for (let i = 0; i < 8; i++) {
        this.rubbleParticles.push({
          x: this.x + Math.random() * this.width,
          y: this.y + Math.random() * this.height,
          vx: (Math.random() - 0.5) * 80,
          vy: -60 - Math.random() * 80,
          size: Math.random() < 0.5 ? 3 : 4,
          life: 0.6,
          color: Math.random() < 0.5 ? '#d35400' : '#8d6e63'
        });
      }
    }

    draw(ctx, camera) {
      ctx.save();
      for (let p of this.rubbleParticles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - camera.x), Math.round(p.y - camera.y), p.size, p.size);
      }
      ctx.restore();

      if (this.state === 'DISAPPEARED') return;

      let drawX = Math.round(this.x - camera.x);
      let drawY = Math.round(this.y - camera.y);

      if (drawX + this.width < -20 || drawX > 820 || drawY + this.height < -20 || drawY > 470) return;

      ctx.save();
      if (this.state === 'SHAKING') {
        drawX += Math.round((Math.random() - 0.5) * 3);
        drawY += Math.round((Math.random() - 0.5) * 2);
      } else if (this.state === 'REAPPEARING') {
        ctx.globalAlpha = Math.min(1.0, this.stateTimer / this.reappearDuration);
      }

      ctx.fillStyle = '#b3541e';
      ctx.fillRect(drawX, drawY, this.width, this.height);

      ctx.fillStyle = (this.state === 'SHAKING') ? '#ff4757' : '#e67e22';
      ctx.fillRect(drawX + 4, drawY + 3, this.width - 8, 4);
      ctx.fillRect(drawX + 6, drawY + 9, this.width - 12, 4);

      ctx.fillStyle = (this.state === 'SHAKING') ? '#ffa502' : '#576574';
      ctx.fillRect(drawX + 16, drawY + 2, 2, this.height - 4);
      ctx.fillRect(drawX + 38, drawY + 4, 2, this.height - 6);
      ctx.fillRect(drawX + 48, drawY + 1, 2, this.height - 3);

      ctx.restore();
    }
  }

  /**
   * Obstacle 1: Moving Trap (Spinning Saw Blade / Oscillating Pendulum)
   */
  class MovingTrap {
    constructor(startX, startY, endX, endY, radius = 16, speed = 70, type = 'saw') {
      this.startX = startX;
      this.startY = startY;
      this.endX = endX;
      this.endY = endY;
      this.x = startX;
      this.y = startY;
      this.radius = radius;
      this.speed = speed;
      this.type = type;
      this.progress = 0;
      this.direction = 1;
      this.rotAngle = 0;
    }

    update(dt, player) {
      this.rotAngle += dt * 14;
      const dx = this.endX - this.startX;
      const dy = this.endY - this.startY;
      const totalDist = Math.hypot(dx, dy);

      if (totalDist > 0) {
        this.progress += (this.speed * dt) / totalDist * this.direction;
        if (this.progress >= 1) {
          this.progress = 1;
          this.direction = -1;
        } else if (this.progress <= 0) {
          this.progress = 0;
          this.direction = 1;
        }
        this.x = this.startX + dx * this.progress;
        this.y = this.startY + dy * this.progress;
      }

      // Check collision with player
      if (player) {
        const closestX = Math.max(player.x, Math.min(this.x, player.x + player.width));
        const closestY = Math.max(player.y, Math.min(this.y, player.y + player.height));
        const distSq = (this.x - closestX) ** 2 + (this.y - closestY) ** 2;

        if (distSq <= this.radius ** 2) {
          player.takeDamage(1);
        }
      }
    }

    draw(ctx, camera) {
      const px = Math.round(this.x - camera.x);
      const py = Math.round(this.y - camera.y);

      if (px < -40 || px > 840 || py < -40 || py > 490) return;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(this.rotAngle);

      // Steel Sawblade Disc
      ctx.fillStyle = '#bdc3c7';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Sharp Saw Teeth
      ctx.fillStyle = '#7f8c8d';
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
        ctx.lineTo(Math.cos(a + 0.2) * (this.radius + 6), Math.sin(a + 0.2) * (this.radius + 6));
        ctx.lineTo(Math.cos(a + 0.4) * this.radius, Math.sin(a + 0.4) * this.radius);
        ctx.closePath();
        ctx.fill();
      }

      // Center Hub with Warning Red Dot
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Obstacle 2: Lava Pit (Molten bubbling magma pool)
   */
  class LavaPit {
    constructor(x, y, width, height = 32) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.embers = [];
      this.animTime = Math.random() * 10;
    }

    update(dt, player) {
      this.animTime += dt;

      // Spawn rising molten sparks
      if (Math.random() < 0.4) {
        this.embers.push({
          x: this.x + Math.random() * this.width,
          y: this.y + 4,
          vx: (Math.random() - 0.5) * 20,
          vy: -25 - Math.random() * 35,
          life: 0.6,
          maxLife: 0.6,
          size: Math.random() < 0.5 ? 2 : 3
        });
      }

      for (let i = this.embers.length - 1; i >= 0; i--) {
        const e = this.embers[i];
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.life -= dt;
        if (e.life <= 0) {
          this.embers.splice(i, 1);
        }
      }

      // Check fatal player contact with lava pool
      if (player && window.PixelQuest.Collision) {
        const lavaBox = { x: this.x, y: this.y + 6, width: this.width, height: this.height - 6 };
        if (window.PixelQuest.Collision.checkAABB(player, lavaBox)) {
          player.takeDamage(3);
          player.health = 0;
        }
      }
    }

    draw(ctx, camera) {
      const px = Math.round(this.x - camera.x);
      const py = Math.round(this.y - camera.y);

      if (px + this.width < -20 || px > 820 || py + this.height < -20 || py > 470) return;

      ctx.save();

      // Deep Magma Body
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(px, py + 6, this.width, this.height - 6);

      // Bubbling Molten Surface
      ctx.fillStyle = '#e67e22';
      const wave = Math.sin(this.animTime * 5) * 2;
      ctx.fillRect(px, py + 2 + wave, this.width, 6);

      // Bright Yellow Heat Crests
      ctx.fillStyle = '#f1c40f';
      for (let x = 0; x < this.width; x += 16) {
        const bubble = Math.sin(this.animTime * 6 + x) * 2;
        ctx.fillRect(px + x, py + 1 + bubble, 10, 3);
      }

      // Rising Lava Embers
      for (let e of this.embers) {
        const alpha = e.life / e.maxLife;
        ctx.fillStyle = alpha > 0.5 ? '#f1c40f' : '#e74c3c';
        ctx.globalAlpha = alpha;
        ctx.fillRect(Math.round(e.x - camera.x), Math.round(e.y - camera.y), e.size, e.size);
      }

      ctx.restore();
    }
  }

  /**
   * Obstacle 3: Falling Obstacle (Ceiling Stalactite / Spike Rock)
   */
  class FallingObstacle {
    constructor(x, y, width = 20, height = 28, triggerRange = 55) {
      this.startX = x;
      this.startY = y;
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.triggerRange = triggerRange;
      this.state = 'HANGING'; // 'HANGING', 'WARNING', 'FALLING', 'SHATTERED'
      this.vy = 0;
      this.gravity = 1100;
      this.stateTimer = 0;
      this.shards = [];
    }

    update(dt, level, player) {
      // Update shattered debris particles
      for (let i = this.shards.length - 1; i >= 0; i--) {
        const s = this.shards[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 800 * dt;
        s.life -= dt;
        if (s.life <= 0) {
          this.shards.splice(i, 1);
        }
      }

      if (this.state === 'HANGING') {
        if (player) {
          // Proximity trigger: player is beneath the stalactite within range
          const dx = Math.abs((player.x + player.width / 2) - (this.x + this.width / 2));
          const isBelow = player.y > this.y && player.y < this.y + 300;
          if (dx <= this.triggerRange && isBelow) {
            this.state = 'WARNING';
            this.stateTimer = 0;
          }
        }
      } else if (this.state === 'WARNING') {
        this.stateTimer += dt;
        if (this.stateTimer >= 0.35) {
          this.state = 'FALLING';
          this.vy = 80;
        }
      } else if (this.state === 'FALLING') {
        this.vy += this.gravity * dt;
        this.y += this.vy * dt;

        // Check player collision
        if (player && window.PixelQuest.Collision) {
          if (window.PixelQuest.Collision.checkAABB(player, this)) {
            player.takeDamage(1);
            this.shatter();
            return;
          }
        }

        // Check ground/tile impact
        if (level) {
          const tile = level.getTileAtCoords(this.x + this.width / 2, this.y + this.height);
          if (tile && tile.isSolid) {
            this.shatter();
          }
        }
      }
    }

    shatter() {
      this.state = 'SHATTERED';
      for (let i = 0; i < 6; i++) {
        this.shards.push({
          x: this.x + this.width / 2,
          y: this.y + this.height / 2,
          vx: (Math.random() - 0.5) * 120,
          vy: -70 - Math.random() * 80,
          size: Math.random() < 0.5 ? 3 : 4,
          life: 0.5,
          color: '#7f8c8d'
        });
      }
      if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
        window.PixelQuest.UI.audio.playTone(160, 60, 0.12, 'square', 0.12);
      }
    }

    draw(ctx, camera) {
      // Draw flying shards
      ctx.save();
      for (let s of this.shards) {
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.round(s.x - camera.x), Math.round(s.y - camera.y), s.size, s.size);
      }
      ctx.restore();

      if (this.state === 'SHATTERED') return;

      let drawX = Math.round(this.x - camera.x);
      let drawY = Math.round(this.y - camera.y);

      if (drawX + this.width < -20 || drawX > 820 || drawY + this.height < -20 || drawY > 470) return;

      ctx.save();
      if (this.state === 'WARNING') {
        drawX += Math.round((Math.random() - 0.5) * 3);
      }

      // Stone Stalactite Spike Body
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath();
      ctx.moveTo(drawX, drawY);
      ctx.lineTo(drawX + this.width, drawY);
      ctx.lineTo(drawX + this.width / 2, drawY + this.height);
      ctx.closePath();
      ctx.fill();

      // Highlight Edge
      ctx.fillStyle = '#95a5a6';
      ctx.beginPath();
      ctx.moveTo(drawX + 3, drawY);
      ctx.lineTo(drawX + this.width / 2, drawY + this.height - 4);
      ctx.lineTo(drawX + this.width / 2, drawY);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Helper to construct 80-tile map rows with exact column positioning
   */
  function buildRow(specs = []) {
    const chars = new Array(80).fill('0');
    for (let s of specs) {
      const col = s[0];
      const str = s[1];
      for (let i = 0; i < str.length; i++) {
        if (col + i < 80) {
          chars[col + i] = str[i];
        }
      }
    }
    return chars.join('');
  }

  /**
   * Reusable Multi-Level Configuration Objects
   * LEVEL 1: Whispering Woods (Beginner-friendly forest)
   * LEVEL 2: Lava Caves (Volcanic pits, moving platforms, falling stalactites)
   * LEVEL 3: Dark Castle (Gothic fortress, saw traps, final boss challenge)
   */
  const LEVEL_DATA = [
    // -------------------------------------------------------------------------
    // LEVEL 1: Whispering Woods (Green Forest)
    // -------------------------------------------------------------------------
    {
      id: 1,
      name: 'Whispering Woods',
      theme: 'forest',
      skyGradient: ['#192a56', '#273c75', '#40739e', '#74b9ff'],
      tileSize: 32,
      width: 80,
      height: 15,
      playerSpawn: { x: 64, y: 320 },
      exitPortal: { x: 2432, y: 336, width: 32, height: 48 },
      bossRequired: false,
      enemies: [
        { type: 'slime', x: 260, y: 360, patrolDistance: 90 },
        { type: 'slime', x: 680, y: 352, patrolDistance: 100 },
        { type: 'bat', x: 1050, y: 180, patrolDistance: 110 },
        { type: 'slime', x: 1420, y: 352, patrolDistance: 100 },
        { type: 'bat', x: 1800, y: 160, patrolDistance: 90 },
        { type: 'slime', x: 2200, y: 352, patrolDistance: 90 }
      ],
      movingPlatforms: [
        { startX: 896, startY: 320, endX: 1056, endY: 320, width: 72, height: 16, speed: 60 },
        { startX: 1536, startY: 352, endX: 1536, endY: 192, width: 68, height: 16, speed: 55 },
        { startX: 2016, startY: 256, endX: 2144, endY: 256, width: 72, height: 16, speed: 70 }
      ],
      disappearingPlatforms: [
        { x: 1248, y: 288, width: 64, height: 16 },
        { x: 1376, y: 240, width: 64, height: 16 },
        { x: 1920, y: 288, width: 64, height: 16 },
        { x: 2176, y: 256, width: 64, height: 16 }
      ],
      movingTraps: [
        { startX: 640, startY: 352, endX: 720, endY: 352, radius: 15, speed: 75, type: 'saw' }
      ],
      lavaPits: [
        { x: 896, y: 448, width: 224, height: 32 }
      ],
      fallingObstacles: [
        { x: 440, y: 64, width: 20, height: 28, triggerRange: 55 },
        { x: 1360, y: 96, width: 20, height: 28, triggerRange: 55 }
      ],
      decorations: [
        { type: 'signpost', x: 110, y: 360 },
        { type: 'big_tree', x: 180, y: 160 },
        { type: 'flowers', x: 300, y: 376 },
        { type: 'mushrooms', x: 420, y: 376 },
        { type: 'big_tree', x: 760, y: 160 },
        { type: 'hanging_vines', x: 800, y: 120 },
        { type: 'flowers', x: 1160, y: 376 },
        { type: 'big_tree', x: 1680, y: 140 },
        { type: 'hanging_vines', x: 1720, y: 100 },
        { type: 'ancient_pillar', x: 2260, y: 230 }
      ],
      map: [
        buildRow([]),
        buildRow([]),
        buildRow([]),
        buildRow([]),
        buildRow([[44, '8'], [52, '777']]),
        buildRow([[10, '777'], [41, '1111'], [49, '11111']]),
        buildRow([[9, '11111']]),
        buildRow([[5, '77'], [20, '777']]),
        buildRow([[5, '11'], [19, '11111']]),
        buildRow([[2, '11111'], [16, '111']]),
        buildRow([[15, '1111'], [36, '1111']]),
        buildRow([[35, '111111'], [68, '11111111'], [76, 'A']]),
        buildRow([[0, '1'.repeat(15)], [23, '1'.repeat(4)], [35, '1'.repeat(6)], [48, '1'.repeat(7)], [65, '1'.repeat(15)]]),
        buildRow([[0, '2'.repeat(15)], [23, '2'.repeat(4)], [35, '2'.repeat(6)], [48, '2'.repeat(7)], [65, '2'.repeat(15)]]),
        buildRow([[0, '2'.repeat(15)], [23, '2'.repeat(4)], [35, '2'.repeat(6)], [48, '2'.repeat(7)], [65, '2'.repeat(15)]])
      ]
    },

    // -------------------------------------------------------------------------
    // LEVEL 2: Lava Caves
    // -------------------------------------------------------------------------
    {
      id: 2,
      name: 'Lava Caves',
      theme: 'lava',
      skyGradient: ['#0f0505', '#240808', '#421008', '#781f08'],
      tileSize: 32,
      width: 80,
      height: 15,
      playerSpawn: { x: 64, y: 320 },
      exitPortal: { x: 2432, y: 336, width: 32, height: 48 },
      bossRequired: false,
      enemies: [
        { type: 'slime', x: 280, y: 352, patrolDistance: 80 },
        { type: 'bat', x: 560, y: 200, patrolDistance: 110 },
        { type: 'monster', x: 780, y: 352, patrolDistance: 100 },
        { type: 'slime', x: 920, y: 352, patrolDistance: 80 },
        { type: 'bat', x: 1180, y: 180, patrolDistance: 100 },
        { type: 'bat', x: 1760, y: 160, patrolDistance: 100 },
        { type: 'monster', x: 2060, y: 352, patrolDistance: 120 }
      ],
      movingPlatforms: [
        { startX: 416, startY: 320, endX: 576, endY: 320, width: 64, height: 16, speed: 70 },
        { startX: 1040, startY: 288, endX: 1248, endY: 288, width: 72, height: 16, speed: 75 },
        { startX: 1680, startY: 352, endX: 1680, endY: 224, width: 64, height: 16, speed: 60 }
      ],
      disappearingPlatforms: [
        { x: 800, y: 256, width: 64, height: 16 },
        { x: 1440, y: 256, width: 64, height: 16 },
        { x: 1536, y: 224, width: 64, height: 16 }
      ],
      movingTraps: [
        { startX: 740, startY: 352, endX: 840, endY: 352, radius: 15, speed: 85, type: 'saw' },
        { startX: 1980, startY: 352, endX: 2080, endY: 352, radius: 15, speed: 90, type: 'saw' }
      ],
      lavaPits: [
        { x: 384, y: 448, width: 256, height: 32 },
        { x: 1024, y: 448, width: 288, height: 32 },
        { x: 1664, y: 448, width: 288, height: 32 }
      ],
      fallingObstacles: [
        { x: 380, y: 64, width: 20, height: 28, triggerRange: 60 },
        { x: 920, y: 64, width: 20, height: 28, triggerRange: 60 },
        { x: 1380, y: 64, width: 20, height: 28, triggerRange: 60 },
        { x: 2100, y: 64, width: 20, height: 28, triggerRange: 60 }
      ],
      decorations: [
        { type: 'lava_crystal', x: 120, y: 360 },
        { type: 'stalagmite', x: 320, y: 340 },
        { type: 'magma_vent', x: 700, y: 370 },
        { type: 'lava_crystal', x: 860, y: 360 },
        { type: 'stalagmite', x: 1320, y: 340 },
        { type: 'magma_vent', x: 1950, y: 370 },
        { type: 'lava_crystal', x: 2280, y: 360 }
      ],
      map: [
        buildRow([]),
        buildRow([]),
        buildRow([]),
        buildRow([]),
        buildRow([[36, '8'], [44, '777']]),
        buildRow([[14, '777'], [42, '1111']]),
        buildRow([[13, '11111']]),
        buildRow([[6, '777'], [26, '777']]),
        buildRow([[6, '1111'], [25, '11111']]),
        buildRow([[24, '1111'], [48, '11111']]),
        buildRow([[23, '111111']]),
        buildRow([[44, '11111'], [68, '11111111'], [76, 'A']]),
        buildRow([[0, '1'.repeat(12)], [20, '1'.repeat(12)], [41, '1'.repeat(12)], [62, '1'.repeat(18)]]),
        buildRow([[0, '2'.repeat(12)], [20, '2'.repeat(12)], [41, '2'.repeat(12)], [62, '2'.repeat(18)]]),
        buildRow([[0, '2'.repeat(12)], [20, '2'.repeat(12)], [41, '2'.repeat(12)], [62, '2'.repeat(18)]])
      ]
    },

    // -------------------------------------------------------------------------
    // LEVEL 3: Dark Castle
    // -------------------------------------------------------------------------
    {
      id: 3,
      name: 'Dark Castle',
      theme: 'castle',
      skyGradient: ['#05050f', '#0c0c24', '#15153b', '#241a4a'],
      tileSize: 32,
      width: 80,
      height: 15,
      playerSpawn: { x: 64, y: 320 },
      exitPortal: { x: 2432, y: 336, width: 32, height: 48 },
      bossRequired: true,
      enemies: [
        { type: 'slime', x: 240, y: 352, patrolDistance: 80 },
        { type: 'monster', x: 480, y: 352, patrolDistance: 100 },
        { type: 'bat', x: 600, y: 160, patrolDistance: 90 },
        { type: 'slime', x: 1050, y: 352, patrolDistance: 90 },
        { type: 'bat', x: 1280, y: 160, patrolDistance: 90 },
        { type: 'monster', x: 1420, y: 352, patrolDistance: 110 },
        // Final Boss Challenge: The Dark Overlord in Throne Room Arena!
        { type: 'boss', x: 2060, y: 336, patrolDistance: 260 }
      ],
      movingPlatforms: [
        { startX: 736, startY: 352, endX: 736, endY: 224, width: 64, height: 16, speed: 65 },
        { startX: 1344, startY: 288, endX: 1488, endY: 288, width: 64, height: 16, speed: 75 }
      ],
      disappearingPlatforms: [
        { x: 864, y: 224, width: 64, height: 16 },
        { x: 976, y: 256, width: 64, height: 16 }
      ],
      movingTraps: [
        { startX: 420, startY: 352, endX: 520, endY: 352, radius: 16, speed: 90, type: 'saw' },
        { startX: 1100, startY: 224, endX: 1220, endY: 224, radius: 16, speed: 95, type: 'saw' },
        { startX: 1560, startY: 352, endX: 1680, endY: 352, radius: 16, speed: 90, type: 'saw' }
      ],
      lavaPits: [],
      fallingObstacles: [
        { x: 640, y: 64, width: 22, height: 30, triggerRange: 55 },
        { x: 1350, y: 64, width: 22, height: 30, triggerRange: 55 }
      ],
      decorations: [
        { type: 'gothic_banner', x: 140, y: 260 },
        { type: 'torch_sconce', x: 300, y: 310 },
        { type: 'stone_pillar', x: 700, y: 220 },
        { type: 'gothic_banner', x: 1080, y: 260 },
        { type: 'torch_sconce', x: 1240, y: 310 },
        { type: 'stone_pillar', x: 1540, y: 220 },
        { type: 'royal_throne', x: 2280, y: 310 },
        { type: 'torch_sconce', x: 2360, y: 310 }
      ],
      map: [
        buildRow([]),
        buildRow([]),
        buildRow([]),
        buildRow([]),
        buildRow([[20, '777'], [48, '8']]),
        buildRow([[18, '444444'], [46, '4444']]),
        buildRow([[8, '777'], [36, '44444']]),
        buildRow([[7, '44444']]),
        buildRow([[28, '777']]),
        buildRow([[27, '44444']]),
        buildRow([[42, '777']]),
        buildRow([[41, '44444'], [76, 'A']]),
        buildRow([[0, '1'.repeat(12)], [12, '6666'], [16, '1'.repeat(12)], [28, '6666'], [32, '1'.repeat(48)]]),
        buildRow([[0, '2'.repeat(12)], [12, '3333'], [16, '2'.repeat(12)], [28, '3333'], [32, '2'.repeat(48)]]),
        buildRow([[0, '2'.repeat(12)], [12, '3333'], [16, '2'.repeat(12)], [28, '3333'], [32, '2'.repeat(48)]])
      ]
    }
  ];

  class Level {
    constructor(levelIndex = 0) {
      this.levelIndex = levelIndex;
      this.tileSize = 32;
      this.coins = [];
      this.gems = [];
      this.tiles = [];
      this.platforms = [];
      this.traps = [];
      this.lavaPits = [];
      this.fallingObstacles = [];
      this.floatingTexts = [];
      this.sparkleParticles = [];
      this.decorations = [];
      this.enemiesData = [];
      this.width = 80;
      this.height = 15;
      this.name = 'Whispering Woods';
      this.theme = 'forest';
      this.bossRequired = false;
      this.bossDefeated = false;
      this.playerSpawn = { x: 64, y: 320 };
      this.exitPortal = { x: 2432, y: 320, width: 32, height: 48 };

      this.load(levelIndex);
    }

    load(index) {
      this.levelIndex = index;
      const data = LEVEL_DATA[index] || LEVEL_DATA[0];
      this.id = data.id || (index + 1);
      this.name = data.name;
      this.theme = data.theme;
      this.tileSize = data.tileSize || 32;
      this.width = data.width;
      this.height = data.height;
      this.playerSpawn = Object.assign({}, data.playerSpawn);
      this.skyGradient = data.skyGradient;
      this.enemiesData = data.enemies || [];
      this.decorations = data.decorations || [];
      this.bossRequired = !!data.bossRequired;
      this.bossDefeated = false;
      this.exitPortal = Object.assign({}, data.exitPortal || { x: 2432, y: 336, width: 32, height: 48 });
      this.coins = [];
      this.gems = [];
      this.tiles = [];
      this.platforms = [];
      this.traps = [];
      this.lavaPits = [];
      this.fallingObstacles = [];
      this.floatingTexts = [];
      this.sparkleParticles = [];

      // Parse tilemap
      for (let r = 0; r < data.height; r++) {
        this.tiles[r] = [];
        const rowString = data.map[r] || '';
        for (let c = 0; c < data.width; c++) {
          const char = rowString[c] || '0';
          const typeCode = parseInt(char, 16);
          this.tiles[r][c] = typeCode;

          if (typeCode === TileTypes.COIN) {
            this.coins.push({ col: c, row: r, collected: false });
          } else if (typeCode === TileTypes.GEM) {
            this.gems.push({ col: c, row: r, collected: false });
          } else if (typeCode === TileTypes.PORTAL) {
            this.exitPortal = {
              x: c * this.tileSize,
              y: r * this.tileSize - 16,
              width: this.tileSize,
              height: this.tileSize + 16
            };
          }
        }
      }

      // Moving Platforms
      if (data.movingPlatforms) {
        data.movingPlatforms.forEach(p => {
          this.platforms.push(new MovingPlatform(p.startX, p.startY, p.endX, p.endY, p.width, p.height, p.speed));
        });
      }

      // Disappearing Platforms
      if (data.disappearingPlatforms) {
        data.disappearingPlatforms.forEach(p => {
          this.platforms.push(new DisappearingPlatform(p.x, p.y, p.width, p.height));
        });
      }

      // Moving Traps
      if (data.movingTraps) {
        data.movingTraps.forEach(t => {
          this.traps.push(new MovingTrap(t.startX, t.startY, t.endX, t.endY, t.radius, t.speed, t.type));
        });
      }

      // Lava Pits
      if (data.lavaPits) {
        data.lavaPits.forEach(l => {
          this.lavaPits.push(new LavaPit(l.x, l.y, l.width, l.height));
        });
      }

      // Falling Stalactites
      if (data.fallingObstacles) {
        data.fallingObstacles.forEach(f => {
          this.fallingObstacles.push(new FallingObstacle(f.x, f.y, f.width, f.height, f.triggerRange));
        });
      }
    }

    /**
     * Spawn floating text indicator (e.g. +10 Coins, +100 Defeat)
     */
    spawnFloatingText(x, y, text, color = '#f1c40f') {
      this.floatingTexts.push(new FloatingText(x, y, text, color));
    }

    /**
     * Spawn coin collection animation (floating "+10" + radiant gold sparkles)
     */
    spawnCoinPickupEffect(x, y, points = 10) {
      this.spawnFloatingText(x, y - 8, `+${points}`, '#f1c40f');
      for (let i = 0; i < 6; i++) {
        this.sparkleParticles.push(new SparkleParticle(x, y, '#f1c40f'));
      }
    }

    /**
     * Update dynamic platforms, traps, obstacles, and effects
     */
    update(dt, player) {
      // 1. Update platforms
      for (let p of this.platforms) {
        p.update(dt);
      }

      // 2. Update moving traps
      for (let t of this.traps) {
        t.update(dt, player);
      }

      // 3. Update lava pits
      for (let l of this.lavaPits) {
        l.update(dt, player);
      }

      // 4. Update falling obstacles
      for (let f of this.fallingObstacles) {
        f.update(dt, this, player);
      }

      // 5. Update floating texts
      this.floatingTexts = this.floatingTexts.filter(txt => txt.update(dt));

      // 6. Update sparkle particles
      this.sparkleParticles = this.sparkleParticles.filter(spk => spk.update(dt));
    }

    getTile(col, row) {
      if (row < 0 || row >= this.height || col < 0 || col >= this.width) {
        if (col < 0 || col >= this.width) {
          return { type: TileTypes.STONE, isSolid: true };
        }
        return { type: TileTypes.EMPTY, isSolid: false };
      }
      const type = this.tiles[row][col];
      const props = TileProperties[type] || TileProperties[TileTypes.EMPTY];
      return Object.assign({ type }, props);
    }

    getTileAtCoords(x, y) {
      const col = Math.floor(x / this.tileSize);
      const row = Math.floor(y / this.tileSize);
      return this.getTile(col, row);
    }

    collectItemAt(col, row) {
      const tile = this.getTile(col, row);
      if (tile && tile.isCollectible) {
        this.tiles[row][col] = TileTypes.EMPTY;
        return tile.points || 10;
      }
      return 0;
    }

    renderDecorations(ctx, camera) {
      for (let d of this.decorations) {
        const dx = Math.round(d.x - camera.x);
        const dy = Math.round(d.y - camera.y);

        if (dx < -120 || dx > 920 || dy < -100 || dy > 550) continue;

        ctx.save();
        if (d.type === 'signpost') {
          ctx.fillStyle = '#6d4c41';
          ctx.fillRect(dx + 6, dy + 6, 4, 18);
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(dx, dy, 18, 10);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(dx + 5, dy + 4, 6, 2);
          ctx.fillRect(dx + 9, dy + 2, 2, 6);
        } else if (d.type === 'big_tree') {
          ctx.fillStyle = '#4e342e';
          ctx.fillRect(dx + 16, dy + 30, 24, 180);
          ctx.fillStyle = '#3e2723';
          ctx.fillRect(dx + 16, dy + 30, 6, 180);
          ctx.fillStyle = '#1e824c';
          ctx.beginPath();
          ctx.arc(dx + 28, dy + 30, 48, 0, Math.PI * 2);
          ctx.arc(dx - 6, dy + 46, 32, 0, Math.PI * 2);
          ctx.arc(dx + 62, dy + 46, 32, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2ecc71';
          ctx.beginPath();
          ctx.arc(dx + 24, dy + 18, 30, 0, Math.PI * 2);
          ctx.fill();
        } else if (d.type === 'flowers') {
          ctx.fillStyle = '#27ae60';
          ctx.fillRect(dx + 2, dy + 4, 2, 6);
          ctx.fillRect(dx + 10, dy + 3, 2, 7);
          ctx.fillStyle = '#e74c3c';
          ctx.fillRect(dx, dy + 2, 4, 3);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(dx + 9, dy + 1, 4, 3);
        } else if (d.type === 'mushrooms') {
          ctx.fillStyle = '#f5f6fa';
          ctx.fillRect(dx + 4, dy + 4, 4, 6);
          ctx.fillStyle = '#e74c3c';
          ctx.beginPath();
          ctx.arc(dx + 6, dy + 4, 8, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(dx + 3, dy + 1, 2, 2);
          ctx.fillRect(dx + 7, dy + 2, 2, 2);
        } else if (d.type === 'hanging_vines') {
          ctx.fillStyle = '#27ae60';
          for (let v = 0; v < 4; v++) {
            ctx.fillRect(dx + v * 8, dy, 3, 24 + (v % 2) * 12);
          }
        } else if (d.type === 'ancient_pillar') {
          ctx.fillStyle = '#7f8c8d';
          ctx.fillRect(dx, dy, 24, 90);
          ctx.fillStyle = '#95a5a6';
          ctx.fillRect(dx + 2, dy, 4, 90);
          ctx.fillStyle = '#2c3e50';
          ctx.fillRect(dx - 4, dy, 32, 8);
          ctx.fillRect(dx - 4, dy + 82, 32, 8);
        } else if (d.type === 'lava_crystal') {
          // Glowing volcanic red crystals
          ctx.fillStyle = '#c0392b';
          ctx.beginPath();
          ctx.moveTo(dx + 10, dy + 24);
          ctx.lineTo(dx + 14, dy);
          ctx.lineTo(dx + 18, dy + 24);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#e74c3c';
          ctx.beginPath();
          ctx.moveTo(dx + 2, dy + 24);
          ctx.lineTo(dx + 6, dy + 8);
          ctx.lineTo(dx + 10, dy + 24);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f39c12';
          ctx.fillRect(dx + 12, dy + 4, 3, 10);
        } else if (d.type === 'stalagmite') {
          // Rising cave rock spike
          ctx.fillStyle = '#2d3436';
          ctx.beginPath();
          ctx.moveTo(dx, dy + 40);
          ctx.lineTo(dx + 12, dy);
          ctx.lineTo(dx + 24, dy + 40);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#636e72';
          ctx.beginPath();
          ctx.moveTo(dx + 3, dy + 40);
          ctx.lineTo(dx + 12, dy);
          ctx.lineTo(dx + 14, dy + 40);
          ctx.closePath();
          ctx.fill();
        } else if (d.type === 'magma_vent') {
          // Smoking ground vent
          ctx.fillStyle = '#2c1b18';
          ctx.fillRect(dx, dy + 6, 26, 8);
          ctx.fillStyle = '#e74c3c';
          ctx.fillRect(dx + 4, dy + 8, 18, 4);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(dx + 8, dy + 9, 10, 2);
        } else if (d.type === 'gothic_banner') {
          // Royal castle banner
          ctx.fillStyle = '#4b1528';
          ctx.fillRect(dx, dy, 20, 36);
          ctx.fillStyle = '#8e1b30';
          ctx.fillRect(dx + 2, dy + 2, 16, 32);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(dx - 2, dy, 24, 4);
          ctx.fillRect(dx + 8, dy + 10, 4, 8);
          ctx.fillRect(dx + 6, dy + 12, 8, 4);
        } else if (d.type === 'torch_sconce') {
          // Iron torch sconce with flickering flame
          ctx.fillStyle = '#2d3436';
          ctx.fillRect(dx + 4, dy + 10, 4, 14);
          ctx.fillRect(dx + 2, dy + 8, 8, 4);
          const flick = Math.sin(Date.now() * 0.01 + dx) * 2;
          ctx.fillStyle = '#e74c3c';
          ctx.fillRect(dx + 2, dy - 2 + flick, 8, 10);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(dx + 4, dy + flick, 4, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(dx + 5, dy + 1 + flick, 2, 3);
        } else if (d.type === 'stone_pillar') {
          // Gothic castle carved pillar
          ctx.fillStyle = '#34495e';
          ctx.fillRect(dx, dy, 24, 110);
          ctx.fillStyle = '#2c3e50';
          ctx.fillRect(dx + 2, dy, 4, 110);
          ctx.fillRect(dx + 18, dy, 4, 110);
          ctx.fillStyle = '#576574';
          ctx.fillRect(dx - 4, dy, 32, 8);
          ctx.fillRect(dx - 4, dy + 102, 32, 8);
        } else if (d.type === 'royal_throne') {
          // Golden throne in boss room
          ctx.fillStyle = '#b7950b';
          ctx.fillRect(dx, dy, 28, 42);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(dx + 2, dy + 2, 24, 38);
          ctx.fillStyle = '#8e1b30'; // Velvet seat
          ctx.fillRect(dx + 4, dy + 12, 20, 24);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(dx + 10, dy - 6, 8, 8); // Crown crest
        }
        ctx.restore();
      }
    }

    render(ctx, camera) {
      // 1. Background decorations
      this.renderDecorations(ctx, camera);

      // 2. Lava Pits (drawn beneath ground tiles)
      for (let l of this.lavaPits) {
        l.draw(ctx, camera);
      }

      // 3. Tilemap
      const ts = this.tileSize;
      const startCol = Math.max(0, Math.floor(camera.x / ts));
      const endCol = Math.min(this.width - 1, Math.ceil((camera.x + camera.width) / ts));
      const startRow = Math.max(0, Math.floor(camera.y / ts));
      const endRow = Math.min(this.height - 1, Math.ceil((camera.y + camera.height) / ts));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const type = this.tiles[r][c];
          if (type === TileTypes.EMPTY) continue;

          const px = c * ts - camera.x;
          const py = r * ts - camera.y;

          this.drawTile(ctx, type, px, py, ts);
        }
      }

      // 4. Dynamic Platforms
      for (let p of this.platforms) {
        p.draw(ctx, camera);
      }

      // 5. Moving Traps & Falling Obstacles
      for (let t of this.traps) {
        t.draw(ctx, camera);
      }

      for (let f of this.fallingObstacles) {
        f.draw(ctx, camera);
      }

      // 6. Sparkle particles & floating score text
      for (let spk of this.sparkleParticles) {
        spk.draw(ctx, camera);
      }

      for (let txt of this.floatingTexts) {
        txt.draw(ctx, camera);
      }
    }

    drawTile(ctx, type, px, py, ts) {
      switch (type) {
        case TileTypes.GRASS:
          if (this.theme === 'lava') {
            // Volcanic Basalt Crust with Glowing Magma Veins
            ctx.fillStyle = '#2d1810';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(px, py, ts, 4);
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(px + 4, py + 4, 6, 2);
            ctx.fillRect(px + 18, py + 4, 8, 2);
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(px + 8, py + 12, 4, 8);
            ctx.fillRect(px + 20, py + 16, 6, 6);
          } else if (this.theme === 'castle') {
            // Gothic Stone Masonry
            ctx.fillStyle = '#34495e';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#576574';
            ctx.fillRect(px, py, ts, 4);
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(px, py + ts - 2, ts, 2);
            ctx.fillRect(px + ts - 2, py, 2, ts);
            ctx.fillStyle = '#8395a7';
            ctx.fillRect(px + 4, py + 8, 10, 4);
            ctx.fillRect(px + 18, py + 18, 10, 4);
          } else {
            // Forest Grass
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(px, py, ts, 8);
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(px + 3, py + 8, 4, 4);
            ctx.fillRect(px + 12, py + 8, 4, 5);
            ctx.fillRect(px + 22, py + 8, 5, 3);
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(px, py + 8, ts, ts - 8);
            ctx.fillStyle = '#6d4c41';
            ctx.fillRect(px + 6, py + 16, 5, 4);
            ctx.fillRect(px + 20, py + 22, 6, 4);
          }
          break;

        case TileTypes.DIRT:
          if (this.theme === 'lava') {
            ctx.fillStyle = '#1a0d0a';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#2e140f';
            ctx.fillRect(px + 4, py + 6, 8, 6);
            ctx.fillRect(px + 16, py + 18, 8, 6);
          } else if (this.theme === 'castle') {
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#2d3436';
            ctx.fillRect(px + 2, py + 2, ts - 4, 12);
            ctx.fillRect(px + 2, py + 16, ts - 4, 12);
            ctx.fillStyle = '#0f141c';
            ctx.fillRect(px, py + 14, ts, 2);
          } else {
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = '#6d4c41';
            ctx.fillRect(px + 4, py + 6, 6, 4);
            ctx.fillRect(px + 18, py + 18, 5, 5);
            ctx.fillRect(px + 8, py + 24, 4, 4);
          }
          break;

        case TileTypes.STONE:
          ctx.fillStyle = (this.theme === 'lava') ? '#2d3436' : '#7f8c8d';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = (this.theme === 'lava') ? '#636e72' : '#95a5a6';
          ctx.fillRect(px, py, ts, 2);
          ctx.fillRect(px, py, 2, ts);
          ctx.fillStyle = '#1e272e';
          ctx.fillRect(px + ts - 2, py, 2, ts);
          ctx.fillRect(px, py + ts - 2, ts, 2);
          break;

        case TileTypes.BRICK:
          ctx.fillStyle = (this.theme === 'castle') ? '#2c3e50' : '#c0392b';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = (this.theme === 'castle') ? '#34495e' : '#e74c3c';
          ctx.fillRect(px + 2, py + 2, ts - 4, 6);
          ctx.fillRect(px + 2, py + 16, ts - 4, 6);
          ctx.fillStyle = '#1a252f';
          ctx.fillRect(px, py + 14, ts, 2);
          break;

        case TileTypes.SPIKE:
          ctx.fillStyle = '#e74c3c';
          ctx.beginPath();
          ctx.moveTo(px, py + ts);
          ctx.lineTo(px + 8, py + 12);
          ctx.lineTo(px + 16, py + ts);
          ctx.lineTo(px + 24, py + 12);
          ctx.lineTo(px + ts, py + ts);
          ctx.fill();
          ctx.fillStyle = '#f39c12';
          ctx.fillRect(px + 7, py + 14, 2, 4);
          ctx.fillRect(px + 23, py + 14, 2, 4);
          break;

        case TileTypes.COIN:
          const pulse = Math.sin(Date.now() * 0.006) * 4;
          const coinW = Math.max(4, 14 + pulse);
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(px + (ts - coinW) / 2, py + 8, coinW, 16);
          ctx.fillStyle = '#f39c12';
          ctx.fillRect(px + (ts - coinW) / 2 + 2, py + 10, Math.max(2, coinW - 4), 12);
          ctx.fillStyle = '#fff9d2';
          ctx.fillRect(px + (ts - coinW) / 2 + 2, py + 10, 2, 4);
          break;

        case TileTypes.GEM:
          ctx.fillStyle = '#9b59b6';
          ctx.beginPath();
          ctx.moveTo(px + ts / 2, py + 4);
          ctx.lineTo(px + ts - 6, py + 14);
          ctx.lineTo(px + ts / 2, py + ts - 6);
          ctx.lineTo(px + 6, py + 14);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#e8d4f7';
          ctx.fillRect(px + ts / 2 - 2, py + 8, 4, 4);
          break;

        case TileTypes.PORTAL:
          const isLocked = (this.bossRequired && !this.bossDefeated);
          // Portal stone frame pillars
          ctx.fillStyle = isLocked ? '#4a1525' : '#2c3e50';
          ctx.fillRect(px, py - 16, 6, ts + 16);
          ctx.fillRect(px + ts - 6, py - 16, 6, ts + 16);
          ctx.fillRect(px, py - 16, ts, 6);

          const timeVal = Date.now() * 0.005;
          if (isLocked) {
            // Dormant / Sealed Portal (Crimson/Violet Runes + Padlock)
            ctx.fillStyle = (Math.sin(timeVal * 2) > 0) ? '#6c1524' : '#3a0815';
            ctx.fillRect(px + 6, py - 10, ts - 12, ts + 10);
            // Padlock icon
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(px + ts / 2 - 4, py + 2, 8, 8);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px + ts / 2 - 3, py - 3, 6, 5);
            ctx.fillStyle = '#3a0815';
            ctx.fillRect(px + ts / 2 - 1, py - 1, 2, 3);
          } else {
            // Radiant Active Swirling Portal
            ctx.fillStyle = (Math.sin(timeVal) > 0) ? '#00d2d3' : '#54a0ff';
            ctx.fillRect(px + 6, py - 10, ts - 12, ts + 10);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px + ts / 2 - 2, py + 4 + Math.sin(timeVal * 3) * 4, 4, 4);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(px + 8 + Math.cos(timeVal * 4) * 4, py + Math.sin(timeVal * 4) * 6, 2, 2);
          }
          break;

        default:
          break;
      }
    }
  }

  window.PixelQuest.TileTypes = TileTypes;
  window.PixelQuest.TileProperties = TileProperties;
  window.PixelQuest.MovingPlatform = MovingPlatform;
  window.PixelQuest.DisappearingPlatform = DisappearingPlatform;
  window.PixelQuest.MovingTrap = MovingTrap;
  window.PixelQuest.LavaPit = LavaPit;
  window.PixelQuest.FallingObstacle = FallingObstacle;
  window.PixelQuest.FloatingText = FloatingText;
  window.PixelQuest.SparkleParticle = SparkleParticle;
  window.PixelQuest.Level = Level;
  window.PixelQuest.LEVEL_DATA = LEVEL_DATA;

})(typeof window !== 'undefined' ? window : this);
