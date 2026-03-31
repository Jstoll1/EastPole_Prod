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

var FLAGS = {};

var TIERS = [];
var NAME_ALIASES = {};
var FLAG_TO_CODE = {'🇺🇸':'USA','🇦🇺':'AUS','🇰🇷':'KOR','🇨🇦':'CAN','🇿🇦':'RSA','🇩🇰':'DEN','🇸🇪':'SWE','🇫🇷':'FRA','🇯🇵':'JPN','🇮🇪':'IRL','🇧🇪':'BEL','🇦🇷':'ARG','🇹🇼':'TPE','🇻🇪':'VEN','🇵🇭':'PHI','🇵🇷':'PUR','🇩🇪':'GER','🇳🇿':'NZL','🇨🇴':'COL','🇨🇳':'CHN','🇳🇴':'NOR','🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG','🏳️':'—'};

var PREV_WINNER = 'Corey Conners';

var PRE_ODDS = {
  'Tommy Fleetwood':'+1425','Ludvig Aberg':'+1500','Russell Henley':'+1800',
  'Robert MacIntyre':'+1800','Jordan Spieth':'+2050','Si Woo Kim':'+2150',
  'Hideki Matsuyama':'+2250','Maverick McNealy':'+2500','Rickie Fowler':'+2700',
  'Michael Thorbjornsen':'+2700','Sepp Straka':'+2800','Keith Mitchell':'+3500',
  'Ryo Hisatsune':'+3900','J.J. Spaun':'+4000','Alex Noren':'+4000',
  'Denny McCarthy':'+4600','Nick Taylor':'+5500','Alex Smalley':'+5800',
  'Marco Penge':'+5800','John Keefer':'+6000','Jordan Smith':'+6100',
  'Sudarshan Yellamaraju':'+6100','Stephan Jaeger':'+6100','Thorbjorn Olesen':'+6300',
  'Brian Harman':'+6600','Will Zalatoris':'+6700','Davis Thompson':'+6900',
  'Tony Finau':'+7000','Rico Hoey':'+7200','Christiaan Bezuidenhout':'+7400',
  'Matt Wallace':'+7600','J.T. Poston':'+7800','Mackenzie Hughes':'+7800',
  'Matt McCarty':'+8200','Mac Meissner':'+8200','Kristoffer Reitan':'+8200',
  'Chris Kirk':'+8400','Patrick Rodgers':'+8400','Haotong Li':'+8600',
  'Tom Kim':'+9000','Bud Cauley':'+9000','Austin Smotherman':'+9200',
  'Max McGreevy':'+9400','Eric Cole':'+10000','Chad Ramey':'+10000',
  'Andrew Novak':'+10000','Adrien Dumont De Chassart':'+10000','Zecheng Dou':'+10500',
  'Billy Horschel':'+11000','Beau Hossler':'+11000','Max Homa':'+11000',
  'John Parry':'+11500','William Mouw':'+11500','Taylor Moore':'+11500',
  'S.H. Kim':'+11500','Vince Whaley':'+12500','Doug Ghim':'+12500',
  'Steven Fisk':'+12500','Michael Kim':'+13000','Lee Hodges':'+13000',
  'Seamus Power':'+13500','Kevin Roy':'+14000','Austin Eckroat':'+14500',
  'Kris Ventura':'+15000','Sami Valimaki':'+15000','Bronson Burgoon':'+15500',
  'Emiliano Grillo':'+15500','Jesper Svensson':'+16000','Carson Young':'+16000',
  'Andrew Putnam':'+16000','Jhonattan Vegas':'+17000','Adrien Saddier':'+17000',
  'Matt Kuchar':'+17000','Kevin Yu':'+17500','Garrick Higgo':'+18000',
  'Jackson Suber':'+18500','Webb Simpson':'+18500','Daniel Brown':'+19500',
  'Joel Dahmen':'+19500','Matthieu Pavon':'+20000','Karl Vilips':'+20000',
  'Tom Hoge':'+21000','David Ford':'+21000','Chandler Blanchet':'+23000',
  'Mark Hubbard':'+23000','Takumi Kanaya':'+24000','Lucas Glover':'+24000',
  'Sam Ryder':'+25000','Brandt Snedeker':'+26000','Patrick Fishburn':'+26000',
  'A.J. Ewart':'+27000','Dylan Wu':'+29000','Pontus Nyholm':'+30000',
  'Jimmy Stanger':'+31000','Luke Clanton':'+31000','Adam Svensson':'+33000',
  'Hank Lebioda':'+34000','Neal Shipley':'+36000','Danny Walker':'+37000',
  'John Vanderlaan':'+39000','Erik Van Rooyen':'+39000','Zach Bauchou':'+44000',
  'Patton Kizzire':'+44000','Lanto Griffin':'+44000','Chandler Phillips':'+45000',
  'Kevin Streelman':'+45000','Alejandro Tosti':'+49000','Nick Dunlap':'+49000',
  'Charley Hoffman':'+50000','Christo Lamprecht':'+52500','Adam Schenk':'+52500',
  'Kensei Hirata':'+55000','Joe Highsmith':'+57500','Peter Malnati':'+57500',
  'Justin Lower':'+60000','Gordon Sargent':'+60000','Brice Garnett':'+62500',
  'Paul Waring':'+62500','Nick Hardy':'+70000','Davis Chatfield':'+72500',
  'Camilo Villegas':'+87500','Jeffrey Kang':'+110000','K.H. Lee':'+135000',
  'Jimmy Walker':'+160000','Brendon Todd':'+200000','Rafael Campos':'+200000',
  'Frankie Capan III':'+225000','Marcelo Rozo':'+250000','Ryan Palmer':'+275000',
  'Charlie Crockett':'+400000','Austin Wylie':'+500000','Chan Kim':'+2500'
};

var POOL_CONFIG = { buyIn: 25, entries: 6, payouts: [ { place: '1st', pct: 0.60 }, { place: '2nd', pct: 0.27 }, { place: '3rd', pct: 0.13 } ] };
POOL_CONFIG.pot = POOL_CONFIG.buyIn * POOL_CONFIG.entries;
POOL_CONFIG.payouts.forEach(function(p) { p.amount = Math.round(POOL_CONFIG.pot * p.pct); });

var PILL_CLASSES = ['pill-a', 'pill-b', 'pill-c'];
function pillLabel(teamIdx) { return teamIdx + 1; }

// ── Mutable State ──────────────────────────────────────────

var GOLFER_SCORES = {};
var allTeamEmails = [];
var PREV_POSITIONS = {};
var PREV_RANKS = {};
var ROUND_START_POSITIONS = {};
var ROUND_START_ROUND = 0;
var PREV_SCORES = {};
var SCORE_CHANGES = {};
var OWNERSHIP_DATA = [];
var ATHLETE_IDS = {};
var EVENT_ID = null;
var SCORECARD_CACHE = {};
var COURSE_HOLES = null;
var COURSE_PAR = 70; // sum of default pars [4,3,5,4,4,4,3,5,3,4,3,4,4,4,3,5,4,4]

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

// Load round-start positions from localStorage
try {
  var saved = JSON.parse(localStorage.getItem('eastpole_round_start') || '{}');
  if (saved.round && saved.positions) { ROUND_START_POSITIONS = saved.positions; ROUND_START_ROUND = saved.round; }
} catch(e) {}

function saveRoundStartPositions(round) {
  ROUND_START_ROUND = round;
  ROUND_START_POSITIONS = {};
  Object.entries(GOLFER_SCORES).forEach(function(pair) {
    var p = parsePos(pair[1].pos);
    if (p) ROUND_START_POSITIONS[pair[0]] = p;
  });
  try { localStorage.setItem('eastpole_round_start', JSON.stringify({ round: round, positions: ROUND_START_POSITIONS })); } catch(e) {}
}

function shouldShowSplash() {
  try {
    var lastShown = localStorage.getItem(SPLASH_DATE_KEY);
    var today = new Date().toISOString().slice(0, 10);
    return lastShown !== today;
  } catch(e) { return true; }
}

function markSplashSeen() {
  try { localStorage.setItem(SPLASH_DATE_KEY, new Date().toISOString().slice(0, 10)); } catch(e) {}
}

function saveUser() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: currentUserEmail, activeTeamIdx: activeTeamIdx })); } catch(e) {} }

function loadUser() {
  try {
    var s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (s?.email && ENTRIES.some(function(e) { return e.email === s.email; })) {
      setUser(s.email, s.activeTeamIdx || 0, false);
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
