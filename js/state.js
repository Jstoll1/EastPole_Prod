// ── App State ──────────────────────────────────────────────

// ── Error Tracker ──────────────────────────────────────────
var ErrorTracker = (function() {
  var log = [];
  var MAX_LOG = 200;

  function record(type, message, detail) {
    var entry = {
      ts: new Date().toISOString(),
      type: type,
      message: message,
      detail: detail || null,
      url: window.location.href,
      user: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : null
    };
    log.push(entry);
    if (log.length > MAX_LOG) log.shift();

    var style = type === 'api' ? 'color:#FF7F7F;font-weight:bold'
              : type === 'js'  ? 'color:#f5c518;font-weight:bold'
              :                  'color:#5BC8F5;font-weight:bold';
    console.groupCollapsed('%c⚠ [' + type.toUpperCase() + '] ' + message, style);
    console.log('Time:', entry.ts);
    if (detail) console.log('Detail:', detail);
    console.trace('Stack');
    console.groupEnd();
  }

  function api(message, detail) { record('api', message, detail); }
  function js(message, detail)  { record('js', message, detail); }
  function render(message, detail) { record('render', message, detail); }

  function dump() {
    console.table(log);
    return log;
  }

  function summary() {
    var counts = { api: 0, js: 0, render: 0 };
    log.forEach(function(e) { counts[e.type] = (counts[e.type] || 0) + 1; });
    var recent = log.slice(-10);
    console.log('%c─── Error Summary ───', 'color:var(--gold);font-weight:bold');
    console.log('Total:', log.length, '| API:', counts.api, '| JS:', counts.js, '| Render:', counts.render);
    if (recent.length) {
      console.log('Last', recent.length, 'errors:');
      console.table(recent.map(function(e) { return { time: e.ts, type: e.type, message: e.message }; }));
    }
    return counts;
  }

  return { api: api, js: js, render: render, dump: dump, summary: summary, log: log };
})();

// Global JS error handler
window.addEventListener('error', function(e) {
  ErrorTracker.js(e.message || 'Unknown error', {
    file: e.filename,
    line: e.lineno,
    col: e.colno
  });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
  ErrorTracker.js('Unhandled promise rejection: ' + (e.reason?.message || String(e.reason)), {
    reason: e.reason
  });
});

// ── Tournament Data ──────────────────────────────────────

// ╔══════════════════════════════════════════════════════════════╗
// ║  TOURNAMENT CONFIG — Change these values for each new week  ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  1. ENTRIES        → team picks array                       ║
// ║  2. FLAGS          → player → flag emoji map                ║
// ║  3. PREV_WINNER    → defending champion name                ║
// ║  4. getDefaultPars → 18 hole pars for course (in utils.js)  ║
// ║  5. POOL_CONFIG    → buy-in, payouts                        ║
// ╚══════════════════════════════════════════════════════════════╝

var ENTRIES = [];

// 2026 Masters Tournament — 91-player field (from masters.com)
var FLAGS = {
  'Ludvig Aberg':'🇸🇪','Daniel Berger':'🇺🇸','Akshay Bhatia':'🇺🇸',
  'Keegan Bradley':'🇺🇸','Michael Brennan':'🇺🇸','Jacob Bridgeman':'🇺🇸',
  'Sam Burns':'🇺🇸','Angel Cabrera':'🇦🇷','Brian Campbell':'🇺🇸',
  'Patrick Cantlay':'🇺🇸','Wyndham Clark':'🇺🇸','Corey Conners':'🇨🇦',
  'Fred Couples':'🇺🇸','Jason Day':'🇦🇺','Bryson DeChambeau':'🇺🇸',
  'Nicolas Echavarria':'🇨🇴','Harris English':'🇺🇸','Ethan Fang':'🇺🇸',
  'Matt Fitzpatrick':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Tommy Fleetwood':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Ryan Fox':'🇳🇿',
  'Sergio Garcia':'🇪🇸','Ryan Gerard':'🇺🇸','Chris Gotterup':'🇺🇸',
  'Max Greyserman':'🇺🇸','Ben Griffin':'🇺🇸','Harry Hall':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Brian Harman':'🇺🇸','Tyrrell Hatton':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Russell Henley':'🇺🇸',
  'Jackson Herrington':'🇺🇸','Nicolai Hojgaard':'🇩🇰','Rasmus Hojgaard':'🇩🇰',
  'Brandon Holtz':'🇺🇸','Max Homa':'🇺🇸','Viktor Hovland':'🇳🇴',
  'Mason Howell':'🇺🇸','Sungjae Im':'🇰🇷','Casey Jarvis':'🇿🇦',
  'Dustin Johnson':'🇺🇸','Zach Johnson':'🇺🇸','Naoyuki Kataoka':'🇯🇵',
  'John Keefer':'🇺🇸','Michael Kim':'🇺🇸','Si Woo Kim':'🇰🇷',
  'Kurt Kitayama':'🇺🇸','Jake Knapp':'🇺🇸','Brooks Koepka':'🇺🇸',
  'Fifa Laopakdee':'🇹🇭','Min Woo Lee':'🇦🇺','Haotong Li':'🇨🇳',
  'Shane Lowry':'🇮🇪','Robert MacIntyre':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Hideki Matsuyama':'🇯🇵',
  'Matt McCarty':'🇺🇸','Rory McIlroy':'🇬🇧','Tom McKibbin':'🇬🇧',
  'Maverick McNealy':'🇺🇸','Collin Morikawa':'🇺🇸','Rasmus Neergaard-Petersen':'🇩🇰',
  'Alex Noren':'🇸🇪','Andrew Novak':'🇺🇸','Jose Maria Olazabal':'🇪🇸',
  'Carlos Ortiz':'🇲🇽','Marco Penge':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Aldrich Potgieter':'🇿🇦',
  'Mateo Pulcini':'🇦🇷','Jon Rahm':'🇪🇸','Aaron Rai':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Patrick Reed':'🇺🇸','Kristoffer Reitan':'🇳🇴','Davis Riley':'🇺🇸',
  'Justin Rose':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Xander Schauffele':'🇺🇸','Scottie Scheffler':'🇺🇸',
  'Charl Schwartzel':'🇿🇦','Adam Scott':'🇦🇺','Vijay Singh':'🇫🇯',
  'Cameron Smith':'🇦🇺','J.J. Spaun':'🇺🇸','Jordan Spieth':'🇺🇸',
  'Samuel Stevens':'🇺🇸','Sepp Straka':'🇦🇹','Nick Taylor':'🇨🇦',
  'Justin Thomas':'🇺🇸','Sami Valimaki':'🇫🇮','Bubba Watson':'🇺🇸',
  'Mike Weir':'🇨🇦','Danny Willett':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Gary Woodland':'🇺🇸',
  'Cameron Young':'🇺🇸'
};

var TIERS = [];
var NAME_ALIASES = {
  'Ludvig Åberg':'Ludvig Aberg',
  'Ángel Cabrera':'Angel Cabrera',
  'Sergio García':'Sergio Garcia',
  'Nicolai Højgaard':'Nicolai Hojgaard',
  'Rasmus Højgaard':'Rasmus Hojgaard',
  'José María Olazábal':'Jose Maria Olazabal',
  'Sami Välimäki':'Sami Valimaki',
  'Alex Norén':'Alex Noren',
  'Thorbjørn Olesen':'Thorbjorn Olesen',
  'Stephan Jäger':'Stephan Jaeger',
  'Hao-Tong Li':'Haotong Li',
  'Seonghyeon Kim':'S.H. Kim',
  'Jordan L. Smith':'Jordan Smith',
  'Adrien Dumont de Chassart':'Adrien Dumont De Chassart',
  'Johnny Keefer':'John Keefer'
};
var FLAG_TO_CODE = {'🇺🇸':'USA','🇦🇺':'AUS','🇰🇷':'KOR','🇨🇦':'CAN','🇿🇦':'RSA','🇩🇰':'DEN','🇸🇪':'SWE','🇫🇷':'FRA','🇯🇵':'JPN','🇮🇪':'IRL','🇧🇪':'BEL','🇦🇷':'ARG','🇹🇼':'TPE','🇻🇪':'VEN','🇵🇭':'PHI','🇵🇷':'PUR','🇩🇪':'GER','🇳🇿':'NZL','🇨🇴':'COL','🇨🇳':'CHN','🇳🇴':'NOR','🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG','🏴󠁧󠁢󠁳󠁣󠁴󠁿':'SCO','🏴󠁧󠁢󠁷󠁬󠁳󠁿':'WAL','🇫🇮':'FIN','🇦🇹':'AUT','🇮🇹':'ITA','🇪🇸':'ESP','🇨🇭':'CHE','🇳🇱':'NED','🇮🇸':'ISL','🇲🇽':'MEX','🇹🇭':'THA','🇫🇯':'FIJ','🇬🇧':'NIR','🏳️':'—'};
// ESPN serves country codes (3-letter) on c.athlete.flag.alt — convert to emoji
var CODE_TO_FLAG = {'USA':'🇺🇸','AUS':'🇦🇺','KOR':'🇰🇷','CAN':'🇨🇦','RSA':'🇿🇦','ZAF':'🇿🇦','DEN':'🇩🇰','DNK':'🇩🇰','SWE':'🇸🇪','FRA':'🇫🇷','JPN':'🇯🇵','JAP':'🇯🇵','IRL':'🇮🇪','BEL':'🇧🇪','ARG':'🇦🇷','TPE':'🇹🇼','TWN':'🇹🇼','VEN':'🇻🇪','PHI':'🇵🇭','PHL':'🇵🇭','PUR':'🇵🇷','PRI':'🇵🇷','GER':'🇩🇪','DEU':'🇩🇪','NZL':'🇳🇿','COL':'🇨🇴','CHN':'🇨🇳','NOR':'🇳🇴','ENG':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','SCO':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','WAL':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','GBR':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','FIN':'🇫🇮','AUT':'🇦🇹','ITA':'🇮🇹','ESP':'🇪🇸','SUI':'🇨🇭','CHE':'🇨🇭','NED':'🇳🇱','NLD':'🇳🇱','ISL':'🇮🇸','NIR':'🇬🇧','MEX':'🇲🇽','THA':'🇹🇭','THL':'🇹🇭','FIJ':'🇫🇯','FJI':'🇫🇯'};

var PREV_WINNER = 'Rory McIlroy';

// 2026 Masters amateurs — displayed with (a) suffix
var AMATEURS = new Set([
  'Ethan Fang',
  'Jackson Herrington',
  'Brandon Holtz',
  'Mason Howell',
  'Fifa Laopakdee',
  'Mateo Pulcini'
]);

// PRE_ODDS: [winner, top5, top10] — populate with Masters odds when ready
var PRE_ODDS = {};

// 2026 Masters pool config
var POOL_CONFIG = {
  buyIn: 20,
  fifthEntryBuyIn: 10,
  maxEntriesPerPerson: 5,
  picksPerTeam: 10,
  bestN: 4,
  // 1st = 70% of (pot - 3rd reimbursement), 2nd = 30% of (pot - 3rd reimbursement)
  // 3rd = single entry fee reimbursed ($20)
  payoutPctOfNet: { first: 0.70, second: 0.30 }
};

var PILL_CLASSES = ['pill-a', 'pill-b', 'pill-c'];
function pillLabel(teamIdx) { return teamIdx + 1; }

// ── Mutable State ──────────────────────────────────────────

var GOLFER_SCORES = {};
var allTeamEmails = [];
var PREV_POSITIONS = {};
var PREV_RANKS = {};
var ROUND_START_POSITIONS = {};
var ROUND_START_ENTRY_RANKS = {};
var ROUND_START_ROUND = 0;
var PREV_SCORES = {};
var PREV_THRU = {};
var SCORE_CHANGES = {};
var OWNERSHIP_DATA = [];
var TOURNAMENT_STARTED = false;
var ESPN_ROUND = 0;
var ATHLETE_IDS = {};
var EVENT_ID = null;
var SCORECARD_CACHE = {};
var COURSE_HOLES = null;
var COURSE_PAR = 72; // Augusta National — par 72 [4,5,4,3,4,3,4,5,4,4,4,3,5,4,5,3,4,4]

var WINNING_SCORE = null; // actual tournament winner's score to par (set when tourney final)
var TOURNEY_FINAL = false; // true when all 4 rounds complete, 0 holes left

var lastFetchTime = 0;
var _lastStatusText = 'Loading…';
var _renderCount = 0;

// User state
var currentUserEmail = null;
var currentUserTeams = [];
var activeTeamIdx = 0;
Object.defineProperty(window, 'currentTeamEmail', { get: function() { return currentUserEmail; } });

var STORAGE_KEY = 'eastpole_v2';
var SPLASH_DATE_KEY = 'eastpole_splash_date';
var PLAYER_EMOJI_KEY = 'eastpole_player_emoji';
var PLAYER_EMOJI = {};
try { PLAYER_EMOJI = JSON.parse(localStorage.getItem(PLAYER_EMOJI_KEY) || '{}'); } catch(e) {}

function getPlayerEmoji(name) { return PLAYER_EMOJI[name] || ''; }
function setPlayerEmoji(name, emoji) {
  if (emoji) PLAYER_EMOJI[name] = emoji; else delete PLAYER_EMOJI[name];
  try { localStorage.setItem(PLAYER_EMOJI_KEY, JSON.stringify(PLAYER_EMOJI)); } catch(e) {}
}

// Load round-start positions from localStorage
try {
  // Migrate: clear old entry ranks keyed by team name only
  if (!localStorage.getItem('eastpole_rsr_v2')) {
    var oldData = JSON.parse(localStorage.getItem('eastpole_round_start') || '{}');
    if (oldData.entryRanks) { delete oldData.entryRanks; localStorage.setItem('eastpole_round_start', JSON.stringify(oldData)); }
    localStorage.setItem('eastpole_rsr_v2', '1');
  }
  var saved = JSON.parse(localStorage.getItem('eastpole_round_start') || '{}');
  var posAge = saved.timestamp ? Date.now() - saved.timestamp : Infinity;
  if (saved.round && saved.positions && posAge < 18 * 60 * 60 * 1000) { ROUND_START_POSITIONS = saved.positions; ROUND_START_ROUND = saved.round; if (saved.entryRanks) ROUND_START_ENTRY_RANKS = saved.entryRanks; }
} catch(e) {}

function saveRoundStartPositions(round) {
  ROUND_START_ROUND = round;
  ROUND_START_POSITIONS = {};
  Object.entries(GOLFER_SCORES).forEach(function(pair) {
    var p = parsePos(pair[1].pos);
    if (p) ROUND_START_POSITIONS[pair[0]] = p;
  });
  // Snapshot entry ranks at round start
  ROUND_START_ENTRY_RANKS = {};
  var ranked = getRanked();
  var rk = 1;
  ranked.forEach(function(e, i) {
    if (i > 0 && ranked[i].total !== ranked[i-1].total) rk = i + 1;
    ROUND_START_ENTRY_RANKS[e.team + '|' + e.email] = rk;
  });
  try { localStorage.setItem('eastpole_round_start', JSON.stringify({ round: round, positions: ROUND_START_POSITIONS, entryRanks: ROUND_START_ENTRY_RANKS, timestamp: Date.now() })); } catch(e) {}
}

function shouldShowSplash() {
  return true;
}

function markSplashSeen() {
  try {
    var today = new Date().toISOString().slice(0, 10);
    var data;
    try { data = JSON.parse(localStorage.getItem(SPLASH_DATE_KEY) || '{}'); } catch(e) { data = {}; }
    if (typeof data !== 'object' || data === null) data = {};
    if (data.date !== today) data = { date: today, count: 0 };
    data.count = (data.count || 0) + 1;
    localStorage.setItem(SPLASH_DATE_KEY, JSON.stringify(data));
  } catch(e) {}
}

function saveUser() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: currentUserEmail, activeTeamIdx: activeTeamIdx })); } catch(e) {} }

function loadUser() {
  try {
    var s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (s?.email && ENTRIES.some(function(e) { return e.email === s.email; })) {
      setUser(s.email, s.activeTeamIdx != null ? s.activeTeamIdx : -1, false);
      return true;
    }
  } catch(e) {}
  return false;
}

function setUser(email, teamIdx, save) {
  if (save === undefined) save = true;
  currentUserEmail = email;
  currentUserTeams = ENTRIES.filter(function(e) { return e.email === email; });
  activeTeamIdx = teamIdx === -1 ? -1 : Math.min(teamIdx, Math.max(0, currentUserTeams.length - 1));
  if (save) saveUser();
  updateHeaderDisplay();
  updateLbSeg();
  renderAll();
}
