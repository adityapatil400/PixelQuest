/**
 * PixelQuest - UI & Audio Module
 * Handles the game start screen, native <dialog> modals, HUD updates,
 * retro synthesized Web Audio sound effects, and user interaction binding.
 */

(function (window) {
  'use strict';

  window.PixelQuest = window.PixelQuest || {};

  /**
   * Retro Chiptune & Synthesizer Music Patterns
   */
  const MUSIC_THEMES = {
    forest: {
      tempo: 120,
      steps: 32,
      bass: [
        65.41, 0, 65.41, 0, 98.00, 0, 98.00, 0, 110.00, 0, 110.00, 0, 87.31, 0, 98.00, 0,
        65.41, 0, 65.41, 0, 98.00, 0, 98.00, 0, 110.00, 0, 87.31, 0, 98.00, 0, 65.41, 0
      ],
      melody: [
        261.63, 0, 329.63, 0, 392.00, 0, 329.63, 0, 293.66, 0, 349.23, 0, 329.63, 0, 293.66, 0,
        261.63, 0, 196.00, 0, 220.00, 0, 261.63, 0, 293.66, 0, 392.00, 0, 329.63, 0, 261.63, 0
      ],
      percussion: [
        0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0,
        0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0
      ]
    },
    lava: {
      tempo: 135,
      steps: 32,
      bass: [
        73.42, 73.42, 87.31, 73.42, 98.00, 73.42, 87.31, 73.42,
        116.54, 116.54, 110.00, 110.00, 87.31, 87.31, 98.00, 110.00,
        73.42, 73.42, 87.31, 73.42, 98.00, 73.42, 87.31, 73.42,
        116.54, 116.54, 110.00, 110.00, 87.31, 98.00, 73.42, 0
      ],
      melody: [
        293.66, 349.23, 440.00, 587.33, 523.25, 440.00, 349.23, 392.00,
        440.00, 0, 349.23, 0, 329.63, 0, 293.66, 0,
        293.66, 349.23, 440.00, 587.33, 523.25, 440.00, 349.23, 392.00,
        440.00, 523.25, 587.33, 0, 440.00, 349.23, 293.66, 0
      ],
      percussion: [
        1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0,
        1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0
      ]
    },
    castle: {
      tempo: 140,
      steps: 32,
      bass: [
        110.00, 0, 110.00, 0, 87.31, 0, 87.31, 0, 73.42, 0, 73.42, 0, 82.41, 0, 103.83, 0,
        110.00, 0, 110.00, 0, 87.31, 0, 87.31, 0, 73.42, 0, 73.42, 0, 82.41, 0, 110.00, 0
      ],
      melody: [
        440.00, 523.25, 659.25, 880.00, 830.61, 659.25, 493.88, 523.25,
        587.33, 523.25, 493.88, 440.00, 415.30, 493.88, 329.63, 0,
        440.00, 523.25, 659.25, 880.00, 830.61, 659.25, 493.88, 523.25,
        587.33, 659.25, 587.33, 523.25, 493.88, 415.30, 440.00, 0
      ],
      percussion: [
        1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1,
        1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1
      ]
    },
    menu: {
      tempo: 105,
      steps: 32,
      bass: [
        130.81, 0, 0, 0, 98.00, 0, 0, 0, 110.00, 0, 0, 0, 87.31, 0, 98.00, 0,
        130.81, 0, 0, 0, 98.00, 0, 0, 0, 110.00, 0, 0, 0, 87.31, 0, 98.00, 0
      ],
      melody: [
        329.63, 392.00, 523.25, 659.25, 293.66, 392.00, 493.88, 587.33,
        261.63, 329.63, 440.00, 523.25, 220.00, 261.63, 349.23, 392.00,
        329.63, 392.00, 523.25, 659.25, 293.66, 392.00, 493.88, 587.33,
        261.63, 329.63, 440.00, 523.25, 392.00, 493.88, 523.25, 0
      ],
      percussion: [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
      ]
    }
  };

  /**
   * Retro 8-bit / 16-bit Web Audio Synthesizer & Looping Chiptune Engine
   * Produces authentic retro sound effects and background music procedurally
   * with zero external audio assets or network dependencies.
   */
  class RetroAudioManager {
    constructor() {
      this.ctx = null;
      this.sfxGain = null;
      this.musicGain = null;

      this.isMuted = false;
      this.volume = 0.8;

      this.isMusicMuted = false;
      this.musicVolume = 0.5;

      this.currentTheme = 'menu';
      this.isPlayingMusic = false;
      this.musicTimer = null;
      this.nextNoteTime = 0;
      this.stepIndex = 0;
    }

    /**
     * Lazy initialize AudioContext on user interaction (browser policy)
     */
    initContext() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          try {
            this.ctx = new AudioContext();
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
            this.sfxGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.isMusicMuted ? 0 : this.musicVolume * 0.35, this.ctx.currentTime);
            this.musicGain.connect(this.ctx.destination);
          } catch (e) {
            console.warn('PixelQuest: Web Audio initialization deferred:', e);
          }
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    /**
     * Synchronize master gains to current volume and mute state
     */
    syncGains() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (this.sfxGain) {
        this.sfxGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, now);
      }
      if (this.musicGain) {
        this.musicGain.gain.setValueAtTime(this.isMusicMuted ? 0 : this.musicVolume * 0.35, now);
      }
    }

    setSfxVolume(vol) {
      this.volume = Math.max(0, Math.min(1, vol));
      this.syncGains();
    }

    setSfxMuted(isMuted) {
      this.isMuted = !!isMuted;
      this.syncGains();
    }

    setMusicVolume(vol) {
      this.musicVolume = Math.max(0, Math.min(1, vol));
      this.syncGains();
    }

    setMusicMuted(isMuted) {
      this.isMusicMuted = !!isMuted;
      this.syncGains();
    }

    /**
     * Synthesize a single SFX tone with frequency envelope
     */
    playTone(startFreq, endFreq, duration, type = 'square', gainVal = 0.15) {
      if (this.isMuted || !this.volume) return;
      this.initContext();
      if (!this.ctx || !this.sfxGain) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(startFreq, now);
        if (endFreq && endFreq !== startFreq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + duration);
        }

        const effectiveGain = gainVal * this.volume;
        gain.gain.setValueAtTime(effectiveGain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {
        // Suppress audio policy warnings
      }
    }

    // UI Sounds
    playHover() {
      this.playTone(520, 680, 0.04, 'triangle', 0.08);
    }

    playClick() {
      this.playTone(330, 660, 0.09, 'square', 0.12);
    }

    playStart() {
      this.initContext();
      if (!this.ctx || this.isMuted) return;
      const notes = [261.6, 329.6, 392.0, 523.3];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, freq, 0.12, 'square', 0.18);
        }, idx * 80);
      });
    }

    // Gameplay Sounds
    playJump() {
      this.playTone(150, 480, 0.14, 'square', 0.14);
    }

    playCoin() {
      this.initContext();
      if (!this.ctx || this.isMuted) return;
      this.playTone(987.77, 987.77, 0.07, 'sine', 0.15); // B5
      setTimeout(() => {
        this.playTone(1318.51, 1318.51, 0.14, 'sine', 0.15); // E6
      }, 70);
    }

    playHurt() {
      this.playTone(280, 70, 0.22, 'sawtooth', 0.22);
    }

    playEnemyStomp() {
      this.playTone(320, 80, 0.12, 'triangle', 0.22);
    }

    playEnemyDefeat() {
      this.playEnemyStomp();
    }

    playGameOver() {
      this.stopMusic();
      const notes = [392, 349, 311, 261];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, freq * 0.9, 0.25, 'sawtooth', 0.16);
        }, idx * 160);
      });
    }

    playLevelComplete() {
      this.pauseMusic();
      const notes = [261.6, 329.6, 392.0, 523.3, 659.3, 784.0];
      notes.forEach((freq, idx) => {
        setTimeout(() => {
          this.playTone(freq, freq, 0.14, 'square', 0.16);
        }, idx * 90);
      });
    }

    // =========================================================================
    // PROCEDURAL 16-BIT CHIPTUNE BACKGROUND MUSIC ENGINE
    // =========================================================================

    /**
     * Start playing background music with a specific theme
     * @param {string} theme - 'menu' | 'forest' | 'lava' | 'castle'
     */
    startMusic(theme = 'forest') {
      this.initContext();
      this.currentTheme = theme;

      if (this.isPlayingMusic && this.musicTimer) {
        return;
      }

      this.isPlayingMusic = true;
      this.stepIndex = 0;
      if (this.ctx) {
        this.nextNoteTime = this.ctx.currentTime + 0.05;
      }

      if (this.musicTimer) {
        clearInterval(this.musicTimer);
      }
      this.musicTimer = setInterval(() => this.scheduleMusic(), 35);
    }

    /**
     * Stop background music and reset sequence
     */
    stopMusic() {
      this.isPlayingMusic = false;
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      this.stepIndex = 0;
    }

    /**
     * Temporarily pause background music
     */
    pauseMusic() {
      this.isPlayingMusic = false;
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    }

    /**
     * Resume background music from pause
     */
    resumeMusic() {
      if (this.isMusicMuted || this.musicVolume <= 0) return;
      this.initContext();
      if (!this.isPlayingMusic) {
        this.isPlayingMusic = true;
        if (this.ctx) {
          this.nextNoteTime = this.ctx.currentTime + 0.05;
        }
        if (this.musicTimer) clearInterval(this.musicTimer);
        this.musicTimer = setInterval(() => this.scheduleMusic(), 35);
      }
    }

    /**
     * Switch musical theme on level transition
     * @param {string} theme
     */
    setMusicTheme(theme) {
      if (this.currentTheme !== theme) {
        this.currentTheme = theme;
        this.stepIndex = 0;
        if (this.ctx) {
          this.nextNoteTime = this.ctx.currentTime + 0.05;
        }
      }
    }

    /**
     * Internal chiptune step scheduler (Web Audio clock lookahead)
     */
    scheduleMusic() {
      if (!this.isPlayingMusic || !this.ctx || !this.musicGain || this.ctx.state !== 'running') {
        return;
      }

      const theme = MUSIC_THEMES[this.currentTheme] || MUSIC_THEMES.forest;
      const stepDuration = 60 / theme.tempo / 4; // 16th note in seconds
      const lookahead = 0.12;

      while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
        const step = this.stepIndex;
        const bassFreq = theme.bass[step];
        const melodyFreq = theme.melody[step];
        const percussionHit = theme.percussion[step];

        if (bassFreq && !this.isMusicMuted && this.musicVolume > 0) {
          this.playChiptuneBass(bassFreq, this.nextNoteTime, stepDuration * 1.4);
        }
        if (melodyFreq && !this.isMusicMuted && this.musicVolume > 0) {
          this.playChiptuneLead(melodyFreq, this.nextNoteTime, stepDuration * 0.85);
        }
        if (percussionHit && !this.isMusicMuted && this.musicVolume > 0) {
          this.playChiptunePercussion(this.nextNoteTime);
        }

        this.nextNoteTime += stepDuration;
        this.stepIndex = (this.stepIndex + 1) % theme.steps;
      }
    }

    playChiptuneLead(freq, time, duration) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);

        const vol = 0.09;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.9);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
      } catch (e) {}
    }

    playChiptuneBass(freq, time, duration) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        const vol = 0.12;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.95);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
      } catch (e) {}
    }

    playChiptunePercussion(time) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.035);

        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + 0.035);
      } catch (e) {}
    }
  }

  /**
   * UI Controller
   */
  class UIController {
    constructor() {
      this.audio = new RetroAudioManager();
      this.elements = {};
      this.modals = {};
      this.gameRef = null;
    }

    /**
     * Initialize DOM queries, settings, and event bindings
     */
    init(game) {
      this.gameRef = game;
      if (game) game.ui = this;
      this.cacheElements();
      this.initSettings();
      this.bindEvents();
      this.setupDialogPolyfill();
      this.showScreen('MENU');
    }

    /**
     * Cache DOM references
     */
    cacheElements() {
      // Screens
      this.elements.startScreen = document.getElementById('startScreen');
      this.elements.hudScreen = document.getElementById('hudScreen');
      this.elements.crtOverlay = document.getElementById('crtOverlay');
      this.elements.menuHighScore = document.getElementById('menuHighScore');
      this.elements.menuTotalCoins = document.getElementById('menuTotalCoins');

      // Modals
      this.modals.howToPlay = document.getElementById('howToPlayDialog');
      this.modals.settings = document.getElementById('settingsDialog');
      this.modals.about = document.getElementById('aboutDialog');
      this.modals.pause = document.getElementById('pauseDialog');
      this.modals.gameOver = document.getElementById('gameOverDialog');
      this.modals.levelComplete = document.getElementById('levelCompleteDialog');
      this.modals.levelSelect = document.getElementById('levelSelectDialog');
      this.modals.confirmReset = document.getElementById('confirmResetDialog');

      // Buttons - Start Screen
      this.elements.btnPlay = document.getElementById('btnPlay');
      this.elements.btnLevelSelect = document.getElementById('btnLevelSelect');
      this.elements.btnHowToPlay = document.getElementById('btnHowToPlay');
      this.elements.btnSettings = document.getElementById('btnSettings');
      this.elements.btnAbout = document.getElementById('btnAbout');
      this.elements.btnConfirmReset = document.getElementById('btnConfirmReset');

      // Level Complete Stats & Action Elements
      this.elements.completeStageSubtitle = document.getElementById('completeStageSubtitle');
      this.elements.statStageName = document.getElementById('statStageName');
      this.elements.statCoins = document.getElementById('statCoins');
      this.elements.statHealthBonus = document.getElementById('statHealthBonus');
      this.elements.statClearBonus = document.getElementById('statClearBonus');
      this.elements.statTotalScore = document.getElementById('statTotalScore');
      this.elements.btnSelectFromComplete = document.getElementById('btnSelectFromComplete');

      // Settings Inputs
      this.elements.sfxSlider = document.getElementById('sfxSlider');
      this.elements.sfxMute = document.getElementById('sfxMute');
      this.elements.sfxToggle = document.getElementById('sfxToggle');
      this.elements.sfxToggleText = document.getElementById('sfxToggleText');
      this.elements.musicSlider = document.getElementById('musicSlider');
      this.elements.musicMute = document.getElementById('musicMute');
      this.elements.musicToggle = document.getElementById('musicToggle');
      this.elements.musicToggleText = document.getElementById('musicToggleText');
      this.elements.crtCheckbox = document.getElementById('crtCheckbox');
      this.elements.shakeCheckbox = document.getElementById('shakeCheckbox');
      this.elements.fpsCheckbox = document.getElementById('fpsCheckbox');
      this.elements.btnResetData = document.getElementById('btnResetData');

      // HUD Elements
      this.elements.hudHearts = document.getElementById('hudHearts');
      this.elements.hudScore = document.getElementById('hudScore');
      this.elements.hudCoins = document.getElementById('hudCoins');
      this.elements.hudCoinsVal = document.getElementById('hudCoinsVal');
      this.elements.hudLevel = document.getElementById('hudLevel');
      this.elements.fpsCounter = document.getElementById('fpsCounter');
      this.elements.btnPause = document.getElementById('btnPause');
      this.elements.btnMuteHud = document.getElementById('btnMuteHud');

      // Mobile Touch Controls
      this.elements.touchControls = document.getElementById('touchControls');
      this.elements.btnTouchLeft = document.getElementById('btnTouchLeft');
      this.elements.btnTouchRight = document.getElementById('btnTouchRight');
      this.elements.btnTouchJump = document.getElementById('btnTouchJump');

      // Modal action buttons - Pause
      this.elements.btnResume = document.getElementById('btnResume');
      this.elements.btnRestartPause = document.getElementById('btnRestartPause');
      this.elements.btnLevelSelectPause = document.getElementById('btnLevelSelectPause');
      this.elements.btnMenuPause = document.getElementById('btnMenuPause');

      // Modal action buttons - Game Over
      this.elements.btnRetryGameOver = document.getElementById('btnRetryGameOver');
      this.elements.btnMenuGameOver = document.getElementById('btnMenuGameOver');
      this.elements.gameOverLevel = document.getElementById('gameOverLevel');
      this.elements.gameOverCoins = document.getElementById('gameOverCoins');
      this.elements.gameOverScore = document.getElementById('gameOverScore');
      this.elements.gameOverBest = document.getElementById('gameOverBest');

      // Modal action buttons - Level Complete
      this.elements.btnNextLevel = document.getElementById('btnNextLevel');
      this.elements.btnMenuComplete = document.getElementById('btnMenuComplete');

      // Fullscreen Controls
      this.elements.btnFullscreen = document.getElementById('btnFullscreen');
      this.elements.btnFullscreenPause = document.getElementById('btnFullscreenPause');
      this.elements.btnFullscreenSettings = document.getElementById('btnFullscreenSettings');
      this.elements.gameCabinet = document.getElementById('gameCabinet') || (typeof document !== 'undefined' ? document.querySelector('.pq-cabinet') : null);
    }

    /**
     * Apply saved settings to controls and audio
     */
    initSettings() {
      const storage = window.PixelQuest.Storage;
      if (!storage) return;

      const s = storage.getSettings();

      this.audio.volume = s.sfxMuted ? 0 : s.sfxVolume;
      this.audio.isMuted = s.sfxMuted;
      this.audio.musicVolume = s.musicMuted ? 0 : s.musicVolume;
      this.audio.isMusicMuted = s.musicMuted;
      this.audio.syncGains();

      if (this.elements.sfxSlider) this.elements.sfxSlider.value = Math.round(s.sfxVolume * 100);
      if (this.elements.sfxMute) this.elements.sfxMute.checked = s.sfxMuted;
      if (this.elements.sfxToggle) this.elements.sfxToggle.checked = !s.sfxMuted;
      if (this.elements.sfxToggleText) this.elements.sfxToggleText.textContent = s.sfxMuted ? 'OFF' : 'ON';

      if (this.elements.musicSlider) this.elements.musicSlider.value = Math.round(s.musicVolume * 100);
      if (this.elements.musicMute) this.elements.musicMute.checked = s.musicMuted;
      if (this.elements.musicToggle) this.elements.musicToggle.checked = !s.musicMuted;
      if (this.elements.musicToggleText) this.elements.musicToggleText.textContent = s.musicMuted ? 'OFF' : 'ON';
      if (this.elements.crtCheckbox) this.elements.crtCheckbox.checked = s.crtFilter;
      if (this.elements.shakeCheckbox) this.elements.shakeCheckbox.checked = s.screenShake;
      if (this.elements.fpsCheckbox) this.elements.fpsCheckbox.checked = s.showFps;

      this.toggleCrtFilter(s.crtFilter);
      this.toggleFpsCounter(s.showFps);
      this.updateMuteButtonVisual();
      this.syncFullscreenUI();
    }

    /**
     * Update HUD mute button visual state
     */
    updateMuteButtonVisual() {
      if (this.elements.btnMuteHud) {
        this.elements.btnMuteHud.textContent = this.audio.isMuted ? '🔇' : '🔊';
        this.elements.btnMuteHud.title = this.audio.isMuted ? 'Unmute Audio' : 'Mute Audio';
      }
    }

    /**
     * Check if currently in fullscreen (native or pseudo-fullscreen)
     * @returns {boolean}
     */
    isFullscreen() {
      if (typeof document === 'undefined') return false;
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        (document.body && document.body.classList.contains('is-pseudo-fullscreen'))
      );
    }

    /**
     * Request fullscreen on the game cabinet or documentElement
     */
    async requestFullscreen() {
      if (typeof document === 'undefined') return;

      const cabinet = document.getElementById('gameCabinet') || (document.querySelector ? document.querySelector('.pq-cabinet') : null);
      const target = cabinet || document.documentElement;

      try {
        if (target && target.requestFullscreen) {
          await target.requestFullscreen();
        } else if (target && target.webkitRequestFullscreen) {
          await target.webkitRequestFullscreen();
        } else if (target && target.mozRequestFullScreen) {
          await target.mozRequestFullScreen();
        } else if (target && target.msRequestFullscreen) {
          await target.msRequestFullscreen();
        } else if (document.documentElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement && document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        } else {
          this.enterPseudoFullscreen();
        }
      } catch (err) {
        console.warn('PixelQuest: Fullscreen on container failed, attempting documentElement fallback:', err);
        try {
          if (document.documentElement && document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
          } else if (document.documentElement && document.documentElement.webkitRequestFullscreen) {
            await document.documentElement.webkitRequestFullscreen();
          } else {
            this.enterPseudoFullscreen();
          }
        } catch (fallbackErr) {
          console.warn('PixelQuest: Native fullscreen failed, activating pseudo-fullscreen:', fallbackErr);
          this.enterPseudoFullscreen();
        }
      }
    }

    /**
     * Exit fullscreen mode
     */
    async exitFullscreen() {
      if (typeof document === 'undefined') return;

      if (document.body && document.body.classList.contains('is-pseudo-fullscreen')) {
        this.exitPseudoFullscreen();
        return;
      }

      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      } catch (err) {
        console.warn('PixelQuest: Error exiting fullscreen:', err);
      }
    }

    /**
     * Toggle fullscreen mode
     */
    async toggleFullscreen() {
      if (this.isFullscreen()) {
        await this.exitFullscreen();
      } else {
        await this.requestFullscreen();
      }
    }

    /**
     * Fallback full-screen mode for browsers with restricted Fullscreen API (e.g. mobile Safari)
     */
    enterPseudoFullscreen() {
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('is-pseudo-fullscreen');
        document.body.classList.add('is-fullscreen');
      }
      this.syncFullscreenUI(true);
      if (this.gameRef && typeof this.gameRef.setupResponsiveCanvas === 'function') {
        this.gameRef.setupResponsiveCanvas();
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          const ev = (typeof window.Event === 'function') ? new window.Event('resize') : { type: 'resize' };
          window.dispatchEvent(ev);
        } catch (_) {}
      }
    }

    /**
     * Exit fallback pseudo-fullscreen mode
     */
    exitPseudoFullscreen() {
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('is-pseudo-fullscreen');
        document.body.classList.remove('is-fullscreen');
      }
      this.syncFullscreenUI(false);
      if (this.gameRef && typeof this.gameRef.setupResponsiveCanvas === 'function') {
        this.gameRef.setupResponsiveCanvas();
      }
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          const ev = (typeof window.Event === 'function') ? new window.Event('resize') : { type: 'resize' };
          window.dispatchEvent(ev);
        } catch (_) {}
      }
    }

    /**
     * Synchronize Fullscreen button icons, titles, and ARIA labels
     * @param {boolean} [activeState]
     */
    syncFullscreenUI(activeState) {
      const isFs = (typeof activeState === 'boolean') ? activeState : this.isFullscreen();

      // Top-right HUD Fullscreen button
      if (this.elements.btnFullscreen) {
        this.elements.btnFullscreen.textContent = isFs ? '🗗' : '⛶';
        const label = isFs ? 'Exit Full Screen' : 'Enter Full Screen';
        this.elements.btnFullscreen.title = label;
        if (typeof this.elements.btnFullscreen.setAttribute === 'function') {
          this.elements.btnFullscreen.setAttribute('aria-label', label);
        }
        if (this.elements.btnFullscreen.classList) {
          if (isFs) {
            this.elements.btnFullscreen.classList.add('is-active');
          } else {
            this.elements.btnFullscreen.classList.remove('is-active');
          }
        }
      }

      // Pause menu fullscreen button
      if (this.elements.btnFullscreenPause) {
        this.elements.btnFullscreenPause.innerHTML = isFs
          ? '<span class="pq-fs-icon">🗗</span> EXIT FULL SCREEN'
          : '<span class="pq-fs-icon">⛶</span> FULL SCREEN';
      }

      // Settings dialog fullscreen button
      if (this.elements.btnFullscreenSettings) {
        this.elements.btnFullscreenSettings.innerHTML = isFs
          ? '<span class="pq-fs-icon">🗗</span> EXIT FULL SCREEN'
          : '<span class="pq-fs-icon">⛶</span> FULL SCREEN';
      }

      // Reflect state class on body
      if (typeof document !== 'undefined' && document.body) {
        if (isFs) {
          document.body.classList.add('is-fullscreen');
        } else if (!document.body.classList.contains('is-pseudo-fullscreen')) {
          document.body.classList.remove('is-fullscreen');
        }
      }

      // Ensure canvas smoothing remains pixelated
      if (this.gameRef && typeof this.gameRef.onFullscreenChange === 'function') {
        this.gameRef.onFullscreenChange();
      }
    }

    /**
     * Setup light-dismiss fallback for <dialog closedby="any"> across all browsers
     */
    setupDialogPolyfill() {
      if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
        const outside = (e, dialog) => {
          const r = dialog.getBoundingClientRect();
          return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        };

        const dialogs = document.querySelectorAll('dialog[closedby="any"]');
        dialogs.forEach(dialog => {
          let pressedOutside = false;
          dialog.addEventListener('pointerdown', (e) => {
            pressedOutside = outside(e, dialog);
          });
          dialog.addEventListener('pointerup', (e) => {
            if (pressedOutside && outside(e, dialog)) {
              this.closeModal(dialog);
            }
          });
        });
      }
    }

    /**
     * Bind all UI buttons and event listeners
     */
    bindEvents() {
      // Hover audio effect on all interactive game buttons
      const buttons = document.querySelectorAll('.pq-btn, .pq-close-btn, .pq-icon-btn');
      buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => this.audio.playHover());
        btn.addEventListener('focus', () => this.audio.playHover());
      });

      // Start Screen Buttons
      if (this.elements.btnPlay) {
        this.elements.btnPlay.addEventListener('click', () => {
          this.audio.playStart();
          if (this.gameRef) {
            this.gameRef.startNewGame();
          }
        });
      }

      if (this.elements.btnLevelSelect) {
        this.elements.btnLevelSelect.addEventListener('click', () => {
          this.audio.playClick();
          this.updateLevelSelectUI();
          this.openModal(this.modals.levelSelect);
        });
      }

      if (this.elements.btnHowToPlay) {
        this.elements.btnHowToPlay.addEventListener('click', () => {
          this.audio.playClick();
          this.openModal(this.modals.howToPlay);
        });
      }

      if (this.elements.btnSettings) {
        this.elements.btnSettings.addEventListener('click', () => {
          this.audio.playClick();
          this.openModal(this.modals.settings);
        });
      }

      if (this.elements.btnAbout) {
        this.elements.btnAbout.addEventListener('click', () => {
          this.audio.playClick();
          this.openModal(this.modals.about);
        });
      }

      // Level Select Play Buttons
      const playLevelBtns = document.querySelectorAll('.pq-btn-play-level');
      playLevelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-level-index'), 10);
          this.audio.playStart();
          this.closeModal(this.modals.levelSelect);
          if (this.gameRef) {
            this.gameRef.startLevel(idx);
          }
        });
      });

      // Settings Modal Listeners
      if (this.elements.sfxSlider) {
        this.elements.sfxSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value) / 100;
          this.audio.setSfxVolume(val);
          window.PixelQuest.Storage.setSetting('sfxVolume', val);
        });
        this.elements.sfxSlider.addEventListener('change', () => this.audio.playCoin());
      }

      if (this.elements.sfxMute) {
        this.elements.sfxMute.addEventListener('change', (e) => {
          const muted = e.target.checked;
          this.audio.setSfxMuted(muted);
          window.PixelQuest.Storage.setSetting('sfxMuted', muted);
          window.PixelQuest.Storage.setSetting('sfxEnabled', !muted);
          if (this.elements.sfxToggle) this.elements.sfxToggle.checked = !muted;
          if (this.elements.sfxToggleText) this.elements.sfxToggleText.textContent = muted ? 'OFF' : 'ON';
          this.updateMuteButtonVisual();
        });
      }

      if (this.elements.sfxToggle) {
        this.elements.sfxToggle.addEventListener('change', (e) => {
          const enabled = e.target.checked;
          const muted = !enabled;
          this.audio.setSfxMuted(muted);
          window.PixelQuest.Storage.setSetting('sfxMuted', muted);
          window.PixelQuest.Storage.setSetting('sfxEnabled', enabled);
          if (this.elements.sfxMute) this.elements.sfxMute.checked = muted;
          if (this.elements.sfxToggleText) this.elements.sfxToggleText.textContent = enabled ? 'ON' : 'OFF';
          this.updateMuteButtonVisual();
        });
      }

      if (this.elements.musicSlider) {
        this.elements.musicSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value) / 100;
          this.audio.setMusicVolume(val);
          window.PixelQuest.Storage.setSetting('musicVolume', val);
        });
      }

      if (this.elements.musicMute) {
        this.elements.musicMute.addEventListener('change', (e) => {
          const muted = e.target.checked;
          this.audio.setMusicMuted(muted);
          window.PixelQuest.Storage.setSetting('musicMuted', muted);
          window.PixelQuest.Storage.setSetting('musicEnabled', !muted);
          if (this.elements.musicToggle) this.elements.musicToggle.checked = !muted;
          if (this.elements.musicToggleText) this.elements.musicToggleText.textContent = muted ? 'OFF' : 'ON';
        });
      }

      if (this.elements.musicToggle) {
        this.elements.musicToggle.addEventListener('change', (e) => {
          const enabled = e.target.checked;
          const muted = !enabled;
          this.audio.setMusicMuted(muted);
          window.PixelQuest.Storage.setSetting('musicMuted', muted);
          window.PixelQuest.Storage.setSetting('musicEnabled', enabled);
          if (this.elements.musicMute) this.elements.musicMute.checked = muted;
          if (this.elements.musicToggleText) this.elements.musicToggleText.textContent = enabled ? 'ON' : 'OFF';
        });
      }

      if (this.elements.crtCheckbox) {
        this.elements.crtCheckbox.addEventListener('change', (e) => {
          const enabled = e.target.checked;
          this.toggleCrtFilter(enabled);
          window.PixelQuest.Storage.setSetting('crtFilter', enabled);
        });
      }

      if (this.elements.shakeCheckbox) {
        this.elements.shakeCheckbox.addEventListener('change', (e) => {
          window.PixelQuest.Storage.setSetting('screenShake', e.target.checked);
        });
      }

      if (this.elements.fpsCheckbox) {
        this.elements.fpsCheckbox.addEventListener('change', (e) => {
          const enabled = e.target.checked;
          this.toggleFpsCounter(enabled);
          window.PixelQuest.Storage.setSetting('showFps', enabled);
        });
      }

      if (this.elements.btnResetData) {
        this.elements.btnResetData.addEventListener('click', () => {
          this.audio.playClick();
          this.openModal(this.modals.confirmReset);
        });
      }

      if (this.elements.btnConfirmReset) {
        this.elements.btnConfirmReset.addEventListener('click', () => {
          this.audio.playTone(180, 100, 0.25, 'sawtooth');
          window.PixelQuest.Storage.resetProgress();
          this.closeModal(this.modals.confirmReset);
          this.closeModal(this.modals.settings);
          this.updateLevelSelectUI();
          const best = window.PixelQuest.Storage.getHighScore();
          const totalCoins = window.PixelQuest.Storage.getTotalCoins();
          if (this.elements.menuHighScore) {
            this.elements.menuHighScore.textContent = '🏆 HIGH SCORE: ' + String(best).padStart(6, '0');
          }
          if (this.elements.menuTotalCoins) {
            this.elements.menuTotalCoins.textContent = '🪙 TOTAL COINS: ' + String(totalCoins).padStart(3, '0');
          }
        });
      }

      // Close modal buttons
      const closeButtons = document.querySelectorAll('[data-close-dialog]');
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.audio.playClick();
          const targetId = btn.getAttribute('data-close-dialog');
          const dialog = document.getElementById(targetId);
          if (dialog) this.closeModal(dialog);
        });
      });

      // HUD Pause button
      if (this.elements.btnPause) {
        this.elements.btnPause.addEventListener('click', () => {
          if (this.gameRef && this.gameRef.state === 'PLAYING') {
            this.gameRef.pauseGame();
          }
        });
      }

      // HUD Mute toggle button
      if (this.elements.btnMuteHud) {
        this.elements.btnMuteHud.addEventListener('click', () => {
          this.audio.isMuted = !this.audio.isMuted;
          this.updateMuteButtonVisual();
          if (window.PixelQuest.Storage) {
            window.PixelQuest.Storage.setSetting('sfxMuted', this.audio.isMuted);
          }
          if (this.elements.sfxMute) {
            this.elements.sfxMute.checked = this.audio.isMuted;
          }
          if (!this.audio.isMuted) {
            this.audio.playTone(520, 680, 0.05, 'triangle', 0.1);
          }
        });
      }

      // Fullscreen Controls - HUD, Pause & Settings Dialogs
      if (this.elements.btnFullscreen) {
        this.elements.btnFullscreen.addEventListener('click', () => {
          this.audio.playClick();
          this.toggleFullscreen();
        });
      }

      if (this.elements.btnFullscreenPause) {
        this.elements.btnFullscreenPause.addEventListener('click', () => {
          this.audio.playClick();
          this.toggleFullscreen();
        });
      }

      if (this.elements.btnFullscreenSettings) {
        this.elements.btnFullscreenSettings.addEventListener('click', () => {
          this.audio.playClick();
          this.toggleFullscreen();
        });
      }

      // Fullscreen change events across all vendor prefixes
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        const fsEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        fsEvents.forEach(evt => {
          document.addEventListener(evt, () => {
            this.syncFullscreenUI();
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
              try {
                const ev = (typeof window.Event === 'function') ? new window.Event('resize') : { type: 'resize' };
                window.dispatchEvent(ev);
              } catch (_) {}
            }
          });
        });
      }

      // Pause Dialog Actions
      if (this.elements.btnResume) {
        this.elements.btnResume.addEventListener('click', () => {
          this.audio.playClick();
          this.closeModal(this.modals.pause);
          if (this.gameRef) this.gameRef.resumeGame();
        });
      }

      if (this.elements.btnRestartPause) {
        this.elements.btnRestartPause.addEventListener('click', () => {
          this.audio.playStart();
          this.closeModal(this.modals.pause);
          if (this.gameRef) this.gameRef.restartLevel();
        });
      }

      if (this.elements.btnLevelSelectPause) {
        this.elements.btnLevelSelectPause.addEventListener('click', () => {
          this.audio.playClick();
          this.closeModal(this.modals.pause);
          this.updateLevelSelectUI();
          this.openModal(this.modals.levelSelect);
        });
      }

      if (this.elements.btnMenuPause) {
        this.elements.btnMenuPause.addEventListener('click', () => {
          this.audio.playClick();
          this.closeModal(this.modals.pause);
          if (this.gameRef) this.gameRef.goToMenu();
        });
      }

      // Game Over Actions
      if (this.elements.btnRetryGameOver) {
        this.elements.btnRetryGameOver.addEventListener('click', () => {
          this.audio.playStart();
          this.closeModal(this.modals.gameOver);
          if (this.gameRef) this.gameRef.restartLevel();
        });
      }

      if (this.elements.btnMenuGameOver) {
        this.elements.btnMenuGameOver.addEventListener('click', () => {
          this.audio.playClick();
          this.closeModal(this.modals.gameOver);
          if (this.gameRef) this.gameRef.goToMenu();
        });
      }

      // Level Complete Actions
      if (this.elements.btnNextLevel) {
        this.elements.btnNextLevel.addEventListener('click', () => {
          this.audio.playStart();
          this.closeModal(this.modals.levelComplete);
          if (this.gameRef) this.gameRef.nextLevel();
        });
      }

      if (this.elements.btnSelectFromComplete) {
        this.elements.btnSelectFromComplete.addEventListener('click', () => {
          this.audio.playClick();
          this.closeModal(this.modals.levelComplete);
          this.updateLevelSelectUI();
          this.openModal(this.modals.levelSelect);
        });
      }

      if (this.elements.btnMenuComplete) {
        this.elements.btnMenuComplete.addEventListener('click', () => {
          this.audio.playClick();
          this.closeModal(this.modals.levelComplete);
          if (this.gameRef) this.gameRef.goToMenu();
        });
      }

      // Mobile On-Screen Touch Controls Binding with Continuous Hold Support
      const setupTouchBtn = (btn, onDownAction, onUpAction) => {
        if (!btn) return;
        let isPressed = false;

        const press = (e) => {
          if (e) {
            e.preventDefault();
            if (e.pointerId && btn.setPointerCapture) {
              try { btn.setPointerCapture(e.pointerId); } catch (_) {}
            }
          }
          if (!isPressed) {
            isPressed = true;
            btn.classList.add('active');
            onDownAction();
          }
        };

        const release = (e) => {
          if (e) {
            e.preventDefault();
            if (e.pointerId && btn.releasePointerCapture) {
              try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
            }
          }
          if (isPressed) {
            isPressed = false;
            btn.classList.remove('active');
            onUpAction();
          }
        };

        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);

        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
        btn.addEventListener('touchcancel', release, { passive: false });
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
      };

      setupTouchBtn(
        this.elements.btnTouchLeft,
        () => {
          if (this.gameRef) {
            if (typeof this.gameRef.setTouchInput === 'function') {
              this.gameRef.setTouchInput('left', true);
            } else if (this.gameRef.inputState) {
              this.gameRef.inputState.left = true;
            }
          }
        },
        () => {
          if (this.gameRef) {
            if (typeof this.gameRef.setTouchInput === 'function') {
              this.gameRef.setTouchInput('left', false);
            } else if (this.gameRef.inputState) {
              this.gameRef.inputState.left = false;
            }
          }
        }
      );

      setupTouchBtn(
        this.elements.btnTouchRight,
        () => {
          if (this.gameRef) {
            if (typeof this.gameRef.setTouchInput === 'function') {
              this.gameRef.setTouchInput('right', true);
            } else if (this.gameRef.inputState) {
              this.gameRef.inputState.right = true;
            }
          }
        },
        () => {
          if (this.gameRef) {
            if (typeof this.gameRef.setTouchInput === 'function') {
              this.gameRef.setTouchInput('right', false);
            } else if (this.gameRef.inputState) {
              this.gameRef.inputState.right = false;
            }
          }
        }
      );

      setupTouchBtn(
        this.elements.btnTouchJump,
        () => {
          if (this.gameRef) {
            if (typeof this.gameRef.setTouchInput === 'function') {
              this.gameRef.setTouchInput('jump', true);
            } else if (this.gameRef.inputState) {
              this.gameRef.inputState.jump = true;
              this.gameRef.inputState.jumpPressed = true;
            }
          }
        },
        () => {
          if (this.gameRef) {
            if (typeof this.gameRef.setTouchInput === 'function') {
              this.gameRef.setTouchInput('jump', false);
            } else if (this.gameRef.inputState) {
              this.gameRef.inputState.jump = false;
            }
          }
        }
      );

      // Global keyboard handler for Esc key (pause / close / exit pseudo-fullscreen)
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          // If in pseudo-fullscreen, Escape exits pseudo-fullscreen
          if (e.key === 'Escape' && typeof document !== 'undefined' && document.body && document.body.classList.contains('is-pseudo-fullscreen')) {
            this.exitPseudoFullscreen();
            return;
          }

          if (this.gameRef) {
            if (this.gameRef.state === 'PLAYING') {
              this.gameRef.pauseGame();
            } else if (this.gameRef.state === 'PAUSED' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
              this.closeModal(this.modals.pause);
              this.gameRef.resumeGame();
            }
          }
        }
      });
    }

    /**
     * Update level selection screen with locked/unlocked state indicators
     */
    updateLevelSelectUI() {
      const storage = window.PixelQuest.Storage;
      const unlocked = storage ? storage.getUnlockedLevel() : 1;

      for (let i = 1; i <= 3; i++) {
        const card = document.getElementById(`lvlCard${i}`);
        if (!card) continue;
        const btn = card.querySelector('.pq-btn-play-level');
        const isLocked = (i > unlocked);

        if (isLocked) {
          card.classList.add('is-locked');
          if (btn) {
            btn.textContent = '🔒 LOCKED';
            btn.disabled = true;
            btn.classList.remove('pq-btn-primary');
          }
        } else {
          card.classList.remove('is-locked');
          if (btn) {
            btn.textContent = 'PLAY STAGE';
            btn.disabled = false;
            btn.classList.add('pq-btn-primary');
          }
        }
      }
    }

    /**
     * Show modal dialog using native showModal()
     * @param {HTMLDialogElement} dialog
     */
    openModal(dialog) {
      if (dialog && typeof dialog.showModal === 'function') {
        if (!dialog.open) {
          dialog.showModal();
        }
      }
    }

    /**
     * Close modal dialog
     * @param {HTMLDialogElement} dialog
     */
    closeModal(dialog) {
      if (dialog && typeof dialog.close === 'function') {
        if (dialog.open) {
          dialog.close();
        }
      }
    }

    /**
     * Toggle visual CRT scanlines
     * @param {boolean} enable
     */
    toggleCrtFilter(enable) {
      if (this.elements.crtOverlay) {
        this.elements.crtOverlay.style.display = enable ? 'block' : 'none';
      }
    }

    /**
     * Toggle FPS counter display in HUD
     * @param {boolean} show
     */
    toggleFpsCounter(show) {
      if (this.elements.fpsCounter) {
        this.elements.fpsCounter.style.display = show ? 'inline-block' : 'none';
      }
    }

    /**
     * Show/Hide overlays based on GameState
     * @param {string} state - 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'LEVEL_COMPLETE'
     */
    showScreen(state) {
      switch (state) {
        case 'MENU':
          if (this.elements.startScreen) this.elements.startScreen.style.display = 'flex';
          if (this.elements.hudScreen) this.elements.hudScreen.style.display = 'none';
          if (this.elements.touchControls) {
            if (this.elements.touchControls.classList) this.elements.touchControls.classList.remove('is-visible');
            this.elements.touchControls.style.display = 'none';
          }
          
          const bestMenuScore = window.PixelQuest.Storage ? window.PixelQuest.Storage.getHighScore() : 0;
          const totalCoins = window.PixelQuest.Storage ? window.PixelQuest.Storage.getTotalCoins() : 0;
          if (this.elements.menuHighScore) {
            this.elements.menuHighScore.textContent = '🏆 HIGH SCORE: ' + String(bestMenuScore).padStart(6, '0');
          }
          if (this.elements.menuTotalCoins) {
            this.elements.menuTotalCoins.textContent = '🪙 TOTAL COINS: ' + String(totalCoins).padStart(3, '0');
          }
          this.closeAllModals();
          break;

        case 'PLAYING':
          if (this.elements.startScreen) this.elements.startScreen.style.display = 'none';
          if (this.elements.hudScreen) this.elements.hudScreen.style.display = 'flex';
          
          if (this.elements.touchControls) {
            const isTouch = (typeof window !== 'undefined' && (
              ('ontouchstart' in window) ||
              (navigator && navigator.maxTouchPoints > 0) ||
              (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
              (window.innerWidth && window.innerWidth <= 800)
            ));
            if (isTouch) {
              if (this.elements.touchControls.classList) this.elements.touchControls.classList.add('is-visible');
              this.elements.touchControls.style.display = 'flex';
            } else {
              if (this.elements.touchControls.classList) this.elements.touchControls.classList.remove('is-visible');
              this.elements.touchControls.style.display = 'none';
            }
          }
          this.updateMuteButtonVisual();
          this.closeAllModals();
          break;

        case 'PAUSED':
          if (this.elements.startScreen) this.elements.startScreen.style.display = 'none';
          if (this.elements.hudScreen) this.elements.hudScreen.style.display = 'flex';
          if (this.elements.touchControls) {
            if (this.elements.touchControls.classList) this.elements.touchControls.classList.remove('is-visible');
            this.elements.touchControls.style.display = 'none';
          }
          this.openModal(this.modals.pause);
          break;

        case 'GAME_OVER':
          if (this.elements.hudScreen) this.elements.hudScreen.style.display = 'none';
          if (this.elements.touchControls) {
            if (this.elements.touchControls.classList) this.elements.touchControls.classList.remove('is-visible');
            this.elements.touchControls.style.display = 'none';
          }

          const stageName = (this.gameRef && this.gameRef.currentLevel) ? this.gameRef.currentLevel.name : 'Whispering Woods';
          const coins = (this.gameRef && this.gameRef.player) ? this.gameRef.player.coins : 0;
          const score = (this.gameRef && this.gameRef.player) ? this.gameRef.player.score : 0;
          const best = window.PixelQuest.Storage ? window.PixelQuest.Storage.getHighScore() : 0;

          if (this.elements.gameOverLevel) this.elements.gameOverLevel.textContent = stageName;
          if (this.elements.gameOverCoins) this.elements.gameOverCoins.textContent = '🪙 ' + String(coins).padStart(2, '0');
          if (this.elements.gameOverScore) this.elements.gameOverScore.textContent = String(score).padStart(6, '0');
          if (this.elements.gameOverBest) this.elements.gameOverBest.textContent = String(Math.max(score, best)).padStart(6, '0');

          this.openModal(this.modals.gameOver);
          break;

        case 'LEVEL_COMPLETE':
          if (this.elements.hudScreen) this.elements.hudScreen.style.display = 'none';
          if (this.elements.touchControls) {
            if (this.elements.touchControls.classList) this.elements.touchControls.classList.remove('is-visible');
            this.elements.touchControls.style.display = 'none';
          }

          if (this.gameRef && this.gameRef.lastLevelStats) {
            const s = this.gameRef.lastLevelStats;
            if (this.elements.completeStageSubtitle) {
              this.elements.completeStageSubtitle.textContent = s.isGameVictory ? '🎉 REALM SAVED! TOTAL VICTORY!' : 'PORTAL UNLOCKED!';
              this.elements.completeStageSubtitle.style.color = s.isGameVictory ? 'var(--pq-cyan)' : 'var(--pq-gold)';
            }
            if (this.elements.statStageName) this.elements.statStageName.textContent = s.levelName;
            if (this.elements.statCoins) this.elements.statCoins.textContent = '🪙 ' + String(s.coins).padStart(2, '0');
            if (this.elements.statHealthBonus) this.elements.statHealthBonus.textContent = `+${s.healthBonus} PTS (${s.health} LIVES)`;
            if (this.elements.statClearBonus) this.elements.statClearBonus.textContent = `+${s.clearBonus} PTS`;
            if (this.elements.statTotalScore) this.elements.statTotalScore.textContent = String(s.totalScore).padStart(6, '0');
            if (this.elements.btnNextLevel) {
              this.elements.btnNextLevel.textContent = s.isGameVictory ? 'VICTORY - REPLAY 🔄' : 'NEXT LEVEL ⏩';
            }
          }
          this.openModal(this.modals.levelComplete);
          break;

        default:
          break;
      }
    }

    /**
     * Close any active dialogs
     */
    closeAllModals() {
      Object.values(this.modals).forEach(modal => {
        if (modal && modal.open) {
          modal.close();
        }
      });
    }

    /**
     * Update HUD values with current player stats
     * @param {Object} player
     * @param {string} levelName
     * @param {number} fps
     */
    updateHUD(player, levelName = '1-1', fps = 60) {
      if (!player) return;

      // Hearts
      if (this.elements.hudHearts) {
        let heartsStr = '';
        for (let i = 0; i < player.maxHealth; i++) {
          heartsStr += (i < player.health) ? '❤️ ' : '🖤 ';
        }
        this.elements.hudHearts.textContent = heartsStr.trim();
      }

      // Score
      if (this.elements.hudScore) {
        this.elements.hudScore.textContent = String(player.score).padStart(6, '0');
      }

      // Coins
      if (this.elements.hudCoinsVal) {
        this.elements.hudCoinsVal.textContent = String(player.coins).padStart(2, '0');
      } else if (this.elements.hudCoins) {
        this.elements.hudCoins.textContent = '🪙 ' + String(player.coins).padStart(2, '0');
      }

      // Level
      if (this.elements.hudLevel) {
        this.elements.hudLevel.textContent = 'STAGE: ' + levelName;
      }

      // FPS
      if (this.elements.fpsCounter) {
        this.elements.fpsCounter.textContent = Math.round(fps) + ' FPS';
      }
    }
  }

  window.PixelQuest.RetroAudioManager = RetroAudioManager;
  window.PixelQuest.UI = new UIController();

})(typeof window !== 'undefined' ? window : this);

