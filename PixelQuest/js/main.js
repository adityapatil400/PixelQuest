/**
 * PixelQuest - Main Entrypoint
 * Bootstraps the game subsystems, initializes storage, UI, canvas,
 * and launches the core game loop.
 */

(function (window) {
  'use strict';

  function initPixelQuest() {
    console.log(
      '%c🎮 PIXELQUEST %c- 16-Bit Retro Platformer Engine Initialized %c\n' +
      'Vanilla HTML5 Canvas & Modern Web Standards\n' +
      'Version: 1.0.0',
      'background: #6c5ce7; color: #fff; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
      'background: #2d3436; color: #00cec9; padding: 4px 8px; border-radius: 0 4px 4px 0;',
      'color: #888; font-size: 11px;'
    );

    // Verify dependencies
    if (!window.PixelQuest.Game || !window.PixelQuest.UI || !window.PixelQuest.Storage) {
      console.error('PixelQuest: Missing required engine modules.');
      return;
    }

    // Initialize core game engine
    const game = new window.PixelQuest.Game('gameCanvas');

    // Initialize UI and hook game reference
    window.PixelQuest.UI.init(game);

    // Make game globally accessible for debugging and extensions
    window.PixelQuest.gameInstance = game;

    // Start engine loop
    game.start();
  }

  // Ensure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPixelQuest);
  } else {
    initPixelQuest();
  }

})(typeof window !== 'undefined' ? window : this);

