/**
 * PixelQuest - Player Character & Movement Module
 * Implements frame-rate independent physics, smooth horizontal acceleration,
 * realistic gravity and variable jumping, tile collision, world boundaries,
 * and a cute animated pixel-art adventurer with idle, running, jumping,
 * and falling animations.
 */

(function (window) {
  'use strict';

  window.PixelQuest = window.PixelQuest || {};

  class Player {
    constructor(x = 64, y = 320) {
      this.spawnX = x;
      this.spawnY = y;
      this.x = x;
      this.y = y;

      // Hitbox dimensions (fits standard 32px grid passages)
      this.width = 22;
      this.height = 30;

      // Velocities in pixels per second (px/s)
      this.vx = 0;
      this.vy = 0;

      // Frame-rate independent physics constants (in px/s and px/s^2)
      this.moveAcceleration = 1200;      // Ground acceleration
      this.airAcceleration = 750;        // Air acceleration (slightly looser air control)
      this.groundDeceleration = 1400;    // Ground friction / brake
      this.airDeceleration = 400;        // Air resistance
      this.turnAcceleration = 2200;      // Snappy turning when pressing opposite direction
      this.maxSpeed = 190;               // Maximum horizontal running speed (~6 tiles/sec)

      this.jumpForce = -420;             // Initial upward jump velocity (~3.5 tiles arc)
      this.gravity = 980;                // Base downward gravity
      this.fallGravity = 1400;           // Snappy fall gravity (prevents floatiness)
      this.maxFallSpeed = 500;           // Terminal fall velocity
      this.jumpCutoffDamping = 0.5;      // Variable jump height cutoff when releasing key early

      // Platform & Jump State Flags
      this.isGrounded = false;
      this.wasGrounded = false;
      this.isJumping = false;
      this.facing = 'right';             // 'left' or 'right'

      // Input Buffering & Coyote Time (in seconds)
      this.coyoteTimer = 0;
      this.coyoteWindow = 0.12;          // 120ms grace window after leaving ledge
      this.jumpBufferTimer = 0;
      this.jumpBufferWindow = 0.14;      // 140ms pre-landing jump buffer

      // Health and inventory
      this.maxHealth = 3;
      this.health = 3;
      this.score = 0;
      this.coins = 0;
      this.invincible = false;
      this.invincibleTimer = 0;
      this.ridingPlatform = null;

      // Animation & Visual State
      this.animState = 'IDLE';           // 'IDLE', 'RUN', 'JUMP', 'FALL', 'HURT'
      this.animTime = 0;
      this.animFrame = 0;
      this.blinkTimer = 2.5;             // Periodic eye-blink timer
      this.isBlinking = false;
      this.landingSquashTimer = 0;       // Visual squash on landing

      // Footstep & Landing Dust Particles
      this.dustParticles = [];
      this.dustTimer = 0;
    }

    /**
     * Reset player position, velocities, status, and particles
     */
    reset(x = this.spawnX, y = this.spawnY) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.isGrounded = false;
      this.wasGrounded = false;
      this.isJumping = false;
      this.ridingPlatform = null;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.invincible = false;
      this.invincibleTimer = 0;
      this.health = this.maxHealth;
      this.animState = 'IDLE';
      this.animTime = 0;
      this.animFrame = 0;
      this.dustParticles = [];
      this.landingSquashTimer = 0;
    }

    /**
     * Process player controls and apply acceleration
     * @param {Object} input - { left, right, jump, jumpPressed, down }
     * @param {number} dt - delta time in seconds
     */
    handleInput(input, dt) {
      if (!input || dt <= 0) return;

      const onGround = this.isGrounded;

      // 1. Horizontal Movement & Smooth Acceleration
      if (input.left && !input.right) {
        this.facing = 'left';
        if (this.vx > 0) {
          // Quick turn-around brake
          this.vx -= this.turnAcceleration * dt;
        } else {
          const accel = onGround ? this.moveAcceleration : this.airAcceleration;
          this.vx = Math.max(-this.maxSpeed, this.vx - accel * dt);
        }
      } else if (input.right && !input.left) {
        this.facing = 'right';
        if (this.vx < 0) {
          // Quick turn-around brake
          this.vx += this.turnAcceleration * dt;
        } else {
          const accel = onGround ? this.moveAcceleration : this.airAcceleration;
          this.vx = Math.min(this.maxSpeed, this.vx + accel * dt);
        }
      } else {
        // No horizontal input: smooth deceleration to stop
        const decel = onGround ? this.groundDeceleration : this.airDeceleration;
        if (this.vx > 0) {
          this.vx = Math.max(0, this.vx - decel * dt);
        } else if (this.vx < 0) {
          this.vx = Math.min(0, this.vx + decel * dt);
        }
      }

      // 2. Jump Input & Buffering
      if (input.jumpPressed) {
        this.jumpBufferTimer = this.jumpBufferWindow;
      }

      // Jump execution: allowed ONLY when on a platform or within coyote window
      if (this.jumpBufferTimer > 0 && (this.isGrounded || this.coyoteTimer > 0)) {
        this.jump();
      }

      // 3. Variable Jump Height: early release dampens upward velocity
      if (!input.jump && this.vy < -100 && this.isJumping) {
        this.vy *= this.jumpCutoffDamping;
      }
    }

    /**
     * Execute a jump action
     */
    jump() {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      this.isJumping = true;
      this.ridingPlatform = null;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;

      // Spawn takeoff dust puff
      this.spawnDust(this.x + this.width / 2, this.y + this.height, 3);

      // Play retro jump sound effect
      if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
        window.PixelQuest.UI.audio.playJump();
      }
    }

    /**
     * Apply damage to player with invincibility frames and knockback
     * @param {number} amount
     */
    takeDamage(amount = 1) {
      if (this.invincible || this.health <= 0) return false;

      this.health = Math.max(0, this.health - amount);
      this.invincible = true;
      this.invincibleTimer = 1.5; // 1.5s invincibility frames
      this.animState = 'HURT';

      // Snappy knockback
      this.vy = -260;
      this.vx = (this.facing === 'right') ? -140 : 140;

      if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
        window.PixelQuest.UI.audio.playHurt();
      }

      // Camera screen shake if available
      if (window.PixelQuest.gameInstance) {
        window.PixelQuest.gameInstance.triggerShake(0.25, 4);
      }

      return true;
    }

    /**
     * Main update function - physics, collisions, boundaries, animations
     * Frame-rate independent: all calculations scaled by dt
     * @param {number} dt - delta time in seconds
     * @param {Object} level - active level instance
     */
    update(dt, level) {
      if (dt <= 0) return;

      // Countdown timers
      if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
      if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
      if (this.landingSquashTimer > 0) this.landingSquashTimer -= dt;

      if (this.invincible) {
        this.invincibleTimer -= dt;
        if (this.invincibleTimer <= 0) {
          this.invincible = false;
        }
      }

      // Apply Gravity (stronger downward gravity when falling for realistic snappy arc)
      const currentGravity = (this.vy > 0) ? this.fallGravity : this.gravity;
      this.vy += currentGravity * dt;
      if (this.vy > this.maxFallSpeed) {
        this.vy = this.maxFallSpeed;
      }

      // 1. Horizontal Movement & Tile Collision
      this.x += this.vx * dt;
      if (level) {
        this.resolveHorizontalTiles(level);
      }

      // 2. Vertical Movement & Tile Collision
      this.wasGrounded = this.isGrounded;
      this.isGrounded = false;
      const prevY = this.y;
      this.y += this.vy * dt;
      if (level) {
        this.resolveVerticalTiles(level);
        this.resolveDynamicPlatforms(level, prevY, dt);
      }

      // Detect Landing from a Fall
      if (!this.wasGrounded && this.isGrounded) {
        this.landingSquashTimer = 0.08; // 80ms landing squash
        this.spawnDust(this.x + this.width / 2, this.y + this.height, 4);
      }

      // Coyote time trigger: activate window when walking off platform edge without jumping
      if (this.wasGrounded && !this.isGrounded && this.vy >= 0 && !this.isJumping) {
        this.coyoteTimer = this.coyoteWindow;
      }

      // 3. Keep Player Within Game World Boundaries
      this.constrainWorldBoundaries(level);

      // 4. Interactive Tile Triggers (Coins, Gems, Hazards, Portal)
      if (level) {
        this.checkInteractables(level);
      }

      // 5. Update Animation State & Dust Particles
      this.updateAnimation(dt);
      this.updateDustParticles(dt);
    }

    /**
     * Enforce strict world boundaries
     * Clamps player inside the level bounds and handles death pit
     */
    constrainWorldBoundaries(level) {
      if (!level) return;

      const levelPixelWidth = level.width * level.tileSize;
      const levelPixelHeight = level.height * level.tileSize;

      // Left boundary
      if (this.x < 0) {
        this.x = 0;
        if (this.vx < 0) this.vx = 0;
      }

      // Right boundary
      const maxX = levelPixelWidth - this.width;
      if (this.x > maxX) {
        this.x = maxX;
        if (this.vx > 0) this.vx = 0;
      }

      // Top boundary (ceiling)
      if (this.y < 0) {
        this.y = 0;
        if (this.vy < 0) this.vy = 0;
      }

      // Bottom boundary (pit hazard): falling into bottomless gaps triggers player death
      if (this.y > levelPixelHeight + 16) {
        this.health = 0;
        this.animState = 'DEAD';
      }
    }

    /**
     * Resolve collisions with solid tiles along horizontal axis
     */
    resolveHorizontalTiles(level) {
      const ts = level.tileSize;
      const startCol = Math.floor(this.x / ts);
      const endCol = Math.floor((this.x + this.width) / ts);
      const startRow = Math.floor(this.y / ts);
      const endRow = Math.floor((this.y + this.height - 1) / ts);

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = level.getTile(c, r);
          if (tile && tile.isSolid && !tile.isOneWay) {
            if (this.vx > 0) {
              this.x = c * ts - this.width;
              this.vx = 0;
            } else if (this.vx < 0) {
              this.x = (c + 1) * ts;
              this.vx = 0;
            }
          }
        }
      }
    }

    /**
     * Resolve collisions with solid tiles and platforms along vertical axis
     */
    resolveVerticalTiles(level) {
      const ts = level.tileSize;
      const startCol = Math.floor(this.x / ts);
      const endCol = Math.floor((this.x + this.width) / ts);
      const startRow = Math.floor(this.y / ts);
      const endRow = Math.floor((this.y + this.height) / ts);

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = level.getTile(c, r);
          if (!tile) continue;

          // Standard solid tile collision
          if (tile.isSolid) {
            if (this.vy > 0) {
              // Landing on top of tile
              this.y = r * ts - this.height;
              this.vy = 0;
              this.isGrounded = true;
              this.isJumping = false;
            } else if (this.vy < 0 && !tile.isOneWay) {
              // Bumping head on solid ceiling
              this.y = (r + 1) * ts;
              this.vy = 0;
            }
          }
        }
      }
    }

    /**
     * Resolve collisions with dynamic platforms (Moving & Disappearing)
     * Allows landing on top without passing through, and carries the player along moving platforms.
     */
    resolveDynamicPlatforms(level, prevY, dt) {
      if (!level || !level.platforms || level.platforms.length === 0) return;

      for (let p of level.platforms) {
        if (!p.isSolid) {
          if (this.ridingPlatform === p) {
            this.ridingPlatform = null;
          }
          continue;
        }

        const overlapX = (this.x + this.width > p.x + 2) && (this.x < p.x + p.width - 2);
        const prevBottom = prevY + this.height;
        const currentBottom = this.y + this.height;
        const platformTop = p.y;

        // Land on top if falling onto platform surface
        if (overlapX && this.vy >= 0 && prevBottom <= platformTop + 8 && currentBottom >= platformTop) {
          this.y = platformTop - this.height;
          this.vy = 0;
          this.isGrounded = true;
          this.isJumping = false;
          this.ridingPlatform = p;

          if (typeof p.stepOn === 'function') {
            p.stepOn();
          }
        }
      }

      // Smoothly carry the player if currently standing on a moving platform
      if (this.ridingPlatform && this.isGrounded) {
        const p = this.ridingPlatform;
        const stillOnPlatform = (this.x + this.width > p.x) && (this.x < p.x + p.width);
        if (!stillOnPlatform || !p.isSolid) {
          this.ridingPlatform = null;
        } else if (p.isMoving) {
          this.x += p.vx * dt;
          this.y = p.y - this.height;
        }
      }
    }

    /**
     * Check collisions with coins, gems, hazard spikes, and portals
     */
    checkInteractables(level) {
      const ts = level.tileSize;
      const startCol = Math.floor(this.x / ts);
      const endCol = Math.floor((this.x + this.width - 1) / ts);
      const startRow = Math.floor(this.y / ts);
      const endRow = Math.floor((this.y + this.height - 1) / ts);

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = level.getTile(c, r);
          if (!tile) continue;

          if (tile.isCollectible) {
            const points = level.collectItemAt(c, r);
            if (points > 0) {
              this.score += points; // +10 for coin!
              this.coins += 1;
              if (window.PixelQuest.UI && window.PixelQuest.UI.audio) {
                window.PixelQuest.UI.audio.playCoin();
              }
              if (typeof level.spawnCoinPickupEffect === 'function') {
                level.spawnCoinPickupEffect(c * ts + ts / 2, r * ts + ts / 2, points);
              }
            }
          } else if (tile.isHazard) {
            this.takeDamage(tile.damage || 1);
          }
        }
      }
    }

    /**
     * Update animation cycles and timing
     */
    updateAnimation(dt) {
      this.animTime += dt;

      // Eye blink timer for cute idle face
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        if (this.blinkTimer <= -0.15) {
          this.isBlinking = false;
          this.blinkTimer = 2.5 + Math.random() * 2.0;
        }
      }

      // Determine current animation state
      if (this.health <= 0) {
        this.animState = 'DEAD';
      } else if (this.invincible && this.animState === 'HURT') {
        // Maintain hurt expression during initial knockback
      } else if (!this.isGrounded) {
        this.animState = (this.vy < 0) ? 'JUMP' : 'FALL';
      } else if (Math.abs(this.vx) > 15) {
        this.animState = 'RUN';
        // Spawn footstep running dust
        this.dustTimer += dt;
        if (this.dustTimer > 0.16) {
          this.dustTimer = 0;
          this.spawnDust(
            this.x + (this.facing === 'right' ? 4 : this.width - 4),
            this.y + this.height,
            1
          );
        }
      } else {
        this.animState = 'IDLE';
      }

      // 4-frame running animation cycle
      if (this.animState === 'RUN') {
        this.animFrame = Math.floor(this.animTime * 10) % 4;
      } else {
        this.animFrame = 0;
      }
    }

    /**
     * Spawn dust puff particles at feet
     */
    spawnDust(x, y, count = 2) {
      for (let i = 0; i < count; i++) {
        this.dustParticles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y - 2,
          vx: (Math.random() - 0.5) * 30,
          vy: -15 - Math.random() * 25,
          size: Math.random() < 0.5 ? 2 : 3,
          life: 0.25,
          maxLife: 0.25,
          color: Math.random() < 0.5 ? '#d2dae2' : '#808e9b'
        });
      }
    }

    /**
     * Update dust particles
     */
    updateDustParticles(dt) {
      for (let i = this.dustParticles.length - 1; i >= 0; i--) {
        const p = this.dustParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          this.dustParticles.splice(i, 1);
        }
      }
    }

    /**
     * Separate draw() function - renders cute pixel-art adventurer & particles
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} camera - { x, y }
     */
    draw(ctx, camera) {
      // 1. Draw footstep & landing dust particles
      this.drawDustParticles(ctx, camera);

      // 2. Invincibility flicker effect
      if (this.invincible && Math.floor(Date.now() / 70) % 2 === 0) {
        return;
      }

      const drawX = Math.round(this.x - camera.x);
      const drawY = Math.round(this.y - camera.y);

      ctx.save();

      // Soft ground contact shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(drawX + this.width / 2, drawY + this.height - 1, 9, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal flip based on facing direction
      if (this.facing === 'left') {
        ctx.translate(drawX + this.width, drawY);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(drawX, drawY);
      }

      // Render the cute pixel-art adventurer
      this.drawCuteAdventurer(ctx);

      ctx.restore();
    }

    /**
     * Alias for draw() to maintain API backwards compatibility
     */
    render(ctx, camera) {
      this.draw(ctx, camera);
    }

    /**
     * Draw dust particles on canvas
     */
    drawDustParticles(ctx, camera) {
      ctx.save();
      for (let p of this.dustParticles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(
          Math.round(p.x - camera.x),
          Math.round(p.y - camera.y),
          p.size,
          p.size
        );
      }
      ctx.restore();
    }

    /**
     * Procedural Cute Pixel-Art Adventurer Character
     * 22x30 pixel grid with distinctive character charm
     */
    drawCuteAdventurer(ctx) {
      // Calculate squash & stretch offsets based on animation state
      let bobY = 0;
      let squashX = 0;
      let squashY = 0;

      if (this.landingSquashTimer > 0) {
        // Landing impact squash
        squashX = 2;
        squashY = -2;
      } else if (this.animState === 'IDLE') {
        // Gentle breathing bob
        bobY = (Math.sin(this.animTime * 3.5) > 0) ? 1 : 0;
      } else if (this.animState === 'JUMP') {
        // Upward stretch
        squashX = -1;
        squashY = 2;
      } else if (this.animState === 'FALL') {
        // Downward weight
        squashX = 1;
        squashY = -1;
      }

      // --- 1. Satchel / Backpack (Rendered behind body) ---
      ctx.fillStyle = '#8d6e63'; // Leather bag
      ctx.fillRect(1, 14 + bobY, 5, 8);
      ctx.fillStyle = '#f1c40f'; // Brass satchel buckle
      ctx.fillRect(2, 17 + bobY, 2, 2);

      // --- 2. Cap Feather (Flutters in wind) ---
      ctx.fillStyle = '#e74c3c'; // Crimson feather
      const featherFlutter = (this.animState === 'RUN') ? Math.sin(this.animTime * 15) * 2 : 0;
      ctx.fillRect(4, 1 + bobY + featherFlutter, 3, 4);
      ctx.fillRect(6, 0 + bobY + featherFlutter, 2, 2);

      // --- 3. Green Adventurer Cap ---
      ctx.fillStyle = '#27ae60'; // Dark forest green cap
      ctx.fillRect(5, 4 + bobY, 14, 7);
      ctx.fillStyle = '#2ecc71'; // Cap highlight
      ctx.fillRect(7, 3 + bobY, 10, 3);
      // Cap Brim
      ctx.fillStyle = '#1e8449';
      ctx.fillRect(4, 9 + bobY, 16, 2);
      // Golden Cap Pin
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(7, 6 + bobY, 2, 3);

      // --- 4. Chestnut Bangs / Hair ---
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(6, 11 + bobY, 3, 2);
      ctx.fillRect(16, 11 + bobY, 3, 2);
      ctx.fillRect(4, 11 + bobY, 2, 4);

      // --- 5. Cute Face & Big Expressive Eyes ---
      ctx.fillStyle = '#fcd5a0'; // Warm skin tone
      ctx.fillRect(6, 11 + bobY, 12, 7);

      // Rosy Cheeks
      ctx.fillStyle = '#ff7675';
      ctx.fillRect(6, 16 + bobY, 2, 1);
      ctx.fillRect(15, 16 + bobY, 2, 1);

      // Eyes with specularity & blinking
      if (this.isBlinking) {
        // Closed / blinking eye slit
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(12, 14 + bobY, 4, 1);
      } else {
        // Big cute pupil
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(12, 12 + bobY, 4, 4);
        // Specular white highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(12, 12 + bobY, 2, 2);
      }

      // --- 6. Adventurer Tunic & Collar ---
      ctx.fillStyle = '#3498db'; // Royal blue tunic
      ctx.fillRect(5 - squashX / 2, 18 + bobY, 12 + squashX, 7);
      // White collar scarf
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, 18 + bobY, 5, 2);
      // Golden center button
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(10, 20 + bobY, 2, 2);

      // --- 7. Leather Belt & Golden Buckle ---
      ctx.fillStyle = '#4a2810'; // Dark leather belt
      ctx.fillRect(5, 24 + bobY, 12, 2);
      ctx.fillStyle = '#f1c40f'; // Golden buckle
      ctx.fillRect(9, 24 + bobY, 3, 2);

      // --- 8. Arms & Hands ---
      ctx.fillStyle = '#2980b9'; // Sleeves
      if (this.animState === 'JUMP') {
        // Joyful arms raised upward
        ctx.fillRect(15, 14 + bobY, 4, 5);
        ctx.fillStyle = '#fcd5a0'; // Hands
        ctx.fillRect(16, 12 + bobY, 3, 3);
      } else if (this.animState === 'FALL') {
        // Arms out for balance
        ctx.fillRect(16, 19 + bobY, 5, 4);
        ctx.fillStyle = '#fcd5a0';
        ctx.fillRect(19, 18 + bobY, 3, 3);
      } else if (this.animState === 'RUN') {
        // Swinging arms in running cycle
        const armOffset = (this.animFrame % 2 === 0) ? 2 : -2;
        ctx.fillRect(14 + armOffset, 19 + bobY, 4, 4);
        ctx.fillStyle = '#fcd5a0';
        ctx.fillRect(15 + armOffset, 22 + bobY, 3, 3);
      } else {
        // Resting arms in idle
        ctx.fillRect(14, 19 + bobY, 3, 5);
        ctx.fillStyle = '#fcd5a0';
        ctx.fillRect(14, 23 + bobY, 3, 2);
      }

      // --- 9. Sturdy Boots & Legs ---
      ctx.fillStyle = '#2c3e50'; // Dark shorts / trousers
      ctx.fillRect(6, 25 + bobY, 10, 2);

      // Brown Boots & Animation Cycle
      ctx.fillStyle = '#6d4c41'; // Sturdy boot leather
      const bootHighlight = '#8d6e63';

      if (this.animState === 'RUN') {
        // 4-frame running leg strides
        if (this.animFrame === 0) {
          // Left back, right forward
          ctx.fillRect(4, 26, 4, 4);
          ctx.fillRect(13, 26, 5, 4);
        } else if (this.animFrame === 1) {
          // Passing stride
          ctx.fillRect(6, 25, 4, 5);
          ctx.fillRect(11, 26, 4, 4);
        } else if (this.animFrame === 2) {
          // Right back, left forward
          ctx.fillRect(13, 26, 4, 4);
          ctx.fillRect(5, 26, 5, 4);
        } else {
          // Passing stride
          ctx.fillRect(6, 26, 4, 4);
          ctx.fillRect(11, 25, 4, 5);
        }
      } else if (this.animState === 'JUMP') {
        // Tucked boots in mid-air
        ctx.fillRect(5, 25, 5, 4);
        ctx.fillRect(12, 25, 5, 4);
      } else if (this.animState === 'FALL') {
        // Legs dangling downward
        ctx.fillRect(5, 26, 5, 4);
        ctx.fillRect(12, 26, 5, 4);
      } else {
        // Solid idle stance
        ctx.fillRect(5, 26, 5, 4);
        ctx.fillRect(12, 26, 5, 4);
        ctx.fillStyle = bootHighlight;
        ctx.fillRect(5, 26, 5, 1);
        ctx.fillRect(12, 26, 5, 1);
      }
    }
  }

  window.PixelQuest.Player = Player;

})(typeof window !== 'undefined' ? window : this);
