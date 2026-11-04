/**
 * PixelQuest - Collision Module
 * Provides Axis-Aligned Bounding Box (AABB) checks, tilemap collision queries,
 * and physics collision resolution helpers.
 */

(function (window) {
  'use strict';

  window.PixelQuest = window.PixelQuest || {};

  const Collision = {
    /**
     * Check if two rectangles intersect (AABB)
     * @param {Object} a - { x, y, width, height }
     * @param {Object} b - { x, y, width, height }
     * @returns {boolean}
     */
    checkAABB(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      );
    },

    /**
     * Check if a 2D point is within a rectangle
     * @param {number} px
     * @param {number} py
     * @param {Object} rect - { x, y, width, height }
     * @returns {boolean}
     */
    pointInRect(px, py, rect) {
      return (
        px >= rect.x &&
        px <= rect.x + rect.width &&
        py >= rect.y &&
        py <= rect.y + rect.height
      );
    },

    /**
     * Calculate overlap vector between two colliding rectangles
     * @param {Object} a
     * @param {Object} b
     * @returns {Object|null} { x: overlapX, y: overlapY } or null if no overlap
     */
    getOverlap(a, b) {
      if (!this.checkAABB(a, b)) return null;

      const overlapX = Math.min(a.x + a.width - b.x, b.x + b.width - a.x);
      const overlapY = Math.min(a.y + a.height - b.y, b.y + b.height - a.y);

      return { x: overlapX, y: overlapY };
    },

    /**
     * Resolve horizontal and vertical collision against a solid rectangular obstacle
     * @param {Object} entity - { x, y, width, height, vx, vy, isGrounded }
     * @param {Object} obstacle - { x, y, width, height }
     */
    resolveBoxCollision(entity, obstacle) {
      const overlap = this.getOverlap(entity, obstacle);
      if (!overlap) return false;

      // Resolve along the axis with the smallest penetration depth
      if (overlap.x < overlap.y) {
        if (entity.x < obstacle.x) {
          entity.x -= overlap.x;
          if (entity.vx > 0) entity.vx = 0;
        } else {
          entity.x += overlap.x;
          if (entity.vx < 0) entity.vx = 0;
        }
      } else {
        if (entity.y < obstacle.y) {
          entity.y -= overlap.y;
          if (entity.vy > 0) {
            entity.vy = 0;
            entity.isGrounded = true;
          }
        } else {
          entity.y += overlap.y;
          if (entity.vy < 0) entity.vy = 0;
        }
      }
      return true;
    },

    /**
     * Check collisions between an entity and map tiles
     * @param {Object} entity - { x, y, width, height }
     * @param {Object} level - Level instance with tile querying methods
     * @returns {Array<Object>} List of collided tiles
     */
    queryTileCollisions(entity, level) {
      if (!level || typeof level.getTileAtCoords !== 'function') return [];

      const tileSize = level.tileSize || 32;
      const startCol = Math.floor(entity.x / tileSize);
      const endCol = Math.floor((entity.x + entity.width) / tileSize);
      const startRow = Math.floor(entity.y / tileSize);
      const endRow = Math.floor((entity.y + entity.height) / tileSize);

      const collisions = [];

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = level.getTile(c, r);
          if (tile && tile.isSolid) {
            const tileRect = {
              x: c * tileSize,
              y: r * tileSize,
              width: tileSize,
              height: tileSize,
              type: tile.type,
              col: c,
              row: r
            };
            if (this.checkAABB(entity, tileRect)) {
              collisions.push(tileRect);
            }
          }
        }
      }

      return collisions;
    }
  };

  window.PixelQuest.Collision = Collision;

})(typeof window !== 'undefined' ? window : this);

