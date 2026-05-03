// ── Per-event config loader ────────────────────────────────
// Fetches events/current.json at boot and applies its values to the
// global config that state.js seeds with defaults.
//
// Why: switching tournaments used to mean editing POOL_SHEET_URL,
// POOL_CONFIG.tournamentNameMatch, PREV_WINNER, AMATEURS, COURSE_TZ
// across 4-5 files. Now drop in a JSON and deploy. See events/README.md.
//
// Boot ordering: state.js loads first (sets defaults), event-config.js
// loads next (overrides with per-event values), the rest of the app
// reads the now-current globals normally. fetchESPN waits on this file
// so api.js sees the right tournamentNameMatch on its first poll.

(function() {
  var URL = './events/current.json';
  // Promise the rest of the app can await before pulling tournament data.
  // Resolves with the config object (or null if load failed).
  window.eventConfigReady = fetch(URL, { cache: 'no-store' })
    .then(function(res) {
      if (!res.ok) throw new Error('events/current.json HTTP ' + res.status);
      return res.json();
    })
    .then(function(cfg) {
      _apply(cfg);
      console.log('🏷️ Event config loaded:', cfg.id || cfg.name || '(unnamed)');
      return cfg;
    })
    .catch(function(e) {
      console.warn('⚠️ event-config: using state.js defaults —', e.message);
      return null;
    });

  function _apply(cfg) {
    if (!cfg || typeof cfg !== 'object') return;

    // Pool config — merge into existing POOL_CONFIG so unspecified keys
    // keep their defaults from state.js.
    if (typeof POOL_CONFIG !== 'undefined') {
      if (cfg.pool && typeof cfg.pool === 'object') {
        Object.keys(cfg.pool).forEach(function(k) { POOL_CONFIG[k] = cfg.pool[k]; });
      }
      if (cfg.espn) {
        if (cfg.espn.tournamentNameMatch) POOL_CONFIG.tournamentNameMatch = cfg.espn.tournamentNameMatch;
        if (cfg.espn.tournamentDate)      POOL_CONFIG.tournamentDate      = cfg.espn.tournamentDate;
      }
    }

    // Pool sheet URL — entry-loader reads this global on every fetch.
    if (cfg.sheet && cfg.sheet.publishedTsvUrl) {
      window.POOL_SHEET_URL = cfg.sheet.publishedTsvUrl;
    }

    // Defending champion (rendered in F1 leaderboard "Def. Champion" badge).
    if (typeof cfg.previousWinner === 'string') {
      window.PREV_WINNER = cfg.previousWinner;
    }

    // Amateurs — replace the Set; entries shown with (a) suffix.
    if (Array.isArray(cfg.amateurs)) {
      window.AMATEURS = new Set(cfg.amateurs);
    }

    // Course timezone override — extends COURSE_TZ so fmtTeeTime resolves
    // correctly without requiring a state.js edit per new venue.
    if (cfg.course && cfg.courseTimezone && typeof COURSE_TZ !== 'undefined') {
      COURSE_TZ[cfg.course] = cfg.courseTimezone;
    }
  }
})();
