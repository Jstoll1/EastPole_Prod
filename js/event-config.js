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

    // Tag <body> with the event id so styles.css can add subtle per-event
    // accents without touching the durable East Pole brand. Strip any
    // prior event- class first so switching events cleanly deactivates
    // the previous theme.
    if (document && document.body && cfg.id) {
      Array.prototype.slice.call(document.body.classList).forEach(function(c) {
        if (c.indexOf('event-') === 0) document.body.classList.remove(c);
      });
      document.body.classList.add('event-' + String(cfg.id).replace(/[^a-z0-9-]/gi, '').toLowerCase());
    }

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

    // Optional display-name override. Lets us preview a future event's
    // branding (e.g. "PGA Championship") in the header before ESPN starts
    // reporting that tournament. api.js prefers this over TOURNEY_NAME
    // when set.
    if (cfg.displayName) window.EVENT_DISPLAY_NAME = cfg.displayName;

    // Optional event logo URL (relative or absolute). When set, api.js
    // renders this image in the header / splash in place of the built-in
    // trophy SVG.
    if (cfg.logo) window.EVENT_LOGO_URL = cfg.logo;

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

    // Seed TOURNEY_COURSE so the F5 panel + header chip have a name to show
    // before ESPN's venue feed warms up. api.js preserves this if ESPN's
    // venue is missing/blank on subsequent polls.
    if (cfg.course && typeof TOURNEY_COURSE !== 'undefined') {
      window.TOURNEY_COURSE = cfg.course;
      // Hard pin: prevent api.js from clobbering with ESPN's "current event"
      // venue while we're still between tournaments. api.js honors this.
      window.EVENT_COURSE_OVERRIDE = cfg.course;
    }

    // Date override for the splash chip — pinned dates from the JSON win
    // over ESPN's "current event" dates, which would otherwise show the
    // in-between PGA Tour stop (e.g. RBC Canadian Open) until ESPN's
    // scoreboard flips to the upcoming major on Wednesday.
    if (cfg.dates && cfg.dates.start) {
      var s = new Date(cfg.dates.start + 'T12:00:00Z');
      var e = cfg.dates.end ? new Date(cfg.dates.end + 'T12:00:00Z') : null;
      var opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
      var sStr = s.toLocaleDateString('en-US', opts);
      var eStr = e ? e.toLocaleDateString('en-US', opts) : '';
      window.EVENT_DATES_OVERRIDE = e ? (sStr + ' – ' + eStr) : sStr;
      // Raw ISO start/end so other code (e.g. the weather modal) can
      // align round indices to specific forecast days.
      window.EVENT_DATES_START_ISO = cfg.dates.start;
      window.EVENT_DATES_END_ISO = cfg.dates.end || '';
    }
  }
})();
