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

var ENTRIES = [ { team: "Jake Test", name: "Jake", email: "jhs797@gmail.com", tb: -8, picks: ["Sam Burns", "Michael Thorbjornsen", "Sungjae Im", "Aaron Rai", "Christiaan Bezuidenhout", "Gary Woodland"] }, { team: "Loves2splooge69_A", name: "Tyler D", email: "tdewitt815@gmail.com", tb: -16, picks: ["Chris Gotterup", "Ben Griffin", "Sungjae Im", "Max Greyserman", "Nicolas Echavarria", "Tom Kim"] }, { team: "Loves2splooge69_B", name: "Tyler D", email: "tdewitt815@gmail.com", tb: -18, picks: ["Min Woo Lee", "Shane Lowry", "Alex Smalley", "Tony Finau", "J.T. Poston", "Seonghyeon Kim"] }, { team: "Monkey fist pump", name: "Tyler Conlan", email: "tycon0612@gmail.com", tb: -15, picks: ["Brooks Koepka", "Marco Penge", "Sahith Theegala", "Jordan L. Smith", "Hao-Tong Li", "Tom Kim"] }, { team: "Monkey fist pump 2", name: "Tyler Conlan", email: "tycon0612@gmail.com", tb: -18, picks: ["Chris Gotterup", "Adam Scott", "Sungjae Im", "Will Zalatoris", "Nicolas Echavarria", "Gary Woodland"] }, { team: "Shark's Gonna Shark",name: "Jake", email: "jhs797@gmail.com", tb: -12, picks: ["Jake Knapp", "Shane Lowry", "Patrick Rodgers", "Aaron Rai", "Hao-Tong Li", "David Lipsky"] }];

var FLAGS = { "Zach Bauchou":"🇺🇸","Cole Hammer":"🇺🇸","Denny McCarthy":"🇺🇸", "Chad Ramey":"🇺🇸","Davis Riley":"🇺🇸","Jhonattan Vegas":"🇻🇪", "Kurt Kitayama":"🇺🇸","Adam Schenk":"🇺🇸","J.T. Poston":"🇺🇸", "Eric Cole":"🇺🇸","Matt Wallace":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Aaron Wise":"🇺🇸", "Matthieu Pavon":"🇫🇷","Aaron Rai":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Sahith Theegala":"🇺🇸", "Jimmy Stanger":"🇺🇸","Casey Russell":"🇺🇸","Max Greyserman":"🇺🇸", "Wyndham Clark":"🇺🇸","Nicolai Højgaard":"🇩🇰","Rasmus Højgaard":"🇩🇰", "Sungjae Im":"🇰🇷","Max McGreevy":"🇺🇸","Rico Hoey":"🇵🇭", "Hank Lebioda":"🇺🇸","Garrick Higgo":"🇿🇦","Christo Lamprecht":"🇿🇦", "Doug Ghim":"🇺🇸","Dan Brown":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Bronson Burgoon":"🇺🇸", "Billy Horschel":"🇺🇸","Jason Day":"🇦🇺","Charley Hoffman":"🇺🇸", "Tony Finau":"🇺🇸","Brice Garnett":"🇺🇸","Matt Kuchar":"🇺🇸", "Chris Kirk":"🇺🇸","Paul Waring":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Gary Woodland":"🇺🇸", "Rafael Campos":"🇵🇷","Rickie Fowler":"🇺🇸","Ben Griffin":"🇺🇸", "Ludvig Åberg":"🇸🇪","Kevin Yu":"🇹🇼","Austin Eckroat":"🇺🇸", "Adam Scott":"🇦🇺","S.Y. Noh":"🇰🇷","Hayden Springer":"🇺🇸", "Thomas Detry":"🇧🇪","Parker Coody":"🇺🇸","Justin Lower":"🇺🇸", "Ben Silverman":"🇨🇦","Lee Hodges":"🇺🇸","Adam Hadwin":"🇨🇦", "Alejandro Tosti":"🇦🇷","Wesley Bryan":"🇺🇸","Henrik Norlander":"🇸🇪", "Carson Young":"🇺🇸","Joel Dahmen":"🇺🇸","J.J. Spaun":"🇺🇸", "Justin Rose":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Patrick Fishburn":"🇺🇸", "Taylor Moore":"🇺🇸","Lee Westwood":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","C.T. Pan":"🇹🇼", "Kevin Streelman":"🇺🇸","Nick Watney":"🇺🇸","Daniel Berger":"🇺🇸", "Ben Martin":"🇺🇸","Patton Kizzire":"🇺🇸","Webb Simpson":"🇺🇸", "Adam Long":"🇺🇸","Sang-Moon Bae":"🇰🇷", "Matti Schmid":"🇩🇪","Si Woo Kim":"🇰🇷","Alex Noren":"🇸🇪", "Nate Lashley":"🇺🇸","Kevin Tway":"🇺🇸","Ryan Fox":"🇳🇿", "Pierceson Coody":"🇺🇸","Rasmus Neergaard-Petersen":"🇩🇰", "Joe Highsmith":"🇺🇸","Michael Brennan":"🇺🇸","Jackson Suber":"🇺🇸", "Kensei Hirata":"🇯🇵","A.J. Ewart":"🇨🇦","Adrien Dumont de Chassart":"🇧🇪", "Ryan Gerard":"🇺🇸","William Mouw":"🇺🇸","Aldrich Potgieter":"🇿🇦", "Davis Chatfield":"🇺🇸","Gordon Sargent":"🇺🇸","Thorbjørn Olesen":"🇩🇰", "Sudarshan Yellamaraju":"🇨🇦","Karl Vilips":"🇦🇺","David Ford":"🇺🇸", "Neal Shipley":"🇺🇸","Luke Clanton":"🇺🇸","Johnny Keefer":"🇺🇸", "Mason Howell":"🇺🇸","Harris English":"🇺🇸","Andrew Putnam":"🇺🇸", "Peter Malnati":"🇺🇸","Emiliano Grillo":"🇦🇷","Séamus Power":"🇮🇪", "Beau Hossler":"🇺🇸","Tom Hoge":"🇺🇸","David Lipsky":"🇺🇸", "Lucas Glover":"🇺🇸","Brooks Koepka":"🇺🇸","Patrick Rodgers":"🇺🇸", "Mackenzie Hughes":"🇨🇦","Stephan Jaeger":"🇩🇪","Adrien Saddier":"🇫🇷", "Sam Ryder":"🇺🇸","K.H. Lee":"🇰🇷", "Zecheng Dou":"🇨🇳","Keith Mitchell":"🇺🇸","Adam Svensson":"🇨🇦", "Mark Hubbard":"🇺🇸","Haotong Li":"🇨🇳","Christiaan Bezuidenhout":"🇿🇦", "Erik van Rooyen":"🇿🇦","Alex Smalley":"🇺🇸","Jordan Smith":"🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Brian Campbell":"🇺🇸","Trey Mullinax":"🇺🇸","Taylor Pendrith":"🇨🇦", "Jake Knapp":"🇺🇸","Will Zalatoris":"🇺🇸","Sam Burns":"🇺🇸", "Chandler Blanchet":"🇺🇸","Chandler Phillips":"🇺🇸","Chris Gotterup":"🇺🇸", "Danny Walker":"🇺🇸","Davis Thompson":"🇺🇸","Dylan Wu":"🇺🇸", "Harry Hall":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Isaiah Salinda":"🇺🇸","Jeffrey Kang":"🇺🇸", "Jesper Svensson":"🇸🇪","John Parry":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","John VanDerLaan":"🇺🇸", "Kevin Roy":"🇨🇦","Kris Ventura":"🇳🇴","Kristoffer Reitan":"🇳🇴", "Mac Meissner":"🇺🇸","Marco Penge":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Michael Thorbjornsen":"🇺🇸", "Min Woo Lee":"🇦🇺","Nick Dunlap":"🇺🇸","Nico Echavarria":"🇨🇴", "Pontus Nyholm":"🇸🇪","Ricky Castillo":"🇺🇸","S.H. Kim":"🇰🇷", "Sam Stevens":"🇺🇸","Shane Lowry":"🇮🇪", "Steven Fisk":"🇺🇸","Takumi Kanaya":"🇯🇵","Tom Kim":"🇰🇷","Vince Whaley":"🇺🇸"};

var TIERS = [];
var NAME_ALIASES = { 'Nicolas Echavarria': 'Nico Echavarria', 'Jordan L. Smith': 'Jordan Smith', 'Hao-Tong Li': 'Haotong Li', 'Seonghyeon Kim': 'S.H. Kim' };
var FLAG_TO_CODE = {'🇺🇸':'USA','🇦🇺':'AUS','🇰🇷':'KOR','🇨🇦':'CAN','🇿🇦':'RSA','🇩🇰':'DEN','🇸🇪':'SWE','🇫🇷':'FRA','🇯🇵':'JPN','🇮🇪':'IRL','🇧🇪':'BEL','🇦🇷':'ARG','🇹🇼':'TPE','🇻🇪':'VEN','🇵🇭':'PHI','🇵🇷':'PUR','🇩🇪':'GER','🇳🇿':'NZL','🇨🇴':'COL','🇨🇳':'CHN','🇳🇴':'NOR','🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG','🏳️':'—'};

var PREV_WINNER = 'Corey Conners';

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
