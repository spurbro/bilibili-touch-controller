/**
 * Bilibili Touch Controller - Windows / Microsoft Edge Touch Screen Adapter
 * Manifest V3 Content Script
 */

(function () {
  'use strict';

  // Default Configuration
  const DEFAULT_CONFIG = {
    enableSeek: true,
    seekSensitivity: 90, // seconds per full-width swipe
    enableVolume: true,
    enableBrightness: true,
    enableLongPress: true,
    longPressSpeed: 2.0,
    enableDoubleTap: true, // Double tap to toggle Fullscreen
    enableMouseSimulation: false, // For desktop testing if desired
    preventGhostClick: true
  };

  let config = { ...DEFAULT_CONFIG };

  // Load config from storage
  function loadConfig() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
        if (items) {
          config = { ...DEFAULT_CONFIG, ...items };
        }
      });
    }
  }

  // Listen for config changes
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (let key in changes) {
          config[key] = changes[key].newValue;
        }
      }
    });
  }

  loadConfig();

  // SVG Icons
  const ICONS = {
    forward: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>`,
    backward: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm9-12l-8.5 6 8.5 6V6z"/></svg>`,
    volumeHigh: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
    volumeMute: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
    brightness: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>`,
    speed: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.43zM10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>`,
    fullscreen: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
    exitFullscreen: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
    play: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg class="bili-touch-hud-icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
  };

  // Helper: Format seconds to HH:MM:SS or MM:SS
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  // Active Controller Class
  class BiliTouchPlayer {
    constructor(container, video) {
      this.container = container;
      this.video = video;
      this.touchLayer = null;
      this.hud = null;
      this.hudTimer = null;

      // Gesture tracking states
      this.isTracking = false;
      this.pointerId = null;
      this.startX = 0;
      this.startY = 0;
      this.startTime = 0;
      this.startVideoTime = 0;
      this.startVolume = 1;
      this.startBrightness = 1.0;
      this.currentBrightness = 1.0;

      this.gestureLocked = false;
      this.gestureType = null; // 'SEEK' | 'VOLUME' | 'BRIGHTNESS' | 'LONG_PRESS'
      this.targetSeekTime = 0;
      this.hasExecutedGesture = false;

      // Long press tracking
      this.longPressTimer = null;
      this.originalPlaybackRate = 1.0;
      this.isLongPressing = false;

      // Tap / Double-tap tracking
      this.lastTapTime = 0;
      this.lastTapX = 0;
      this.lastTapY = 0;
      this.singleTapTimeout = null;

      // Ghost click & contextmenu suppression
      this.suppressClickUntil = 0;
      this.suppressContextMenuUntil = 0;

      this.init();
    }

    init() {
      this.createTouchLayer();
      this.createHUD();
      this.bindEvents();
    }

    createTouchLayer() {
      // Remove old layer if exists
      const oldLayer = this.container.querySelector('.bili-touch-gesture-layer');
      if (oldLayer) oldLayer.remove();

      this.touchLayer = document.createElement('div');
      this.touchLayer.className = 'bili-touch-gesture-layer';
      this.touchLayer.setAttribute('tabindex', '-1');

      // Place above video area
      this.container.appendChild(this.touchLayer);
    }

    createHUD() {
      const oldHud = this.container.querySelector('.bili-touch-hud');
      if (oldHud) oldHud.remove();

      this.hud = document.createElement('div');
      this.hud.className = 'bili-touch-hud';
      this.hud.innerHTML = `
        <div class="bili-touch-hud-icon-wrap" id="bili-hud-icon"></div>
        <div class="bili-touch-hud-title" id="bili-hud-title"></div>
        <div class="bili-touch-hud-time" id="bili-hud-time"></div>
        <div class="bili-touch-hud-bar-bg" id="bili-hud-bar-bg">
          <div class="bili-touch-hud-bar-fill" id="bili-hud-bar-fill"></div>
        </div>
      `;
      this.container.appendChild(this.hud);
    }

    showHUD(options) {
      if (!this.hud) return;
      if (this.hudTimer) clearTimeout(this.hudTimer);

      const iconEl = this.hud.querySelector('#bili-hud-icon');
      const titleEl = this.hud.querySelector('#bili-hud-title');
      const timeEl = this.hud.querySelector('#bili-hud-time');
      const barBg = this.hud.querySelector('#bili-hud-bar-bg');
      const barFill = this.hud.querySelector('#bili-hud-bar-fill');

      if (options.icon) iconEl.innerHTML = options.icon;
      if (options.title) titleEl.innerHTML = options.title;
      
      if (options.time) {
        timeEl.style.display = 'block';
        timeEl.textContent = options.time;
      } else {
        timeEl.style.display = 'none';
      }

      if (options.progress !== undefined) {
        barBg.style.display = 'block';
        barFill.style.width = `${Math.max(0, Math.min(100, options.progress))}%`;
      } else {
        barBg.style.display = 'none';
      }

      if (options.isRate) {
        this.hud.classList.add('bili-touch-hud-rate');
      } else {
        this.hud.classList.remove('bili-touch-hud-rate');
      }

      this.hud.classList.add('bili-touch-hud-visible');

      if (options.autoHide !== false) {
        const delay = options.hideDelay || 600;
        this.hudTimer = setTimeout(() => {
          this.hud.classList.remove('bili-touch-hud-visible');
        }, delay);
      }
    }

    hideHUDImmediately() {
      if (this.hudTimer) clearTimeout(this.hudTimer);
      if (this.hud) this.hud.classList.remove('bili-touch-hud-visible');
    }

    showRipple(x, y) {
      const ripple = document.createElement('div');
      ripple.className = 'bili-touch-ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      this.container.appendChild(ripple);
      setTimeout(() => ripple.remove(), 400);
    }

    dismissBiliContextMenu() {
      const selectors = [
        '.bpx-player-contextmenu',
        '.bilibili-player-context-menu',
        '.bpx-player-context-menu',
        'div[class*="player-contextmenu"]',
        'div[class*="player-context-menu"]',
        '.bpx-state-show[class*="contextmenu"]'
      ];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((menu) => {
          menu.style.display = 'none';
          menu.classList.remove('active', 'show', 'bpx-state-show');
        });
      });
    }

    bindEvents() {
      const el = this.touchLayer;

      // Pointer events for modern touch/pen support
      el.addEventListener('pointerdown', (e) => this.onPointerDown(e), { passive: false });
      el.addEventListener('pointermove', (e) => this.onPointerMove(e), { passive: false });
      el.addEventListener('pointerup', (e) => this.onPointerUp(e), { passive: false });
      el.addEventListener('pointercancel', (e) => this.onPointerCancel(e), { passive: false });

      // Capture and suppress synthetic ghost clicks after gestures
      const suppressClickHandler = (e) => {
        if (Date.now() < this.suppressClickUntil) {
          e.stopPropagation();
          e.preventDefault();
        }
      };
      this.container.addEventListener('click', suppressClickHandler, true);
      this.container.addEventListener('dblclick', suppressClickHandler, true);

      // Thoroughly block Windows touch press-and-hold right-click context menu
      const suppressContextMenuHandler = (e) => {
        if (
          this.isLongPressing ||
          this.hasExecutedGesture ||
          this.isTracking ||
          Date.now() < this.suppressContextMenuUntil ||
          e.pointerType === 'touch' ||
          e.pointerType === 'pen'
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          this.dismissBiliContextMenu();
          return false;
        }
      };

      el.addEventListener('contextmenu', suppressContextMenuHandler, true);
      this.container.addEventListener('contextmenu', suppressContextMenuHandler, true);
      document.addEventListener('contextmenu', suppressContextMenuHandler, true);
      window.addEventListener('contextmenu', suppressContextMenuHandler, true);
    }

    isTouchInput(e) {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') return true;
      if (config.enableMouseSimulation && e.pointerType === 'mouse' && e.button === 0) return true;
      return false;
    }

    onPointerDown(e) {
      if (!this.isTouchInput(e)) return;
      if (this.isTracking) return; // Ignore second finger

      const rect = this.container.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;

      // If user touches bottom 55px (player control bar zone), let native controls handle it
      if (relativeY > rect.height - 55) {
        return;
      }

      this.isTracking = true;
      this.pointerId = e.pointerId;
      this.touchLayer.setPointerCapture(e.pointerId);

      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startTime = Date.now();
      this.startVideoTime = this.video.currentTime || 0;
      this.startVolume = this.video.volume !== undefined ? this.video.volume : 1;
      this.startBrightness = this.currentBrightness;

      this.gestureLocked = false;
      this.gestureType = null;
      this.hasExecutedGesture = false;

      // Setup Long Press detection
      if (config.enableLongPress && !this.video.paused) {
        this.longPressTimer = setTimeout(() => {
          if (this.isTracking && !this.gestureLocked) {
            this.startLongPress();
          }
        }, 450);
      }
    }

    onPointerMove(e) {
      if (!this.isTracking || e.pointerId !== this.pointerId) return;

      const deltaX = e.clientX - this.startX;
      const deltaY = e.clientY - this.startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const rect = this.container.getBoundingClientRect();

      // If moving beyond threshold, cancel long press
      if (absX > 10 || absY > 10) {
        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }
      }

      // If long pressing is active, ignore movement
      if (this.isLongPressing) return;

      // Lock gesture type if not locked yet
      if (!this.gestureLocked) {
        if (absX > 14 || absY > 14) {
          this.gestureLocked = true;
          this.hasExecutedGesture = true;

          if (absX >= absY && config.enableSeek) {
            this.gestureType = 'SEEK';
          } else if (absY > absX) {
            const startRelX = this.startX - rect.left;
            if (startRelX < rect.width * 0.5 && config.enableBrightness) {
              this.gestureType = 'BRIGHTNESS';
            } else if (startRelX >= rect.width * 0.5 && config.enableVolume) {
              this.gestureType = 'VOLUME';
            }
          }
        }
      }

      // Execute locked gesture
      if (this.gestureLocked && this.gestureType) {
        e.preventDefault();
        e.stopPropagation();

        if (this.gestureType === 'SEEK') {
          this.handleSeek(deltaX, rect.width);
        } else if (this.gestureType === 'VOLUME') {
          this.handleVolume(deltaY, rect.height);
        } else if (this.gestureType === 'BRIGHTNESS') {
          this.handleBrightness(deltaY, rect.height);
        }
      }
    }

    handleSeek(deltaX, containerWidth) {
      const duration = this.video.duration || 1;
      const sensitivity = config.seekSensitivity || 90;
      
      // Calculate seek delta with sensitivity
      const seekRatio = deltaX / containerWidth;
      const seekSeconds = seekRatio * sensitivity;
      const targetTime = Math.max(0, Math.min(duration, this.startVideoTime + seekSeconds));
      this.targetSeekTime = targetTime;

      const diff = Math.round(targetTime - this.startVideoTime);
      const diffSign = diff >= 0 ? `+${diff}s` : `${diff}s`;
      const icon = diff >= 0 ? ICONS.forward : ICONS.backward;
      const title = diff >= 0 ? `快进 <span class="bili-touch-hud-delta">${diffSign}</span>` : `快退 <span class="bili-touch-hud-delta">${diffSign}</span>`;
      const timeStr = `${formatTime(targetTime)} / ${formatTime(duration)}`;
      const progress = (targetTime / duration) * 100;

      this.showHUD({
        icon,
        title,
        time: timeStr,
        progress,
        autoHide: false
      });
    }

    handleVolume(deltaY, containerHeight) {
      // Swipe up increases volume, swipe down decreases
      const deltaRatio = -deltaY / (containerHeight * 0.8);
      const newVolume = Math.max(0, Math.min(1, this.startVolume + deltaRatio));
      this.video.volume = newVolume;

      const percentage = Math.round(newVolume * 100);
      const icon = newVolume === 0 ? ICONS.volumeMute : ICONS.volumeHigh;

      this.showHUD({
        icon,
        title: `音量 ${percentage}%`,
        progress: percentage,
        autoHide: false
      });
    }

    handleBrightness(deltaY, containerHeight) {
      // Swipe up increases brightness, swipe down decreases (range 0.2 to 2.0)
      const deltaRatio = -deltaY / (containerHeight * 0.8);
      const newBrightness = Math.max(0.2, Math.min(2.0, this.startBrightness + deltaRatio));
      this.currentBrightness = newBrightness;
      this.video.style.filter = `brightness(${newBrightness})`;

      const percentage = Math.round(newBrightness * 100);

      this.showHUD({
        icon: ICONS.brightness,
        title: `亮度 ${percentage}%`,
        progress: (newBrightness / 2.0) * 100,
        autoHide: false
      });
    }

    startLongPress() {
      this.isLongPressing = true;
      this.hasExecutedGesture = true;
      this.suppressContextMenuUntil = Date.now() + 2000;
      this.dismissBiliContextMenu();
      this.originalPlaybackRate = this.video.playbackRate || 1.0;
      const rate = config.longPressSpeed || 2.0;
      this.video.playbackRate = rate;

      this.showHUD({
        icon: ICONS.speed,
        title: `<span class="bili-touch-hud-rate-badge">⏩ ${rate}X 倍速播放中</span>`,
        isRate: true,
        autoHide: false
      });
    }

    stopLongPress() {
      if (this.isLongPressing) {
        this.isLongPressing = false;
        this.video.playbackRate = this.originalPlaybackRate || 1.0;
        this.suppressContextMenuUntil = Date.now() + 1500;
        this.suppressClickUntil = Date.now() + 600;
        this.dismissBiliContextMenu();
        this.hideHUDImmediately();
      }
    }

    onPointerUp(e) {
      if (!this.isTracking || e.pointerId !== this.pointerId) return;

      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      // End long press if active
      if (this.isLongPressing) {
        this.stopLongPress();
        this.suppressClickUntil = Date.now() + 600;
        this.suppressContextMenuUntil = Date.now() + 1500;
        this.dismissBiliContextMenu();
        this.cleanupPointer();
        return;
      }

      // If finished seek gesture, apply currentTime
      if (this.gestureLocked && this.gestureType === 'SEEK') {
        if (!isNaN(this.targetSeekTime)) {
          this.video.currentTime = this.targetSeekTime;
        }
        this.showHUD({ autoHide: true, hideDelay: 400 });
        this.suppressClickUntil = Date.now() + 400;
      } else if (this.gestureLocked) {
        // Volume or Brightness finished
        this.showHUD({ autoHide: true, hideDelay: 500 });
        this.suppressClickUntil = Date.now() + 400;
      } else {
        // Tap or Double-tap
        this.handleTap(e);
      }

      this.cleanupPointer();
    }

    onPointerCancel(e) {
      if (!this.isTracking || e.pointerId !== this.pointerId) return;
      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      if (this.isLongPressing) this.stopLongPress();
      this.hideHUDImmediately();
      this.cleanupPointer();
    }

    cleanupPointer() {
      this.isTracking = false;
      this.gestureLocked = false;
      this.gestureType = null;
      try {
        if (this.pointerId !== null) {
          this.touchLayer.releasePointerCapture(this.pointerId);
        }
      } catch (err) {}
      this.pointerId = null;
    }

    handleTap(e) {
      const now = Date.now();
      const rect = this.container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const isDoubleTap = (now - this.lastTapTime < 250) && Math.hypot(clickX - this.lastTapX, clickY - this.lastTapY) < 40;

      if (isDoubleTap && config.enableDoubleTap) {
        // Clear pending single tap
        if (this.singleTapTimeout) {
          clearTimeout(this.singleTapTimeout);
          this.singleTapTimeout = null;
        }
        this.lastTapTime = 0;
        this.executeDoubleTap(clickX, clickY, rect.width);
      } else {
        this.lastTapTime = now;
        this.lastTapX = clickX;
        this.lastTapY = clickY;

        // Schedule single tap execution (toggle play/pause silently without HUD and without waking control bar)
        this.singleTapTimeout = setTimeout(() => {
          this.executeSingleTap(clickX, clickY);
          this.singleTapTimeout = null;
        }, 240);
      }
    }

    executeSingleTap(x, y) {
      this.showRipple(x, y);
      // Toggle play/pause directly with zero HUD and without waking up control bar
      if (this.video.paused) {
        this.video.play().catch(() => {});
      } else {
        this.video.pause();
      }
    }

    executeDoubleTap(x, y, containerWidth) {
      this.showRipple(x, y);
      this.toggleFullscreen();
    }

    toggleFullscreen() {
      // 1. Try Bilibili native fullscreen button
      const fullBtn =
        this.container.querySelector('.bpx-player-ctrl-full') ||
        document.querySelector('.bpx-player-ctrl-full') ||
        this.container.querySelector('.bilibili-player-video-btn-fullscreen') ||
        document.querySelector('.bilibili-player-video-btn-fullscreen') ||
        this.container.querySelector('[data-title*="全屏"]') ||
        document.querySelector('[data-title*="全屏"]');

      if (fullBtn) {
        fullBtn.click();
        setTimeout(() => {
          const isFull = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.querySelector('.bpx-player-container[data-screen="full"]') ||
            document.querySelector('.bpx-player-container[data-screen="web"]')
          );
          this.showHUD({
            icon: isFull ? ICONS.fullscreen : ICONS.exitFullscreen,
            title: isFull ? '进入全屏' : '退出全屏',
            autoHide: true,
            hideDelay: 500
          });
        }, 80);
        return;
      }

      // 2. Fallback to HTML5 Fullscreen API
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        this.showHUD({
          icon: ICONS.exitFullscreen,
          title: '退出全屏',
          autoHide: true,
          hideDelay: 500
        });
      } else {
        const target = this.container || this.video;
        if (target.requestFullscreen) {
          target.requestFullscreen().catch(() => {});
        } else if (target.webkitRequestFullscreen) {
          target.webkitRequestFullscreen();
        }
        this.showHUD({
          icon: ICONS.fullscreen,
          title: '进入全屏',
          autoHide: true,
          hideDelay: 500
        });
      }
    }

    togglePlayPause() {
      if (this.video.paused) {
        this.video.play().catch(() => {});
        this.showHUD({
          icon: ICONS.play,
          title: '播放',
          autoHide: true,
          hideDelay: 500
        });
      } else {
        this.video.pause();
        this.showHUD({
          icon: ICONS.pause,
          title: '暂停',
          autoHide: true,
          hideDelay: 500
        });
      }
    }
  }

  // Player Instance Manager
  let currentController = null;

  function findAndAttachPlayer() {
    // Selectors for Bilibili Web player
    const playerContainer =
      document.querySelector('.bpx-player-video-area') ||
      document.querySelector('.bpx-player-video-wrap') ||
      document.querySelector('.bpx-player-container') ||
      document.querySelector('.bilibili-player-video-wrap') ||
      document.querySelector('#bilibili-player');

    if (!playerContainer) return;

    const video = playerContainer.querySelector('video') || document.querySelector('video');
    if (!video) return;

    // Check if controller already attached to this container & video
    if (currentController && currentController.container === playerContainer && currentController.video === video) {
      return;
    }

    // Attach new controller
    try {
      currentController = new BiliTouchPlayer(playerContainer, video);
      console.log('[BiliTouchController] Initialized touch controls for Bilibili player');
    } catch (e) {
      console.error('[BiliTouchController] Initialization error:', e);
    }
  }

  // Initialize observer to watch for dynamic DOM & video changes (SPA navigation, Bangumi, etc.)
  const observer = new MutationObserver(() => {
    findAndAttachPlayer();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Periodic fallback check and URL change listener
  setInterval(findAndAttachPlayer, 1500);
  window.addEventListener('load', findAndAttachPlayer);
  window.addEventListener('popstate', findAndAttachPlayer);
})();
