/**
 * PixelQuest - Storage Module
 * Manages persistent game settings, player progress, high scores, and audio preferences.
 * Uses browser localStorage with robust schema validation and safe in-memory fallback.
 */

(function (window) {
  'use strict';

  window.PixelQuest = window.PixelQuest || {};

  const STORAGE_KEYS = {
    SETTINGS: 'pixelquest_settings_v1',
    PROGRESS: 'pixelquest_progress_v1',
    HIGH_SCORE: 'pixelquest_highscore_v1'
  };

  const DEFAULT_SETTINGS = {
    sfxVolume: 0.8,
    musicVolume: 0.5,
    sfxEnabled: true,
    musicEnabled: true,
    sfxMuted: false,
    musicMuted: false,
    crtFilter: true,
    screenShake: true,
    showFps: false
  };

  const DEFAULT_PROGRESS = {
    unlockedLevel: 1,
    completedLevels: [],
    totalCoins: 0,
    coinsTotal: 0,
    gamesPlayed: 0,
    savedSession: null
  };

  // Safe in-memory storage fallback when localStorage is unavailable (e.g. private mode, cookies disabled, node)
  const memoryStorage = {};

  const isStorageAvailable = (() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const testKey = '__pq_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function rawGet(key) {
    try {
      if (isStorageAvailable) {
        return window.localStorage.getItem(key);
      }
      return memoryStorage[key] || null;
    } catch (e) {
      return memoryStorage[key] || null;
    }
  }

  function rawSet(key, value) {
    try {
      if (isStorageAvailable) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStorage[key] = String(value);
      }
    } catch (e) {
      memoryStorage[key] = String(value);
    }
  }

  function rawRemove(key) {
    try {
      if (isStorageAvailable) {
        window.localStorage.removeItem(key);
      }
      delete memoryStorage[key];
    } catch (e) {
      delete memoryStorage[key];
    }
  }

  /**
   * Validate that a score is a finite positive integer
   */
  function isValidScore(score) {
    return typeof score === 'number' && Number.isFinite(score) && !isNaN(score) && score >= 0;
  }

  const Storage = {
    /**
     * Retrieve user settings, merged with defaults & validated
     * @returns {Object}
     */
    getSettings() {
      try {
        const stored = rawGet(STORAGE_KEYS.SETTINGS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            const sfxMuted = typeof parsed.sfxMuted === 'boolean' ? parsed.sfxMuted : !parsed.sfxEnabled;
            const musicMuted = typeof parsed.musicMuted === 'boolean' ? parsed.musicMuted : !parsed.musicEnabled;

            return {
              sfxVolume: typeof parsed.sfxVolume === 'number' ? Math.max(0, Math.min(1, parsed.sfxVolume)) : DEFAULT_SETTINGS.sfxVolume,
              musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : DEFAULT_SETTINGS.musicVolume,
              sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : !sfxMuted,
              musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : !musicMuted,
              sfxMuted: sfxMuted,
              musicMuted: musicMuted,
              crtFilter: typeof parsed.crtFilter === 'boolean' ? parsed.crtFilter : DEFAULT_SETTINGS.crtFilter,
              screenShake: typeof parsed.screenShake === 'boolean' ? parsed.screenShake : DEFAULT_SETTINGS.screenShake,
              showFps: typeof parsed.showFps === 'boolean' ? parsed.showFps : DEFAULT_SETTINGS.showFps
            };
          }
        }
      } catch (err) {
        console.warn('PixelQuest: Corrupted settings in storage, falling back to defaults.', err);
      }
      return Object.assign({}, DEFAULT_SETTINGS);
    },

    /**
     * Save updated settings
     * @param {Object} newSettings
     */
    saveSettings(newSettings) {
      try {
        const current = this.getSettings();
        const merged = Object.assign({}, current, newSettings);

        // Keep sfxEnabled <-> sfxMuted in sync
        if (typeof newSettings.sfxEnabled === 'boolean') {
          merged.sfxMuted = !newSettings.sfxEnabled;
        } else if (typeof newSettings.sfxMuted === 'boolean') {
          merged.sfxEnabled = !newSettings.sfxMuted;
        }

        if (typeof newSettings.musicEnabled === 'boolean') {
          merged.musicMuted = !newSettings.musicEnabled;
        } else if (typeof newSettings.musicMuted === 'boolean') {
          merged.musicEnabled = !newSettings.musicMuted;
        }

        // Clamp volume ranges
        if (typeof merged.sfxVolume === 'number') {
          merged.sfxVolume = Math.max(0, Math.min(1, merged.sfxVolume));
        }
        if (typeof merged.musicVolume === 'number') {
          merged.musicVolume = Math.max(0, Math.min(1, merged.musicVolume));
        }

        rawSet(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
        return merged;
      } catch (err) {
        console.error('PixelQuest: Failed to save settings to storage:', err);
        return newSettings;
      }
    },

    /**
     * Update a single setting key
     * @param {string} key
     * @param {any} value
     */
    setSetting(key, value) {
      const settings = {};
      settings[key] = value;
      return this.saveSettings(settings);
    },

    /**
     * Retrieve validated player progress data
     * @returns {Object}
     */
    getProgress() {
      try {
        const stored = rawGet(STORAGE_KEYS.PROGRESS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            const unlocked = (typeof parsed.unlockedLevel === 'number' && parsed.unlockedLevel >= 1)
              ? Math.floor(parsed.unlockedLevel)
              : 1;

            const completed = Array.isArray(parsed.completedLevels)
              ? parsed.completedLevels.filter(n => typeof n === 'number' && n >= 1)
              : [];

            const coins = typeof parsed.totalCoins === 'number' && parsed.totalCoins >= 0
              ? Math.floor(parsed.totalCoins)
              : (typeof parsed.coinsTotal === 'number' && parsed.coinsTotal >= 0 ? Math.floor(parsed.coinsTotal) : 0);

            const games = typeof parsed.gamesPlayed === 'number' && parsed.gamesPlayed >= 0
              ? Math.floor(parsed.gamesPlayed)
              : 0;

            let session = null;
            if (parsed.savedSession && typeof parsed.savedSession === 'object') {
              session = {
                levelIndex: Math.max(0, Math.min(2, Math.floor(parsed.savedSession.levelIndex || 0))),
                score: Math.max(0, Math.floor(parsed.savedSession.score || 0)),
                health: Math.max(1, Math.min(3, Math.floor(parsed.savedSession.health || 3))),
                coins: Math.max(0, Math.floor(parsed.savedSession.coins || 0)),
                timestamp: parsed.savedSession.timestamp || Date.now()
              };
            }

            return {
              unlockedLevel: unlocked,
              completedLevels: completed,
              totalCoins: coins,
              coinsTotal: coins,
              gamesPlayed: games,
              savedSession: session
            };
          }
        }
      } catch (err) {
        console.warn('PixelQuest: Corrupted progress in storage, resetting to defaults.', err);
      }
      return Object.assign({}, DEFAULT_PROGRESS, { completedLevels: [] });
    },

    /**
     * Save player progress data safely
     * @param {Object} newProgress
     */
    saveProgress(newProgress) {
      try {
        const current = this.getProgress();
        const merged = Object.assign({}, current, newProgress);

        // Ensure totalCoins and coinsTotal remain synchronized
        if (typeof newProgress.totalCoins === 'number') {
          merged.totalCoins = Math.max(0, Math.floor(newProgress.totalCoins));
          merged.coinsTotal = merged.totalCoins;
        } else if (typeof newProgress.coinsTotal === 'number') {
          merged.coinsTotal = Math.max(0, Math.floor(newProgress.coinsTotal));
          merged.totalCoins = merged.coinsTotal;
        }

        // Validate unlockedLevel
        if (typeof merged.unlockedLevel === 'number') {
          merged.unlockedLevel = Math.max(1, Math.min(3, Math.floor(merged.unlockedLevel)));
        }

        // Validate completedLevels
        if (Array.isArray(merged.completedLevels)) {
          merged.completedLevels = Array.from(new Set(merged.completedLevels.filter(n => typeof n === 'number' && n >= 1)));
        }

        rawSet(STORAGE_KEYS.PROGRESS, JSON.stringify(merged));
        return merged;
      } catch (err) {
        console.error('PixelQuest: Failed to save progress to storage:', err);
        return newProgress;
      }
    },

    /**
     * Get unlocked level number (1-based, default 1)
     * @returns {number}
     */
    getUnlockedLevel() {
      const progress = this.getProgress();
      return progress.unlockedLevel || 1;
    },

    /**
     * Unlock a level if higher than currently unlocked level
     * @param {number} levelNum (1-based, 1 to 3)
     * @returns {boolean} true if a new level was unlocked
     */
    unlockLevel(levelNum) {
      try {
        if (typeof levelNum !== 'number' || levelNum < 1) return false;
        const target = Math.min(3, Math.floor(levelNum));
        const progress = this.getProgress();
        if (target > (progress.unlockedLevel || 1)) {
          progress.unlockedLevel = target;
          this.saveProgress(progress);
          return true;
        }
      } catch (e) {
        console.error('PixelQuest: Failed to unlock level:', e);
      }
      return false;
    },

    /**
     * Mark a level as completed
     * @param {number} levelNum (1-based)
     * @returns {boolean}
     */
    markLevelCompleted(levelNum) {
      try {
        if (typeof levelNum !== 'number' || levelNum < 1) return false;
        const validNum = Math.floor(levelNum);
        const progress = this.getProgress();
        if (!progress.completedLevels.includes(validNum)) {
          progress.completedLevels.push(validNum);
        }
        // Also unlock subsequent level
        if (validNum + 1 > progress.unlockedLevel) {
          progress.unlockedLevel = Math.min(3, validNum + 1);
        }
        this.saveProgress(progress);
        return true;
      } catch (e) {
        console.error('PixelQuest: Failed to mark level completed:', e);
        return false;
      }
    },

    /**
     * Add collected coins to lifetime total
     * @param {number} count
     * @returns {number} updated total coins
     */
    addCoins(count) {
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return this.getTotalCoins();
      const progress = this.getProgress();
      progress.totalCoins = (progress.totalCoins || 0) + Math.floor(count);
      progress.coinsTotal = progress.totalCoins;
      this.saveProgress(progress);
      return progress.totalCoins;
    },

    /**
     * Get total cumulative coins collected
     * @returns {number}
     */
    getTotalCoins() {
      return this.getProgress().totalCoins || 0;
    },

    /**
     * Save an in-progress game session checkpoint
     * @param {Object} sessionData
     */
    savePlayerSession(sessionData) {
      if (!sessionData || typeof sessionData !== 'object') return;
      const progress = this.getProgress();
      progress.savedSession = {
        levelIndex: Math.max(0, Math.min(2, Math.floor(sessionData.levelIndex || 0))),
        score: Math.max(0, Math.floor(sessionData.score || 0)),
        health: Math.max(1, Math.min(3, Math.floor(sessionData.health || 3))),
        coins: Math.max(0, Math.floor(sessionData.coins || 0)),
        timestamp: Date.now()
      };
      this.saveProgress(progress);
    },

    /**
     * Retrieve active player session if available
     * @returns {Object|null}
     */
    getPlayerSession() {
      return this.getProgress().savedSession || null;
    },

    /**
     * Clear saved player session checkpoint (e.g. after Game Over or Total Victory)
     */
    clearPlayerSession() {
      const progress = this.getProgress();
      progress.savedSession = null;
      this.saveProgress(progress);
    },

    /**
     * Get highest saved score safely
     * @returns {number}
     */
    getHighScore() {
      try {
        const val = rawGet(STORAGE_KEYS.HIGH_SCORE);
        if (val) {
          const parsed = parseInt(val, 10);
          return isValidScore(parsed) ? parsed : 0;
        }
      } catch (e) {
        return 0;
      }
      return 0;
    },

    /**
     * Save a new score only if valid, positive, and strictly exceeds the existing record.
     * Prevents duplicate or incorrect score saving.
     * @param {number} score
     * @returns {boolean} true if new high score was set
     */
    saveHighScore(score) {
      if (!isValidScore(score)) {
        console.warn('PixelQuest: Prevented invalid score save:', score);
        return false;
      }
      const validScore = Math.floor(score);
      const current = this.getHighScore();
      if (validScore > current) {
        try {
          rawSet(STORAGE_KEYS.HIGH_SCORE, String(validScore));
          return true;
        } catch (e) {
          console.error('PixelQuest: Failed to save high score:', e);
        }
      }
      return false;
    },

    /**
     * Reset only player progress and high score, retaining user audio/visual settings
     */
    resetProgress() {
      try {
        rawRemove(STORAGE_KEYS.PROGRESS);
        rawRemove(STORAGE_KEYS.HIGH_SCORE);
        return true;
      } catch (e) {
        console.error('PixelQuest: Failed to reset progress:', e);
        return false;
      }
    },

    /**
     * Reset all saved data (settings, progress, high scores) to default values
     */
    resetAll() {
      try {
        rawRemove(STORAGE_KEYS.SETTINGS);
        rawRemove(STORAGE_KEYS.PROGRESS);
        rawRemove(STORAGE_KEYS.HIGH_SCORE);
        return true;
      } catch (e) {
        console.error('PixelQuest: Failed to reset storage:', e);
        return false;
      }
    }
  };

  window.PixelQuest.Storage = Storage;

})(typeof window !== 'undefined' ? window : this);
