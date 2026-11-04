/**
 * PixelQuest - Enemies Module
 * Defines three distinct enemy types (Walking Slime, Flying Bat, Patrolling Monster),
 * automatic patrol behaviors, player collision detection, and stomp reactions.
 */

(function (window) {
  'use strict';

  window.PixelQuest = window.PixelQuest || {};

  class BaseEnemy {
    constructor(x, y, width, height, type = 'slime', points = 50) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.type = type;
      this.points = points;
      this.vx = 40; // px/s
      this.vy = 0;
      this.isDead = false;
      this.isDying = false;
      this.deathTimer = 0;
      this.facing = 'right';
      this.animTime = Math.random() * 10;
      this.deathParticles = [];
    }

    stomp() {
      if (!this.isDying && !this.isDead) {
        this.isDying = true;
        this.deathTimer = 0;
        this.vx = 0;
        this.vy = 0;
        this.spawnDeathParticles();
        if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
          window.PixelQuest.UI.audio.playEnemyStomp();
        }
        return true;
      }
      return false;
    }

    spawnDeathParticles() {
      for (let i = 0; i < 6; i++) {
        this.deathParticles.push({
          x: this.x + this.width / 2,
          y: this.y + this.height / 2,
          vx: (Math.random() - 0.5) * 120,
          vy: -60 - Math.random() * 90,
          size: Math.random() < 0.5 ? 2 : 3,
          color: this.getParticleColor(),
          life: 0.35
        });
      }
    }

    getParticleColor() {
      return '#2ecc71';
    }

    update(dt) {
      this.animTime += dt;

      // Update death particles
      for (let i = this.deathParticles.length - 1; i >= 0; i--) {
        const p = this.deathParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this.deathParticles.splice(i, 1);
        }
      }

      if (this.isDying) {
        this.deathTimer += dt;
        if (this.deathTimer > 0.35) {
          this.isDead = true;
        }
      }
    }

    render(ctx, camera) {
      // Draw death particles
      ctx.save();
      for (let p of this.deathParticles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - camera.x), Math.round(p.y - camera.y), p.size, p.size);
      }
      ctx.restore();
    }
  }

  /**
   * 1. Walking Slime Enemy
   * Squishy jelly body with pulsing bounce that patrols horizontal platforms
   */
  class SlimeEnemy extends BaseEnemy {
    constructor(x, y, patrolDistance = 96) {
      super(x, y, 26, 18, 'slime', 50);
      this.startX = x;
      this.patrolDistance = patrolDistance;
      this.minX = x - patrolDistance / 2;
      this.maxX = x + patrolDistance / 2;
      this.speed = 42; // px/s
      this.vx = this.speed;
    }

    getParticleColor() {
      return '#2ecc71';
    }

    update(dt) {
      super.update(dt);
      if (this.isDying) return;

      this.x += this.vx * dt;

      // Reverse direction at patrol edge
      if (this.x >= this.maxX) {
        this.x = this.maxX;
        this.vx = -this.speed;
        this.facing = 'left';
      } else if (this.x <= this.minX) {
        this.x = this.minX;
        this.vx = this.speed;
        this.facing = 'right';
      }
    }

    render(ctx, camera) {
      super.render(ctx, camera);
      if (this.isDead) return;

      const px = Math.round(this.x - camera.x);
      const py = Math.round(this.y - camera.y);

      // Frustum culling
      if (px + this.width < -10 || px > 810 || py + this.height < -10 || py > 460) return;

      ctx.save();

      if (this.isDying) {
        // Flattened squish
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(px - 2, py + 12, this.width + 4, 6);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(px + 2, py + 14, this.width - 4, 3);
      } else {
        const squish = Math.sin(this.animTime * 8) * 2;

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(px + this.width / 2, py + this.height, this.width / 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Slime Body (Jelly Green)
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.ellipse(
          px + this.width / 2,
          py + this.height / 2 + squish / 2,
          this.width / 2,
          (this.height / 2) - squish / 2,
          0, 0, Math.PI * 2
        );
        ctx.fill();

        // Translucent highlight
        ctx.fillStyle = '#a8e6cf';
        ctx.beginPath();
        ctx.ellipse(
          px + this.width / 2 - 2,
          py + 4 + squish / 2,
          this.width / 4,
          3,
          0, 0, Math.PI * 2
        );
        ctx.fill();

        // Eyes
        const eyeOffset = (this.facing === 'right') ? 2 : -2;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px + 7 + eyeOffset, py + 4, 4, 5);
        ctx.fillRect(px + 14 + eyeOffset, py + 4, 4, 5);

        // Pupils
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(px + 8 + eyeOffset, py + 6, 2, 3);
        ctx.fillRect(px + 15 + eyeOffset, py + 6, 2, 3);
      }
      ctx.restore();
    }
  }

  /**
   * 2. Flying Enemy (Forest Bat / Shadow Wasp)
   * Undulates vertically with a sine wave while patrolling airspace
   */
  class BatEnemy extends BaseEnemy {
    constructor(x, y, patrolDistance = 110) {
      super(x, y, 26, 20, 'bat', 75);
      this.startX = x;
      this.startY = y;
      this.patrolDistance = patrolDistance;
      this.speed = 52; // px/s
      this.vx = this.speed;
      this.waveTime = Math.random() * 10;
    }

    getParticleColor() {
      return '#8e44ad';
    }

    update(dt) {
      super.update(dt);
      if (this.isDying) return;

      this.x += this.vx * dt;
      this.waveTime += dt * 4;
      this.y = this.startY + Math.sin(this.waveTime) * 18;

      if (this.x > this.startX + this.patrolDistance / 2) {
        this.vx = -this.speed;
        this.facing = 'left';
      } else if (this.x < this.startX - this.patrolDistance / 2) {
        this.vx = this.speed;
        this.facing = 'right';
      }
    }

    render(ctx, camera) {
      super.render(ctx, camera);
      if (this.isDead) return;

      const px = Math.round(this.x - camera.x);
      const py = Math.round(this.y - camera.y);

      if (px + this.width < -10 || px > 810 || py + this.height < -10 || py > 460) return;

      ctx.save();
      const wingFlap = Math.sin(this.animTime * 14) > 0;

      if (this.isDying) {
        // Tumble downwards
        ctx.fillStyle = '#4834d4';
        ctx.fillRect(px + 8, py + 8, 10, 8);
      } else {
        // Dark purple body
        ctx.fillStyle = '#6c5ce7';
        ctx.fillRect(px + 8, py + 5, 10, 11);

        // Glowing red eyes
        ctx.fillStyle = '#ff3838';
        const eyeOffset = (this.facing === 'right') ? 1 : -1;
        ctx.fillRect(px + 9 + eyeOffset, py + 7, 2, 2);
        ctx.fillRect(px + 15 + eyeOffset, py + 7, 2, 2);

        // Pointy ears
        ctx.fillStyle = '#4834d4';
        ctx.fillRect(px + 8, py + 2, 3, 3);
        ctx.fillRect(px + 15, py + 2, 3, 3);

        // Animated Wings
        ctx.fillStyle = '#2d3436';
        if (wingFlap) {
          // Wings Up
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 7);
          ctx.lineTo(px, py - 3);
          ctx.lineTo(px + 6, py + 12);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(px + 18, py + 7);
          ctx.lineTo(px + 26, py - 3);
          ctx.lineTo(px + 20, py + 12);
          ctx.closePath();
          ctx.fill();
        } else {
          // Wings Down
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 7);
          ctx.lineTo(px, py + 15);
          ctx.lineTo(px + 6, py + 10);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(px + 18, py + 7);
          ctx.lineTo(px + 26, py + 15);
          ctx.lineTo(px + 20, py + 10);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  /**
   * 3. Patrolling Monster (Armored Forest Ogre / Patrol Guard)
   * Menacing armored creature with horned helmet and spiked club
   */
  class PatrollingMonster extends BaseEnemy {
    constructor(x, y, patrolDistance = 120) {
      super(x, y, 28, 32, 'monster', 100);
      this.startX = x;
      this.patrolDistance = patrolDistance;
      this.minX = x - patrolDistance / 2;
      this.maxX = x + patrolDistance / 2;
      this.speed = 36; // px/s
      this.vx = this.speed;
      this.walkFrame = 0;
    }

    getParticleColor() {
      return '#e67e22';
    }

    update(dt) {
      super.update(dt);
      if (this.isDying) return;

      this.x += this.vx * dt;
      this.walkFrame = Math.floor(this.animTime * 6) % 4;

      if (this.x >= this.maxX) {
        this.x = this.maxX;
        this.vx = -this.speed;
        this.facing = 'left';
      } else if (this.x <= this.minX) {
        this.x = this.minX;
        this.vx = this.speed;
        this.facing = 'right';
      }
    }

    render(ctx, camera) {
      super.render(ctx, camera);
      if (this.isDead) return;

      const px = Math.round(this.x - camera.x);
      const py = Math.round(this.y - camera.y);

      if (px + this.width < -10 || px > 810 || py + this.height < -10 || py > 460) return;

      ctx.save();

      // Mirror when facing left
      if (this.facing === 'left') {
        ctx.translate(px + this.width, py);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(px, py);
      }

      if (this.isDying) {
        // Crumbled armor on ground
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(4, 24, 20, 8);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(10, 26, 6, 4);
      } else {
        const bob = (this.walkFrame % 2 === 0) ? 1 : 0;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(14, 31, 11, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Horned Iron Helmet
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(6, 2 + bob, 16, 9);
        // Horns
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(4, 0 + bob, 3, 4);
        ctx.fillRect(21, 0 + bob, 3, 4);

        // Monster Face & Glowing Red Eyes
        ctx.fillStyle = '#1e372f'; // Dark green orc skin
        ctx.fillRect(7, 10 + bob, 14, 6);
        ctx.fillStyle = '#e74c3c'; // Evil red eyes
        ctx.fillRect(14, 11 + bob, 3, 3);
        ctx.fillStyle = '#ffffff'; // White fangs
        ctx.fillRect(11, 14 + bob, 2, 2);
        ctx.fillRect(17, 14 + bob, 2, 2);

        // Armored Torso
        ctx.fillStyle = '#d35400'; // Leather/metal breastplate
        ctx.fillRect(5, 16 + bob, 18, 9);
        ctx.fillStyle = '#7f8c8d'; // Iron belt
        ctx.fillRect(5, 23 + bob, 18, 2);

        // Spiked Wooden Club in Hand
        ctx.fillStyle = '#6d4c41'; // Club handle
        ctx.fillRect(20, 14 + bob, 4, 12);
        ctx.fillStyle = '#8d6e63'; // Club head
        ctx.fillRect(22, 10 + bob, 7, 7);
        ctx.fillStyle = '#f1c40f'; // Iron spike on club
        ctx.fillRect(28, 12 + bob, 3, 3);

        // Heavy Iron Stomping Boots
        ctx.fillStyle = '#2c3e50';
        const stride = (this.walkFrame === 0) ? 2 : (this.walkFrame === 2 ? -2 : 0);
        ctx.fillRect(6 + stride, 25, 6, 7);
        ctx.fillRect(16 - stride, 25, 6, 7);
      }

      ctx.restore();
    }
  }

  /**
   * 4. Boss Enemy: Dark Overlord
   * Heavy armored boss guarding the Dark Castle throne room.
   * Features 3-hit health bar, leaping ground-pound attacks, invulnerability frames,
   * weapon swings, and unlocks the level victory portal upon defeat!
   */
  class BossEnemy extends BaseEnemy {
    constructor(x, y, patrolDistance = 240) {
      super(x, y, 44, 48, 'boss', 1000);
      this.startX = x;
      this.patrolDistance = patrolDistance;
      this.minX = x - patrolDistance / 2;
      this.maxX = x + patrolDistance / 2;
      this.maxHp = 3;
      this.hp = 3;
      this.vx = 48;
      this.vy = 0;
      this.gravity = 980;
      this.groundY = y;
      this.state = 'PATROL'; // 'PATROL', 'CHARGE', 'JUMP_PREP', 'SLAM', 'STUNNED'
      this.stateTimer = 0;
      this.invulnerableTimer = 0;
      this.walkFrame = 0;
      this.walkTimer = 0;
      this.facing = 'left';
    }

    getParticleColor() {
      return '#e74c3c';
    }

    spawnDeathParticles() {
      for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 140;
        this.deathParticles.push({
          x: this.x + this.width / 2,
          y: this.y + this.height / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          size: Math.random() < 0.5 ? 3 : 5,
          color: ['#e74c3c', '#f1c40f', '#8e44ad', '#ecf0f1'][Math.floor(Math.random() * 4)],
          life: 0.8
        });
      }
    }

    stomp(player) {
      if (this.isDying || this.isDead) return false;
      if (this.invulnerableTimer > 0) {
        // Boss is flashing i-frames; still bounce player off
        return 'invulnerable';
      }

      this.hp--;
      this.invulnerableTimer = 1.2;

      if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
        window.PixelQuest.UI.audio.playTone(220, 80, 0.25, 'sawtooth', 0.25);
      }
      if (window.PixelQuest.gameInstance) {
        window.PixelQuest.gameInstance.triggerShake(0.25, 5);
      }

      if (this.hp <= 0) {
        this.isDying = true;
        this.deathTimer = 0;
        this.vx = 0;
        this.vy = 0;
        this.spawnDeathParticles();
        if (window.PixelQuest.gameInstance && window.PixelQuest.gameInstance.currentLevel) {
          window.PixelQuest.gameInstance.currentLevel.bossDefeated = true;
        }
        return 'defeated';
      }

      return 'hit';
    }

    update(dt, level) {
      super.update(dt);
      if (this.isDying || this.isDead) return;

      if (this.invulnerableTimer > 0) {
        this.invulnerableTimer -= dt;
      }

      this.stateTimer += dt;
      this.walkTimer += dt;
      if (this.walkTimer >= 0.16) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }

      // Boss AI State Machine
      if (this.state === 'PATROL') {
        this.x += this.vx * dt;
        if (this.x < this.minX) {
          this.x = this.minX;
          this.vx = Math.abs(this.vx);
          this.facing = 'right';
        } else if (this.x + this.width > this.maxX) {
          this.x = this.maxX - this.width;
          this.vx = -Math.abs(this.vx);
          this.facing = 'left';
        }

        // Leaping ground slam attack every ~3.5 seconds
        if (this.stateTimer > 3.5) {
          this.state = 'JUMP_PREP';
          this.stateTimer = 0;
          this.vx = 0;
        }
      } else if (this.state === 'JUMP_PREP') {
        if (this.stateTimer > 0.4) {
          this.state = 'SLAM';
          this.stateTimer = 0;
          this.vy = -380;
          this.vx = (this.facing === 'right' ? 90 : -90);
        }
      } else if (this.state === 'SLAM') {
        this.vy += this.gravity * dt;
        this.y += this.vy * dt;
        this.x += this.vx * dt;

        // Ground landing check
        if (this.y >= this.groundY) {
          this.y = this.groundY;
          this.vy = 0;
          this.state = 'STUNNED';
          this.stateTimer = 0;
          this.vx = 0;

          if (window.PixelQuest.gameInstance) {
            window.PixelQuest.gameInstance.triggerShake(0.3, 6);
          }
          if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
            window.PixelQuest.UI.audio.playTone(130, 40, 0.28, 'triangle', 0.25);
          }
        }
      } else if (this.state === 'STUNNED') {
        if (this.stateTimer > 0.8) {
          this.state = 'PATROL';
          this.stateTimer = 0;
          this.vx = (this.facing === 'right' ? 52 : -52);
        }
      }
    }

    render(ctx, camera) {
      super.render(ctx, camera);
      if (this.isDead || this.isDying) return;

      const drawX = Math.round(this.x - camera.x);
      const drawY = Math.round(this.y - camera.y);

      // Flash effect if in i-frames
      if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
        return;
      }

      ctx.save();
      ctx.translate(drawX, drawY);

      if (this.facing === 'left') {
        ctx.scale(-1, 1);
        ctx.translate(-this.width, 0);
      }

      const bob = (this.state === 'PATROL' && this.walkFrame % 2 === 1) ? 2 : 0;
      const prepSquash = (this.state === 'JUMP_PREP') ? 4 : 0;

      // 1. Dark billowy cape
      ctx.fillStyle = '#6c1524';
      ctx.fillRect(-6, 14 + bob, 8, 28);
      ctx.fillStyle = '#8e1b30';
      ctx.fillRect(-4, 16 + bob, 5, 24);

      // 2. Armored Legs & Stomping Greaves
      ctx.fillStyle = '#1e272e';
      const legOffset = (this.state === 'PATROL') ? (this.walkFrame === 0 ? 3 : (this.walkFrame === 2 ? -3 : 0)) : 0;
      ctx.fillRect(8 + legOffset, 36 - prepSquash, 10, 12 + prepSquash);
      ctx.fillRect(24 - legOffset, 36 - prepSquash, 10, 12 + prepSquash);
      // Gold sabatons trim
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(6 + legOffset, 45, 12, 3);
      ctx.fillRect(22 - legOffset, 45, 12, 3);

      // 3. Heavy Armored Torso & Pauldrons
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(6, 16 + bob, 32, 22);
      ctx.fillStyle = '#636e72';
      ctx.fillRect(9, 18 + bob, 26, 18);
      // Gold imperial skull crest on breastplate
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(19, 22 + bob, 6, 6);
      ctx.fillRect(20, 28 + bob, 4, 3);

      // Spiked Pauldrons (Shoulders)
      ctx.fillStyle = '#d63031';
      ctx.fillRect(2, 14 + bob, 8, 10);
      ctx.fillRect(34, 14 + bob, 8, 10);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(4, 11 + bob, 4, 3);
      ctx.fillRect(36, 11 + bob, 4, 3);

      // 4. Horned Obsidian Helm & Glowing Visor
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(10, 2 + bob + prepSquash, 24, 16);
      // Gold Horns
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(6, -4 + bob + prepSquash, 4, 8);
      ctx.fillRect(34, -4 + bob + prepSquash, 4, 8);
      ctx.fillRect(4, -8 + bob + prepSquash, 4, 6);
      ctx.fillRect(36, -8 + bob + prepSquash, 4, 6);

      // Glowing crimson visor eyes
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(18, 9 + bob + prepSquash, 12, 4);
      ctx.fillStyle = '#ff7675';
      ctx.fillRect(20, 10 + bob + prepSquash, 8, 2);

      // 5. Giant Spiked War Mace in hand
      ctx.fillStyle = '#636e72';
      ctx.fillRect(36, 16 + bob, 5, 20); // Handle
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(33, 10 + bob, 11, 10); // Mace head
      ctx.fillStyle = '#e74c3c'; // Spikes
      ctx.fillRect(38, 6 + bob, 3, 4);
      ctx.fillRect(30, 13 + bob, 3, 4);
      ctx.fillRect(44, 13 + bob, 3, 4);

      ctx.restore();

      // 6. Overhead Boss Name & Segmented Health Bar
      this.renderHealthBar(ctx, drawX, drawY);
    }

    renderHealthBar(ctx, drawX, drawY) {
      const barW = 64;
      const barH = 7;
      const barX = drawX + (this.width - barW) / 2;
      const barY = drawY - 20;

      ctx.save();
      // Boss Title
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText('OVERLORD', drawX + this.width / 2 + 1, barY - 4);
      ctx.fillStyle = '#f1c40f';
      ctx.fillText('OVERLORD', drawX + this.width / 2, barY - 5);

      // Bar Border & Background
      ctx.fillStyle = '#000000';
      ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
      ctx.fillStyle = '#333333';
      ctx.fillRect(barX, barY, barW, barH);

      // 3 Segments
      const segmentW = (barW - 4) / 3;
      for (let i = 0; i < 3; i++) {
        const segX = barX + 1 + i * (segmentW + 1);
        if (i < this.hp) {
          ctx.fillStyle = '#e74c3c';
          ctx.fillRect(segX, barY + 1, segmentW, barH - 2);
          ctx.fillStyle = '#ff7675';
          ctx.fillRect(segX, barY + 1, segmentW, 2);
        } else {
          ctx.fillStyle = '#4a1515';
          ctx.fillRect(segX, barY + 1, segmentW, barH - 2);
        }
      }

      ctx.restore();
    }
  }

  /**
   * Enemy Manager
   * Maintains active enemies, handles movement and collision detection
   */
  class EnemyManager {
    constructor() {
      this.enemies = [];
    }

    loadFromLevel(levelData) {
      this.enemies = [];
      if (!levelData || !levelData.enemiesData) return;

      levelData.enemiesData.forEach(e => {
        if (e.type === 'slime') {
          this.enemies.push(new SlimeEnemy(e.x, e.y, e.patrolDistance || 96));
        } else if (e.type === 'bat') {
          this.enemies.push(new BatEnemy(e.x, e.y, e.patrolDistance || 100));
        } else if (e.type === 'monster') {
          this.enemies.push(new PatrollingMonster(e.x, e.y, e.patrolDistance || 120));
        } else if (e.type === 'boss') {
          this.enemies.push(new BossEnemy(e.x, e.y, e.patrolDistance || 240));
        }
      });
    }

    update(dt, level, player) {
      this.enemies = this.enemies.filter(e => !e.isDead);

      for (let enemy of this.enemies) {
        enemy.update(dt, level);

        // Check player collision
        if (player && !enemy.isDying && window.PixelQuest.Collision) {
          if (window.PixelQuest.Collision.checkAABB(player, enemy)) {
            const playerBottom = player.y + player.height;
            const enemyTop = enemy.y;
            const isFalling = player.vy > 0;

            // Player jumped on enemy's head from above -> Defeat or Damage enemy!
            if (isFalling && playerBottom <= enemyTop + 18) {
              const res = enemy.stomp(player);
              player.vy = -360; // Stomp bounce upward!
              player.isGrounded = false;
              player.isJumping = true;

              if (res === true || res === 'defeated') {
                player.score += enemy.points;
                if (level && level.spawnFloatingText) {
                  level.spawnFloatingText(enemy.x + enemy.width / 2, enemy.y, `+${enemy.points}`, '#2ecc71');
                }
              } else if (res === 'hit') {
                if (level && level.spawnFloatingText) {
                  level.spawnFloatingText(enemy.x + enemy.width / 2, enemy.y, 'HIT! -1 HP', '#f1c40f');
                }
              }
            } else {
              // Enemy touches player from side/bottom -> Decrease one life
              player.takeDamage(1);
            }
          }
        }
      }
    }

    render(ctx, camera) {
      for (let enemy of this.enemies) {
        enemy.render(ctx, camera);
      }
    }
  }

  window.PixelQuest.BaseEnemy = BaseEnemy;
  window.PixelQuest.SlimeEnemy = SlimeEnemy;
  window.PixelQuest.BatEnemy = BatEnemy;
  window.PixelQuest.PatrollingMonster = PatrollingMonster;
  window.PixelQuest.BossEnemy = BossEnemy;
  window.PixelQuest.EnemyManager = EnemyManager;

})(typeof window !== 'undefined' ? window : this);
