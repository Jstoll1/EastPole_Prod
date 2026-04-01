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

var ENTRIES = [
  { team:'Shark Select', name:'Jake', email:'jhs797@gmail.com', picks:['Ludvig Aberg','Sepp Straka','Marco Penge','Tony Finau','Mac Meissner','S.H. Kim'], tb:-24 },
  { team:'Maverick & Goose', name:'Jake', email:'jhs797@gmail.com', picks:['Maverick McNealy','Rickie Fowler','Denny McCarthy','Christiaan Bezuidenhout','Bud Cauley','Mackenzie Hughes'], tb:-28 },
  { team:'Texas Cake', name:'Jake', email:'jhs797@gmail.com', picks:['Jordan Spieth','Sepp Straka','Thorbjorn Olesen','Brian Harman','Haotong Li','Eric Cole'], tb:-26 },
  { team:'Loves2Splooge_69', name:'Tyler D', email:'tdewitt815@gmail.com', picks:['Si Woo Kim','Ryo Hisatsune','Marco Penge','Sudarshan Yellamaraju','Haotong Li','Zecheng Dou'], tb:-11 },
  { team:'Gooey Bellies', name:'Tyler D', email:'tdewitt815@gmail.com', picks:['Jordan Spieth','Rickie Fowler','Denny McCarthy','Will Zalatoris','Tom Kim','Beau Hossler'], tb:-19 },
  { team:'0.00% BAC', name:'Andrew Steioff', email:'andrewsteioff@gmail.com', picks:['Tommy Fleetwood','J.J. Spaun','Marco Penge','Tony Finau','Chris Kirk','Max Homa'], tb:-14 }
];

var FLAGS = {
  'Tommy Fleetwood':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Ludvig Aberg':'🇸🇪','Russell Henley':'🇺🇸',
  'Robert MacIntyre':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Jordan Spieth':'🇺🇸','Si Woo Kim':'🇰🇷',
  'Hideki Matsuyama':'🇯🇵','Maverick McNealy':'🇺🇸','Rickie Fowler':'🇺🇸',
  'Michael Thorbjornsen':'🇺🇸','Sepp Straka':'🇦🇹','Keith Mitchell':'🇺🇸',
  'Ryo Hisatsune':'🇯🇵','J.J. Spaun':'🇺🇸','Alex Noren':'🇸🇪',
  'Denny McCarthy':'🇺🇸','Nick Taylor':'🇨🇦','Alex Smalley':'🇺🇸',
  'Marco Penge':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','John Keefer':'🇺🇸','Jordan Smith':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Sudarshan Yellamaraju':'🇨🇦','Stephan Jaeger':'🇩🇪','Thorbjorn Olesen':'🇩🇰',
  'Brian Harman':'🇺🇸','Will Zalatoris':'🇺🇸','Davis Thompson':'🇺🇸',
  'Tony Finau':'🇺🇸','Rico Hoey':'🇵🇭','Christiaan Bezuidenhout':'🇿🇦',
  'Matt Wallace':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','J.T. Poston':'🇺🇸','Mackenzie Hughes':'🇨🇦',
  'Matt McCarty':'🇺🇸','Mac Meissner':'🇺🇸','Kristoffer Reitan':'🇳🇴',
  'Chris Kirk':'🇺🇸','Patrick Rodgers':'🇺🇸','Haotong Li':'🇨🇳',
  'Tom Kim':'🇰🇷','Bud Cauley':'🇺🇸','Austin Smotherman':'🇺🇸',
  'Max McGreevy':'🇺🇸','Eric Cole':'🇺🇸','Chad Ramey':'🇺🇸',
  'Andrew Novak':'🇺🇸','Adrien Dumont De Chassart':'🇧🇪','Zecheng Dou':'🇨🇳',
  'Billy Horschel':'🇺🇸','Beau Hossler':'🇺🇸','Max Homa':'🇺🇸',
  'John Parry':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','William Mouw':'🇺🇸','Taylor Moore':'🇺🇸',
  'S.H. Kim':'🇰🇷','Vince Whaley':'🇺🇸','Doug Ghim':'🇺🇸',
  'Steven Fisk':'🇺🇸','Michael Kim':'🇺🇸','Lee Hodges':'🇺🇸',
  'Seamus Power':'🇮🇪','Kevin Roy':'🇺🇸','Austin Eckroat':'🇺🇸',
  'Kris Ventura':'🇳🇴','Sami Valimaki':'🇫🇮','Bronson Burgoon':'🇺🇸',
  'Emiliano Grillo':'🇦🇷','Jesper Svensson':'🇸🇪','Carson Young':'🇺🇸',
  'Andrew Putnam':'🇺🇸','Jhonattan Vegas':'🇻🇪','Adrien Saddier':'🇫🇷',
  'Matt Kuchar':'🇺🇸','Kevin Yu':'🇹🇼','Garrick Higgo':'🇿🇦',
  'Jackson Suber':'🇺🇸','Webb Simpson':'🇺🇸','Daniel Brown':'🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Joel Dahmen':'🇺🇸','Matthieu Pavon':'🇫🇷','Karl Vilips':'🇦🇺',
  'Tom Hoge':'🇺🇸','David Ford':'🇺🇸','Chandler Blanchet':'🇺🇸',
  'Mark Hubbard':'🇺🇸','Takumi Kanaya':'🇯🇵','Lucas Glover':'🇺🇸',
  'Sam Ryder':'🇺🇸','Brandt Snedeker':'🇺🇸','Patrick Fishburn':'🇺🇸',
  'A.J. Ewart':'🇨🇦','Dylan Wu':'🇺🇸','Pontus Nyholm':'🇸🇪',
  'Jimmy Stanger':'🇺🇸','Luke Clanton':'🇺🇸','Adam Svensson':'🇨🇦',
  'Hank Lebioda':'🇺🇸','Neal Shipley':'🇺🇸','Danny Walker':'🇺🇸',
  'John Vanderlaan':'🇺🇸','Erik Van Rooyen':'🇿🇦','Zach Bauchou':'🇺🇸',
  'Patton Kizzire':'🇺🇸','Lanto Griffin':'🇺🇸','Chandler Phillips':'🇺🇸',
  'Kevin Streelman':'🇺🇸','Alejandro Tosti':'🇦🇷','Nick Dunlap':'🇺🇸',
  'Charley Hoffman':'🇺🇸','Christo Lamprecht':'🇿🇦','Adam Schenk':'🇺🇸',
  'Kensei Hirata':'🇯🇵','Joe Highsmith':'🇺🇸','Peter Malnati':'🇺🇸',
  'Justin Lower':'🇺🇸','Gordon Sargent':'🇺🇸','Brice Garnett':'🇺🇸',
  'Paul Waring':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Nick Hardy':'🇺🇸','Davis Chatfield':'🇺🇸',
  'Camilo Villegas':'🇨🇴','Jeffrey Kang':'🇺🇸','K.H. Lee':'🇰🇷',
  'Jimmy Walker':'🇺🇸','Brendon Todd':'🇺🇸','Rafael Campos':'🇵🇷',
  'Frankie Capan III':'🇺🇸','Marcelo Rozo':'🇨🇴','Ryan Palmer':'🇺🇸',
  'Charlie Crockett':'🇺🇸','Austin Wylie':'🇺🇸','Chan Kim':'🇺🇸'
};

var TIERS = [];
var NAME_ALIASES = {
  'Hao-Tong Li':'Haotong Li',
  'Seonghyeon Kim':'S.H. Kim',
  'Thorbjørn Olesen':'Thorbjorn Olesen',
  'Ludvig Åberg':'Ludvig Aberg',
  'Stephan Jäger':'Stephan Jaeger',
  'Alex Norén':'Alex Noren',
  'Sami Välimäki':'Sami Valimaki'
};
var FLAG_TO_CODE = {'🇺🇸':'USA','🇦🇺':'AUS','🇰🇷':'KOR','🇨🇦':'CAN','🇿🇦':'RSA','🇩🇰':'DEN','🇸🇪':'SWE','🇫🇷':'FRA','🇯🇵':'JPN','🇮🇪':'IRL','🇧🇪':'BEL','🇦🇷':'ARG','🇹🇼':'TPE','🇻🇪':'VEN','🇵🇭':'PHI','🇵🇷':'PUR','🇩🇪':'GER','🇳🇿':'NZL','🇨🇴':'COL','🇨🇳':'CHN','🇳🇴':'NOR','🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG','🏳️':'—'};

var PREV_WINNER = 'Corey Conners';

// PRE_ODDS: [winner, top5, top10]
var PRE_ODDS = {
  'Tommy Fleetwood':['+1425','+285','+146'],'Ludvig Aberg':['+1500','+310','+162'],
  'Russell Henley':['+1800','+335','+170'],'Robert MacIntyre':['+1800','+350','+180'],
  'Jordan Spieth':['+2050','+395','+200'],'Si Woo Kim':['+2150','+395','+196'],
  'Hideki Matsuyama':['+2250','+415','+205'],'Maverick McNealy':['+2500','+465','+235'],
  'Rickie Fowler':['+2700','+495','+245'],'Michael Thorbjornsen':['+2700','+500','+250'],
  'Sepp Straka':['+2800','+500','+250'],'Keith Mitchell':['+3500','+620','+305'],
  'Ryo Hisatsune':['+3900','+670','+325'],'J.J. Spaun':['+4000','+680','+330'],
  'Alex Noren':['+4000','+670','+320'],'Denny McCarthy':['+4600','+760','+365'],
  'Nick Taylor':['+5500','+850','+400'],'Alex Smalley':['+5800','+920','+435'],
  'Marco Penge':['+5800','+960','+460'],'John Keefer':['+6000','+970','+465'],
  'Jordan Smith':['+6100','+950','+445'],'Sudarshan Yellamaraju':['+6100','+950','+445'],
  'Stephan Jaeger':['+6100','+950','+450'],'Thorbjorn Olesen':['+6300','+970','+455'],
  'Brian Harman':['+6600','+1025','+475'],'Will Zalatoris':['+6700','+1050','+490'],
  'Davis Thompson':['+6900','+1050','+485'],'Tony Finau':['+7000','+1075','+500'],
  'Rico Hoey':['+7200','+1100','+510'],'Christiaan Bezuidenhout':['+7400','+1075','+495'],
  'Matt Wallace':['+7600','+1125','+520'],'J.T. Poston':['+7800','+1150','+530'],
  'Mackenzie Hughes':['+7800','+1150','+530'],'Matt McCarty':['+8200','+1200','+550'],
  'Mac Meissner':['+8200','+1175','+540'],'Kristoffer Reitan':['+8200','+1225','+570'],
  'Chris Kirk':['+8400','+1225','+560'],'Patrick Rodgers':['+8400','+1250','+570'],
  'Haotong Li':['+8600','+1275','+580'],'Tom Kim':['+9000','+1300','+590'],
  'Bud Cauley':['+9000','+1300','+590'],'Austin Smotherman':['+9200','+1350','+610'],
  'Max McGreevy':['+9400','+1350','+610'],'Eric Cole':['+10000','+1425','+640'],
  'Chad Ramey':['+10000','+1450','+650'],'Andrew Novak':['+10000','+1450','+660'],
  'Adrien Dumont De Chassart':['+10000','+1450','+660'],'Zecheng Dou':['+10500','+1500','+690'],
  'Billy Horschel':['+11000','+1600','+720'],'Beau Hossler':['+11000','+1550','+710'],
  'Max Homa':['+11000','+1550','+710'],'John Parry':['+11500','+1600','+700'],
  'William Mouw':['+11500','+1600','+720'],'Taylor Moore':['+11500','+1550','+710'],
  'S.H. Kim':['+11500','+1600','+710'],'Vince Whaley':['+12500','+1700','+770'],
  'Doug Ghim':['+12500','+1700','+750'],'Steven Fisk':['+12500','+1700','+760'],
  'Michael Kim':['+13000','+1750','+780'],'Lee Hodges':['+13000','+1700','+750'],
  'Seamus Power':['+13500','+1750','+780'],'Kevin Roy':['+14000','+1850','+820'],
  'Austin Eckroat':['+14500','+1950','+860'],'Kris Ventura':['+15000','+1950','+860'],
  'Sami Valimaki':['+15000','+1950','+860'],'Bronson Burgoon':['+15500','+2100','+920'],
  'Emiliano Grillo':['+15500','+2000','+870'],'Jesper Svensson':['+16000','+2150','+950'],
  'Carson Young':['+16000','+2100','+910'],'Andrew Putnam':['+16000','+2000','+840'],
  'Jhonattan Vegas':['+17000','+2200','+960'],'Adrien Saddier':['+17000','+2200','+950'],
  'Matt Kuchar':['+17000','+2100','+890'],'Kevin Yu':['+17500','+2350','+1000'],
  'Garrick Higgo':['+18000','+2350','+1025'],'Jackson Suber':['+18500','+2400','+1025'],
  'Webb Simpson':['+18500','+2350','+1000'],'Daniel Brown':['+19500','+2500','+1075'],
  'Joel Dahmen':['+19500','+2350','+1000'],'Matthieu Pavon':['+20000','+2500','+1075'],
  'Karl Vilips':['+20000','+2500','+1100'],'Tom Hoge':['+21000','+2600','+1125'],
  'David Ford':['+21000','+2600','+1100'],'Chandler Blanchet':['+23000','+2700','+1125'],
  'Mark Hubbard':['+23000','+2800','+1175'],'Takumi Kanaya':['+24000','+2800','+1150'],
  'Lucas Glover':['+24000','+2800','+1150'],'Sam Ryder':['+25000','+3000','+1250'],
  'Brandt Snedeker':['+26000','+3000','+1225'],'Patrick Fishburn':['+26000','+3100','+1275'],
  'A.J. Ewart':['+27000','+3100','+1275'],'Dylan Wu':['+29000','+3300','+1350'],
  'Pontus Nyholm':['+30000','+3600','+1500'],'Jimmy Stanger':['+31000','+3600','+1475'],
  'Luke Clanton':['+31000','+3700','+1500'],'Adam Svensson':['+33000','+3600','+1475'],
  'Hank Lebioda':['+34000','+3700','+1500'],'Neal Shipley':['+36000','+4200','+1700'],
  'Danny Walker':['+37000','+4300','+1750'],'John Vanderlaan':['+39000','+4400','+1750'],
  'Erik Van Rooyen':['+39000','+4500','+1800'],'Zach Bauchou':['+44000','+4700','+1850'],
  'Patton Kizzire':['+44000','+4700','+1850'],'Lanto Griffin':['+44000','+4900','+1950'],
  'Chandler Phillips':['+45000','+4800','+1900'],'Kevin Streelman':['+45000','+4700','+1850'],
  'Alejandro Tosti':['+49000','+5600','+2250'],'Nick Dunlap':['+49000','+5500','+2200'],
  'Charley Hoffman':['+50000','+5500','+2200'],'Christo Lamprecht':['+52500','+5900','+2300'],
  'Adam Schenk':['+52500','+5700','+2250'],'Kensei Hirata':['+55000','+5700','+2200'],
  'Joe Highsmith':['+57500','+6200','+2400'],'Peter Malnati':['+57500','+6000','+2300'],
  'Justin Lower':['+60000','+6200','+2400'],'Gordon Sargent':['+60000','+6700','+2600'],
  'Brice Garnett':['+62500','+6100','+2300'],'Paul Waring':['+62500','+6500','+2500'],
  'Nick Hardy':['+70000','+7000','+2700'],'Davis Chatfield':['+72500','+6800','+2500'],
  'Camilo Villegas':['+87500','+8400','+3100'],'Jeffrey Kang':['+110000','+10500','+3900'],
  'K.H. Lee':['+135000','+12000','+4300'],'Jimmy Walker':['+160000','+14500','+5200'],
  'Brendon Todd':['+200000','+18000','+6100'],'Rafael Campos':['+200000','+17000','+5900'],
  'Frankie Capan III':['+225000','+18500','+6500'],'Marcelo Rozo':['+250000','+20000','+6700'],
  'Ryan Palmer':['+275000','+23000','+8000'],'Charlie Crockett':['+400000','+30000','+9800'],
  'Austin Wylie':['+500000','+49000','+17500'],'Chan Kim':['+2500','+1050','']
};

var POOL_CONFIG = { buyIn: 25, entries: 120, payouts: [ { place: '1st', amount: 1800 }, { place: '2nd', amount: 1175 }, { place: '3rd', amount: 25 } ] };
POOL_CONFIG.pot = POOL_CONFIG.buyIn * POOL_CONFIG.entries;

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
var TOURNAMENT_STARTED = false;
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
  var posAge = saved.timestamp ? Date.now() - saved.timestamp : Infinity;
  if (saved.round && saved.positions && posAge < 18 * 60 * 60 * 1000) { ROUND_START_POSITIONS = saved.positions; ROUND_START_ROUND = saved.round; }
} catch(e) {}

function saveRoundStartPositions(round) {
  ROUND_START_ROUND = round;
  ROUND_START_POSITIONS = {};
  Object.entries(GOLFER_SCORES).forEach(function(pair) {
    var p = parsePos(pair[1].pos);
    if (p) ROUND_START_POSITIONS[pair[0]] = p;
  });
  try { localStorage.setItem('eastpole_round_start', JSON.stringify({ round: round, positions: ROUND_START_POSITIONS, timestamp: Date.now() })); } catch(e) {}
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
