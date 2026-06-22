/* ============================================================
   FAZMEN – Premium Video Audit Website
   script.js
   ============================================================ */

(function () {
  'use strict';

  /* ====================
     CONFIGURATION
     ==================== */
  const CONFIG = {
    clinicName: 'Klinik Cantik A',
    auditDate: '22 Juni 2026',
    whatsappNumber: '628xxxxxxxxxx',
    whatsappMessage: 'Halo, saya tertarik membuat website untuk klinik saya.',
    transcriptPath: 'transcripts/transcript.json',
    videos: {
      personal: 'videos/personal.mp4',
      main: 'videos/main.mp4'
    },
    speedOptions: [0.5, 0.75, 1, 1.25, 1.5, 2]
  };

  /* ====================
     DOM REFERENCES
     ==================== */
  const $ = (sel, parent = document) => parent.querySelector(sel);
  const $$ = (sel, parent = document) => parent.querySelectorAll(sel);

  const DOM = {
    // Video
    videoPlayer: $('#video-player'),
    videoWrapper: $('#video-wrapper'),
    videoContainer: $('#video-container'),
    videoSkeleton: $('#video-skeleton'),
    videoOverlay: $('#video-overlay'),
    bigPlayBtn: $('#big-play-btn'),

    // Controls
    ctrlPlay: $('#ctrl-play'),
    ctrlRewind: $('#ctrl-rewind'),
    ctrlSpeed: $('#ctrl-speed'),
    ctrlPip: $('#ctrl-pip'),
    ctrlFullscreen: $('#ctrl-fullscreen'),
    timeDisplay: $('#time-display'),
    seekBarContainer: $('#seek-bar-container'),
    seekBarTrack: $('#seek-bar-track'),
    seekBarFilled: $('#seek-bar-filled'),
    seekBarBuffered: $('#seek-bar-buffered'),
    seekBarHandle: $('#seek-bar-handle'),
    videoControls: $('#video-controls'),

    // Sidebar
    tabBtns: $$('.tab-btn'),
    tabContents: $$('.tab-content'),
    transcriptList: $('#transcript-list'),
    transcriptSkeleton: $('#transcript-skeleton'),

    // Progress
    progressPercent: $('#progress-percent'),
    watchProgressFill: $('#watch-progress-fill'),
    totalDuration: $('#total-duration'),

    // Config-driven
    clinicName: $('#clinic-name'),
    auditDate: $('#audit-date'),
    ctaWhatsappBtn: $('#cta-whatsapp-btn')
  };

  /* ====================
     STATE
     ==================== */
  const state = {
    isPlaying: false,
    currentVideo: 'personal', // 'personal' | 'main'
    personalDuration: 0,
    mainDuration: 0,
    totalDuration: 0,
    currentSpeedIdx: 2, // index in CONFIG.speedOptions (1x)
    transcript: [],
    activeTranscriptIdx: -1,
    isSeeking: false,
    controlsTimeout: null,
    mainVideoReady: false,
    personalEnded: false,
    maxWatchedTime: 0,
    isFullscreen: false,
    videosLoaded: { personal: false, main: false }
  };

  // Preload main video element (hidden)
  const mainVideoEl = document.createElement('video');
  mainVideoEl.preload = 'metadata';
  mainVideoEl.src = CONFIG.videos.main;
  mainVideoEl.playsInline = true;

  /* ====================
     INITIALIZATION
     ==================== */
  function init() {
    applyConfig();
    setupVideo();
    setupControls();
    setupTabs();
    loadTranscript();
    setupScrollReveal();
    setupWhatsAppLinks();
    showControlsTemporarily();
  }

  function applyConfig() {
    if (DOM.clinicName) DOM.clinicName.textContent = CONFIG.clinicName;
    if (DOM.auditDate) DOM.auditDate.textContent = CONFIG.auditDate;
    document.title = `Audit Website – ${CONFIG.clinicName} | FAZMEN`;
  }

  /* ====================
     VIDEO SYSTEM
     ==================== */
  function setupVideo() {
    const video = DOM.videoPlayer;

    // When metadata is loaded
    video.addEventListener('loadedmetadata', () => {
      if (state.currentVideo === 'personal') {
        state.personalDuration = video.duration;
        state.videosLoaded.personal = true;
        recalcTotalDuration();
      }
      hideSkeleton();
    });

    // Preload main video metadata
    mainVideoEl.addEventListener('loadedmetadata', () => {
      state.mainDuration = mainVideoEl.duration;
      state.videosLoaded.main = true;
      state.mainVideoReady = true;
      recalcTotalDuration();
    });

    // Time update
    video.addEventListener('timeupdate', onTimeUpdate);

    // Buffer progress
    video.addEventListener('progress', updateBuffered);

    // When personal video ends, switch to main
    video.addEventListener('ended', onVideoEnded);

    // Error handling
    video.addEventListener('error', () => {
      hideSkeleton();
      console.warn('Video failed to load. Please ensure video files exist in the videos/ folder.');
    });

    // Play / Pause state sync
    video.addEventListener('play', () => {
      state.isPlaying = true;
      updatePlayIcon();
    });
    video.addEventListener('pause', () => {
      state.isPlaying = false;
      updatePlayIcon();
    });

    // Click on video to toggle play
    video.addEventListener('click', togglePlay);

    // Big play button
    DOM.bigPlayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    // Overlay click
    DOM.videoOverlay.addEventListener('click', (e) => {
      if (e.target === DOM.videoOverlay) togglePlay();
    });
  }

  function recalcTotalDuration() {
    state.totalDuration = state.personalDuration + state.mainDuration;
    DOM.totalDuration.textContent = formatTime(state.totalDuration);
    updateTimeDisplay();
  }

  function hideSkeleton() {
    if (DOM.videoSkeleton) {
      DOM.videoSkeleton.classList.add('hidden');
    }
  }

  function togglePlay() {
    const video = DOM.videoPlayer;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
      DOM.videoOverlay.classList.add('hidden');
    } else {
      video.pause();
    }
  }

  function updatePlayIcon() {
    const playIcon = $('.icon-play', DOM.ctrlPlay);
    const pauseIcon = $('.icon-pause', DOM.ctrlPlay);
    if (state.isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  }

  function onTimeUpdate() {
    if (state.isSeeking) return;
    const video = DOM.videoPlayer;
    const currentGlobalTime = getGlobalTime();

    // Track max watched
    if (currentGlobalTime > state.maxWatchedTime) {
      state.maxWatchedTime = currentGlobalTime;
    }

    updateTimeDisplay();
    updateSeekBar();
    updateWatchProgress();
    syncTranscript(currentGlobalTime);
  }

  function getGlobalTime() {
    const video = DOM.videoPlayer;
    if (state.currentVideo === 'personal') {
      return video.currentTime;
    } else {
      return state.personalDuration + video.currentTime;
    }
  }

  function updateTimeDisplay() {
    const globalTime = getGlobalTime();
    DOM.timeDisplay.textContent = `${formatTime(globalTime)} / ${formatTime(state.totalDuration)}`;
  }

  function updateSeekBar() {
    const globalTime = getGlobalTime();
    const pct = state.totalDuration > 0 ? (globalTime / state.totalDuration) * 100 : 0;
    DOM.seekBarFilled.style.width = pct + '%';
    DOM.seekBarHandle.style.left = pct + '%';
  }

  function updateBuffered() {
    const video = DOM.videoPlayer;
    if (video.buffered.length > 0) {
      const buffEnd = video.buffered.end(video.buffered.length - 1);
      let globalBuffered;
      if (state.currentVideo === 'personal') {
        globalBuffered = buffEnd;
      } else {
        globalBuffered = state.personalDuration + buffEnd;
      }
      const pct = state.totalDuration > 0 ? (globalBuffered / state.totalDuration) * 100 : 0;
      DOM.seekBarBuffered.style.width = Math.min(pct, 100) + '%';
    }
  }

  function updateWatchProgress() {
    const pct = state.totalDuration > 0
      ? Math.round((state.maxWatchedTime / state.totalDuration) * 100)
      : 0;
    const clampedPct = Math.min(pct, 100);
    DOM.progressPercent.textContent = clampedPct + '%';
    DOM.watchProgressFill.style.width = clampedPct + '%';
  }

  function onVideoEnded() {
    if (state.currentVideo === 'personal' && !state.personalEnded) {
      // Switch to main video
      state.personalEnded = true;
      state.currentVideo = 'main';
      const video = DOM.videoPlayer;
      const wasPlaying = !video.paused;

      video.src = CONFIG.videos.main;
      video.load();

      video.addEventListener('loadeddata', function onLoaded() {
        video.removeEventListener('loadeddata', onLoaded);
        if (wasPlaying) {
          video.play().catch(() => {});
        }
      });
    }
  }

  function seekToGlobal(globalTime) {
    const video = DOM.videoPlayer;
    globalTime = Math.max(0, Math.min(globalTime, state.totalDuration));

    if (globalTime < state.personalDuration) {
      // Need to be in personal video
      if (state.currentVideo !== 'personal') {
        state.currentVideo = 'personal';
        state.personalEnded = false;
        const wasPlaying = state.isPlaying;
        video.src = CONFIG.videos.personal;
        video.load();
        video.addEventListener('loadeddata', function onLoaded() {
          video.removeEventListener('loadeddata', onLoaded);
          video.currentTime = globalTime;
          if (wasPlaying) video.play().catch(() => {});
        });
      } else {
        video.currentTime = globalTime;
      }
    } else {
      // Need to be in main video
      const mainTime = globalTime - state.personalDuration;
      if (state.currentVideo !== 'main') {
        state.currentVideo = 'main';
        state.personalEnded = true;
        const wasPlaying = state.isPlaying;
        video.src = CONFIG.videos.main;
        video.load();
        video.addEventListener('loadeddata', function onLoaded() {
          video.removeEventListener('loadeddata', onLoaded);
          video.currentTime = mainTime;
          if (wasPlaying) video.play().catch(() => {});
        });
      } else {
        video.currentTime = mainTime;
      }
    }
  }

  /* ====================
     CONTROLS
     ==================== */
  function setupControls() {
    // Play/Pause
    DOM.ctrlPlay.addEventListener('click', togglePlay);

    // Rewind 10s
    DOM.ctrlRewind.addEventListener('click', () => {
      const current = getGlobalTime();
      seekToGlobal(current - 10);
    });

    // Speed
    DOM.ctrlSpeed.addEventListener('click', cycleSpeed);

    // Picture in Picture
    DOM.ctrlPip.addEventListener('click', togglePip);

    // Fullscreen
    DOM.ctrlFullscreen.addEventListener('click', toggleFullscreen);

    // Seek bar interaction
    setupSeekBar();

    // Show/hide controls on mouse movement
    setupControlsVisibility();

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
  }

  function cycleSpeed() {
    state.currentSpeedIdx = (state.currentSpeedIdx + 1) % CONFIG.speedOptions.length;
    const speed = CONFIG.speedOptions[state.currentSpeedIdx];
    DOM.videoPlayer.playbackRate = speed;
    DOM.ctrlSpeed.textContent = speed === 1 ? '1x' : speed + 'x';
  }

  function togglePip() {
    const video = DOM.videoPlayer;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    } else if (video.requestPictureInPicture) {
      video.requestPictureInPicture().catch(() => {});
    }
  }

  function toggleFullscreen() {
    const container = DOM.videoContainer;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        state.isFullscreen = true;
        container.classList.add('fullscreen');
        updateFullscreenIcon();
      }).catch(() => {
        // Fallback: use CSS fullscreen
        state.isFullscreen = true;
        container.classList.add('fullscreen');
        updateFullscreenIcon();
      });
    } else {
      document.exitFullscreen().then(() => {
        state.isFullscreen = false;
        container.classList.remove('fullscreen');
        updateFullscreenIcon();
      }).catch(() => {});
    }
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      state.isFullscreen = false;
      DOM.videoContainer.classList.remove('fullscreen');
      updateFullscreenIcon();
    }
  });

  function updateFullscreenIcon() {
    const expand = $('.icon-expand', DOM.ctrlFullscreen);
    const compress = $('.icon-compress', DOM.ctrlFullscreen);
    if (state.isFullscreen) {
      expand.style.display = 'none';
      compress.style.display = 'block';
    } else {
      expand.style.display = 'block';
      compress.style.display = 'none';
    }
  }

  function setupSeekBar() {
    const container = DOM.seekBarContainer;
    let dragging = false;

    function getSeekPercent(e) {
      const rect = container.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    }

    function startSeek(e) {
      dragging = true;
      state.isSeeking = true;
      updateSeekPosition(e);
    }

    function moveSeek(e) {
      if (!dragging) return;
      e.preventDefault();
      updateSeekPosition(e);
    }

    function endSeek(e) {
      if (!dragging) return;
      dragging = false;
      state.isSeeking = false;
      updateSeekPosition(e);
      const pct = parseFloat(DOM.seekBarFilled.style.width) / 100;
      const targetTime = pct * state.totalDuration;
      seekToGlobal(targetTime);
    }

    function updateSeekPosition(e) {
      const pct = getSeekPercent(e) * 100;
      DOM.seekBarFilled.style.width = pct + '%';
      DOM.seekBarHandle.style.left = pct + '%';
      // Update time display preview
      const previewTime = (pct / 100) * state.totalDuration;
      DOM.timeDisplay.textContent = `${formatTime(previewTime)} / ${formatTime(state.totalDuration)}`;
    }

    container.addEventListener('mousedown', startSeek);
    document.addEventListener('mousemove', moveSeek);
    document.addEventListener('mouseup', endSeek);

    container.addEventListener('touchstart', startSeek, { passive: true });
    document.addEventListener('touchmove', moveSeek, { passive: false });
    document.addEventListener('touchend', endSeek);
  }

  function setupControlsVisibility() {
    let timeout;
    const wrapper = DOM.videoWrapper;
    const controls = DOM.videoControls;

    function showControls() {
      controls.classList.add('show');
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (state.isPlaying) {
          controls.classList.remove('show');
        }
      }, 3000);
    }

    wrapper.addEventListener('mousemove', showControls);
    wrapper.addEventListener('mouseenter', showControls);
    wrapper.addEventListener('mouseleave', () => {
      if (state.isPlaying) {
        clearTimeout(timeout);
        timeout = setTimeout(() => controls.classList.remove('show'), 800);
      }
    });

    // Touch devices
    wrapper.addEventListener('touchstart', () => {
      showControls();
    }, { passive: true });
  }

  function showControlsTemporarily() {
    DOM.videoControls.classList.add('show');
    setTimeout(() => {
      DOM.videoControls.classList.remove('show');
    }, 3000);
  }

  function handleKeyboard(e) {
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        seekToGlobal(getGlobalTime() - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        seekToGlobal(getGlobalTime() + 5);
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
        e.preventDefault();
        DOM.videoPlayer.muted = !DOM.videoPlayer.muted;
        break;
    }
  }

  /* ====================
     TABS
     ==================== */
  function setupTabs() {
    DOM.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        activateTab(tabName);
      });
    });
  }

  function activateTab(tabName) {
    DOM.tabBtns.forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    DOM.tabContents.forEach(content => {
      const isActive = content.id === `tab-${tabName}`;
      content.classList.toggle('active', isActive);
    });
  }

  /* ====================
     TRANSCRIPT
     ==================== */
  function loadTranscript() {
    fetch(CONFIG.transcriptPath)
      .then(res => {
        if (!res.ok) throw new Error('Transcript not found');
        return res.json();
      })
      .then(data => {
        state.transcript = data;
        renderTranscript(data);
      })
      .catch(err => {
        console.warn('Transcript load error:', err);
        renderTranscriptFallback();
      });
  }

  function renderTranscript(entries) {
    // Remove skeleton
    if (DOM.transcriptSkeleton) {
      DOM.transcriptSkeleton.remove();
    }

    const fragment = document.createDocumentFragment();

    entries.forEach((entry, idx) => {
      const el = document.createElement('div');
      el.className = 'transcript-entry';
      el.setAttribute('data-index', idx);
      el.setAttribute('data-start', entry.start);
      el.setAttribute('data-end', entry.end);
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `Lompat ke ${formatTime(entry.start)}`);

      el.innerHTML = `
        <div class="transcript-time">${formatTime(entry.start)}</div>
        <div class="transcript-text">${escapeHtml(entry.text)}</div>
      `;

      el.addEventListener('click', () => {
        seekToGlobal(entry.start);
        // Start playing if paused
        if (DOM.videoPlayer.paused) {
          setTimeout(() => togglePlay(), 200);
        }
      });

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          seekToGlobal(entry.start);
          if (DOM.videoPlayer.paused) {
            setTimeout(() => togglePlay(), 200);
          }
        }
      });

      fragment.appendChild(el);
    });

    DOM.transcriptList.appendChild(fragment);
  }

  function renderTranscriptFallback() {
    if (DOM.transcriptSkeleton) {
      DOM.transcriptSkeleton.remove();
    }
    DOM.transcriptList.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 13px;">
        Transcript belum tersedia.
      </div>
    `;
  }

  function syncTranscript(globalTime) {
    const entries = state.transcript;
    if (!entries.length) return;

    let activeIdx = -1;
    for (let i = 0; i < entries.length; i++) {
      if (globalTime >= entries[i].start && globalTime < entries[i].end) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx !== state.activeTranscriptIdx) {
      state.activeTranscriptIdx = activeIdx;
      highlightTranscript(activeIdx);
    }
  }

  function highlightTranscript(activeIdx) {
    const allEntries = $$('.transcript-entry', DOM.transcriptList);
    allEntries.forEach((el, idx) => {
      el.classList.toggle('active', idx === activeIdx);
    });

    // Auto-scroll to active entry
    if (activeIdx >= 0 && allEntries[activeIdx]) {
      const entry = allEntries[activeIdx];
      const sidebarBody = entry.closest('.sidebar-body');
      if (sidebarBody) {
        const entryRect = entry.getBoundingClientRect();
        const bodyRect = sidebarBody.getBoundingClientRect();

        if (entryRect.top < bodyRect.top || entryRect.bottom > bodyRect.bottom) {
          entry.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }
  }

  /* ====================
     SCROLL REVEAL ANIMATION
     ==================== */
  function setupScrollReveal() {
    const revealElements = $$('.scroll-reveal');
    if (!revealElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    revealElements.forEach(el => observer.observe(el));
  }

  /* ====================
     WHATSAPP LINKS
     ==================== */
  function setupWhatsAppLinks() {
    const encodedMsg = encodeURIComponent(CONFIG.whatsappMessage);
    const waUrl = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodedMsg}`;

    if (DOM.ctaWhatsappBtn) {
      DOM.ctaWhatsappBtn.href = waUrl;
    }

    // Also update any other WhatsApp links
    $$('[data-whatsapp]').forEach(el => {
      el.href = waUrl;
    });
  }

  /* ====================
     UTILITIES
     ==================== */
  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const s = Math.floor(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ====================
     BOOT
     ==================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
