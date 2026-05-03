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
];

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
  'Garrick Higgo':'🇿🇦','Jackson Herrington':'🇺🇸','Nicolai Hojgaard':'🇩🇰','Rasmus Hojgaard':'🇩🇰',
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
  'Cameron Smith':'🇦🇺','Jordan Smith':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','J.J. Spaun':'🇺🇸','Jordan Spieth':'🇺🇸',
  'Samuel Stevens':'🇺🇸','Sepp Straka':'🇦🇹','Nick Taylor':'🇨🇦',
  'Justin Thomas':'🇺🇸','Sami Valimaki':'🇫🇮','Bubba Watson':'🇺🇸',
  'Matt Wallace':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Mike Weir':'🇨🇦','Danny Willett':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Gary Woodland':'🇺🇸',
  'Cameron Young':'🇺🇸',
  // PGA Tour regulars (non-Masters field) — seeded to cover Zurich/RBC/etc.
  'Adam Hadwin':'🇨🇦','Adam Svensson':'🇨🇦','Russell Knox':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Ben Silverman':'🇨🇦','Rafael Campos':'🇵🇷','Alejandro Tosti':'🇦🇷',
  'Kevin Yu':'🇹🇼','Tom Kim':'🇰🇷','Christo Lamprecht':'🇿🇦',
  'Jeremy Paul':'🇩🇪','Alex Fitzpatrick':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','A.J. Ewart':'🇨🇦',
  'Matthieu Pavon':'🇫🇷','Martin Couvra':'🇫🇷','Adrien Dumont De Chassart':'🇧🇪',
  'Dan Brown':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','John Parry':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Kris Ventura':'🇳🇴',
  'Takumi Kanaya':'🇯🇵','Jacob Skov Olesen':'🇩🇰','Camilo Villegas':'🇨🇴',
  'Marcelo Rozo':'🇨🇴','Henrik Norlander':'🇸🇪','Zecheng Dou':'🇨🇳',
  'Stephan Jaeger':'🇩🇪','David Skinns':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Keita Nakajima':'🇯🇵',
  'Kensei Hirata':'🇯🇵','Geoff Ogilvy':'🇦🇺','Cam Davis':'🇦🇺',
  'Christiaan Bezuidenhout':'🇿🇦','Erik van Rooyen':'🇿🇦','Rico Hoey':'🇵🇭',
  'Mackenzie Hughes':'🇨🇦','Pontus Nyholm':'🇸🇪','Jesper Svensson':'🇸🇪',
  'Séamus Power':'🇮🇪','Matti Schmid':'🇩🇪'
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
  'Johnny Keefer':'John Keefer',
  'Alexander Noren':'Alex Noren',
  'Matthew McCarty':'Matt McCarty',
  'Sam Stevens':'Samuel Stevens',
  'Sung-Jae Im':'Sungjae Im',
  'Nico Echavarria':'Nicolas Echavarria',
  'Pongsapak Laopakdee':'Fifa Laopakdee',
  'Joohyung Kim':'Tom Kim',
  'Cameron Davis':'Cam Davis',
  'Alexander Fitzpatrick':'Alex Fitzpatrick',
  'Alex J. Fitzpatrick':'Alex Fitzpatrick',
  'Seamus Power':'Séamus Power',
  'Christian Bezuidenhout':'Christiaan Bezuidenhout',
  'Erik Van Rooyen':'Erik van Rooyen',
  'Adrien Dumont de Chassart':'Adrien Dumont De Chassart'
};
var FLAG_TO_CODE = {'🇺🇸':'USA','🇦🇺':'AUS','🇰🇷':'KOR','🇨🇦':'CAN','🇿🇦':'RSA','🇩🇰':'DEN','🇸🇪':'SWE','🇫🇷':'FRA','🇯🇵':'JPN','🇮🇪':'IRL','🇧🇪':'BEL','🇦🇷':'ARG','🇹🇼':'TPE','🇻🇪':'VEN','🇵🇭':'PHI','🇵🇷':'PUR','🇩🇪':'GER','🇳🇿':'NZL','🇨🇴':'COL','🇨🇳':'CHN','🇳🇴':'NOR','🏴󠁧󠁢󠁥󠁮󠁧󠁿':'ENG','🏴󠁧󠁢󠁳󠁣󠁴󠁿':'SCO','🏴󠁧󠁢󠁷󠁬󠁳󠁿':'WAL','🇫🇮':'FIN','🇦🇹':'AUT','🇮🇹':'ITA','🇪🇸':'ESP','🇨🇭':'CHE','🇳🇱':'NED','🇮🇸':'ISL','🇲🇽':'MEX','🇹🇭':'THA','🇫🇯':'FIJ','🇬🇧':'NIR','🏳️':'—'};
// ESPN serves country codes (3-letter) on c.athlete.flag.alt — convert to emoji
var CODE_TO_FLAG = {'USA':'🇺🇸','US':'🇺🇸','AUS':'🇦🇺','KOR':'🇰🇷','CAN':'🇨🇦','RSA':'🇿🇦','ZAF':'🇿🇦','DEN':'🇩🇰','DNK':'🇩🇰','SWE':'🇸🇪','FRA':'🇫🇷','JPN':'🇯🇵','JAP':'🇯🇵','IRL':'🇮🇪','BEL':'🇧🇪','ARG':'🇦🇷','TPE':'🇹🇼','TWN':'🇹🇼','VEN':'🇻🇪','PHI':'🇵🇭','PHL':'🇵🇭','PUR':'🇵🇷','PRI':'🇵🇷','GER':'🇩🇪','DEU':'🇩🇪','NZL':'🇳🇿','COL':'🇨🇴','CHN':'🇨🇳','NOR':'🇳🇴','ENG':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','SCO':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','WAL':'🏴󠁧󠁢󠁷󠁬󠁳󠁿','GBR':'🇬🇧','FIN':'🇫🇮','AUT':'🇦🇹','ITA':'🇮🇹','ESP':'🇪🇸','SUI':'🇨🇭','CHE':'🇨🇭','NED':'🇳🇱','NLD':'🇳🇱','ISL':'🇮🇸','NIR':'🇬🇧','MEX':'🇲🇽','MXN':'🇲🇽','THA':'🇹🇭','THL':'🇹🇭','FIJ':'🇫🇯','FJI':'🇫🇯','IND':'🇮🇳','BRA':'🇧🇷','BRZ':'🇧🇷','PAR':'🇵🇾','PRY':'🇵🇾','URU':'🇺🇾','URY':'🇺🇾','CHI':'🇨🇱','CHL':'🇨🇱','PER':'🇵🇪','ECU':'🇪🇨','PAN':'🇵🇦','CRC':'🇨🇷','CRI':'🇨🇷','DOM':'🇩🇴','JAM':'🇯🇲','BAH':'🇧🇸','BHS':'🇧🇸','TRI':'🇹🇹','TTO':'🇹🇹','BAR':'🇧🇧','BRB':'🇧🇧','BER':'🇧🇲','BMU':'🇧🇲','GUA':'🇬🇹','GTM':'🇬🇹','HON':'🇭🇳','HND':'🇭🇳','CUB':'🇨🇺','POR':'🇵🇹','PRT':'🇵🇹','POL':'🇵🇱','CZE':'🇨🇿','CZK':'🇨🇿','SVK':'🇸🇰','HUN':'🇭🇺','ROU':'🇷🇴','BUL':'🇧🇬','BGR':'🇧🇬','CRO':'🇭🇷','HRV':'🇭🇷','SRB':'🇷🇸','SLO':'🇸🇮','SVN':'🇸🇮','GRE':'🇬🇷','GRC':'🇬🇷','TUR':'🇹🇷','ISR':'🇮🇱','LBN':'🇱🇧','SGP':'🇸🇬','MAS':'🇲🇾','MYS':'🇲🇾','IDN':'🇮🇩','INA':'🇮🇩','VIE':'🇻🇳','VNM':'🇻🇳','PAK':'🇵🇰','SRI':'🇱🇰','LKA':'🇱🇰','NEP':'🇳🇵','BAN':'🇧🇩','BGD':'🇧🇩','HKG':'🇭🇰','HK':'🇭🇰','MAC':'🇲🇴','PHI':'🇵🇭','NGR':'🇳🇬','NGA':'🇳🇬','GHA':'🇬🇭','KEN':'🇰🇪','UGA':'🇺🇬','TAN':'🇹🇿','TZA':'🇹🇿','ETH':'🇪🇹','SEN':'🇸🇳','CIV':'🇨🇮','CMR':'🇨🇲','EGY':'🇪🇬','MAR':'🇲🇦','TUN':'🇹🇳','ALG':'🇩🇿','DZA':'🇩🇿','ZIM':'🇿🇼','ZWE':'🇿🇼','NAM':'🇳🇦','BOT':'🇧🇼','BWA':'🇧🇼','MOZ':'🇲🇿','MAD':'🇲🇬','MDG':'🇲🇬','LUX':'🇱🇺','MON':'🇲🇨','MCO':'🇲🇨','LIE':'🇱🇮'};

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

// PRE_ODDS: [winner, top5, top10] — 2026 Masters opening odds
var PRE_ODDS = {
  'Scottie Scheffler':         ['+510',    '+110',   '-186'],
  'Jon Rahm':                  ['+900',    '+174',   '-120'],
  'Bryson DeChambeau':         ['+1050',   '+210',   '+102'],
  'Rory McIlroy':              ['+1175',   '+230',   '+110'],
  'Ludvig Aberg':              ['+1650',   '+315',   '+152'],
  'Xander Schauffele':         ['+1750',   '+300',   '+138'],
  'Cameron Young':             ['+2200',   '+375',   '+176'],
  'Tommy Fleetwood':           ['+2250',   '+365',   '+166'],
  'Matt Fitzpatrick':          ['+2300',   '+385',   '+175'],
  'Hideki Matsuyama':          ['+2700',   '+435',   '+196'],
  'Collin Morikawa':           ['+3100',   '+485',   '+215'],
  'Min Woo Lee':               ['+3300',   '+530',   '+240'],
  'Justin Rose':               ['+3500',   '+580',   '+265'],
  'Robert MacIntyre':          ['+3500',   '+540',   '+240'],
  'Brooks Koepka':             ['+3700',   '+620',   '+285'],
  'Patrick Reed':              ['+4200',   '+650',   '+290'],
  'Jordan Spieth':             ['+4200',   '+640',   '+285'],
  'Chris Gotterup':            ['+4300',   '+670',   '+305'],
  'Viktor Hovland':            ['+4500',   '+690',   '+310'],
  'Si Woo Kim':                ['+5000',   '+690',   '+295'],
  'Akshay Bhatia':             ['+5100',   '+750',   '+325'],
  'Russell Henley':            ['+5400',   '+730',   '+310'],
  'Justin Thomas':             ['+5900',   '+900',   '+400'],
  'Adam Scott':                ['+6000',   '+840',   '+360'],
  'Patrick Cantlay':           ['+6400',   '+890',   '+380'],
  'Jake Knapp':                ['+6400',   '+930',   '+405'],
  'Shane Lowry':               ['+6600',   '+890',   '+375'],
  'Jason Day':                 ['+6800',   '+910',   '+385'],
  'J.J. Spaun':                ['+6800',   '+970',   '+415'],
  'Sam Burns':                 ['+7000',   '+980',   '+420'],
  'Nicolai Hojgaard':          ['+7400',   '+1025',  '+435'],
  'Sepp Straka':               ['+7600',   '+1025',  '+430'],
  'Maverick McNealy':          ['+7800',   '+1050',  '+440'],
  'Tyrrell Hatton':            ['+8000',   '+1075',  '+455'],
  'Jacob Bridgeman':           ['+8400',   '+1100',  '+455'],
  'Corey Conners':             ['+8400',   '+1100',  '+455'],
  'Kurt Kitayama':             ['+10000',  '+1300',  '+530'],
  'Harris English':            ['+10000',  '+1275',  '+510'],
  'Ben Griffin':               ['+11000',  '+1350',  '+540'],
  'Cameron Smith':             ['+11000',  '+1450',  '+590'],
  'Sungjae Im':                ['+11500',  '+1450',  '+580'],
  'Gary Woodland':             ['+12000',  '+1500',  '+620'],
  'Max Homa':                  ['+12000',  '+1550',  '+650'],
  'Daniel Berger':             ['+12000',  '+1450',  '+580'],
  'Rasmus Hojgaard':           ['+13000',  '+1600',  '+660'],
  'Keegan Bradley':            ['+14000',  '+1650',  '+670'],
  'Marco Penge':               ['+14000',  '+1750',  '+710'],
  'Harry Hall':                ['+15000',  '+1750',  '+700'],
  'Ryan Gerard':               ['+15500',  '+1750',  '+700'],
  'Alex Noren':                ['+16000',  '+1800',  '+710'],
  'Samuel Stevens':            ['+17000',  '+1950',  '+760'],
  'Nick Taylor':               ['+19000',  '+2050',  '+780'],
  'Ryan Fox':                  ['+20000',  '+2250',  '+870'],
  'Wyndham Clark':             ['+20000',  '+2450',  '+970'],
  'Michael Kim':               ['+21000',  '+2350',  '+910'],
  'Max Greyserman':            ['+21000',  '+2350',  '+920'],
  'Brian Harman':              ['+21000',  '+2350',  '+890'],
  'Kristoffer Reitan':         ['+22000',  '+2450',  '+940'],
  'Casey Jarvis':              ['+23000',  '+2450',  '+950'],
  'Carlos Ortiz':              ['+23000',  '+2500',  '+970'],
  'Sergio Garcia':             ['+25000',  '+2700',  '+1000'],
  'Dustin Johnson':            ['+25000',  '+2700',  '+1025'],
  'Aaron Rai':                 ['+25000',  '+2600',  '+1000'],
  'Haotong Li':                ['+27000',  '+2800',  '+1075'],
  'Matt McCarty':              ['+28000',  '+2900',  '+1075'],
  'Andrew Novak':              ['+29000',  '+3000',  '+1100'],
  'Tom McKibbin':              ['+29000',  '+3000',  '+1100'],
  'Rasmus Neergaard-Petersen': ['+31000',  '+3200',  '+1200'],
  'Nicolas Echavarria':        ['+32500',  '+3200',  '+1200'],
  'Sami Valimaki':             ['+36000',  '+3600',  '+1275'],
  'Aldrich Potgieter':         ['+36000',  '+3700',  '+1375'],
  'John Keefer':               ['+36000',  '+3600',  '+1325'],
  'Michael Brennan':           ['+39000',  '+3900',  '+1425'],
  'Bubba Watson':              ['+52500',  '+4900',  '+1700'],
  'Zach Johnson':              ['+52500',  '+4700',  '+1600'],
  'Charl Schwartzel':          ['+62500',  '+5400',  '+1800'],
  'Davis Riley':               ['+82500',  '+7200',  '+2450'],
  'Mason Howell':              ['+200000', '+15500', '+4700'],
  'Danny Willett':             ['+225000', '+16500', '+4900'],
  'Angel Cabrera':             ['+300000', '+22000', '+6700'],
  'Brian Campbell':            ['+325000', '+21000', '+6000'],
  'Ethan Fang':                ['+325000', '+23000', '+6700'],
  'Fifa Laopakdee':            ['+350000', '+26000', '+7600'],
  'Naoyuki Kataoka':           ['+450000', '+32500', '+9000'],
  'Brandon Holtz':             ['+500000', '+41000', '+17000'],
  'Vijay Singh':               ['+500000', '+49000', '+17500'],
  'Mike Weir':                 ['+500000', '+49000', '+23000'],
  'Fred Couples':              ['+500000', '+49000', '+18500'],
  'Jose Maria Olazabal':       ['+500000', '+50000', '+35000'],
  'Mateo Pulcini':             ['+500000', '+50000', '+24000'],
  'Jackson Herrington':        ['+500000', '+49000', '+18500']
};

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

var PILL_CLASSES = ['pill-a', 'pill-b', 'pill-c', 'pill-d', 'pill-e'];
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
var COURSE_PAR = 72;

// Dynamic tournament metadata (populated from ESPN on first fetch)
var TOURNEY_NAME = '';
var TOURNEY_SHORT = '';
var TOURNEY_DATES = '';
var TOURNEY_COURSE = '';
var TOURNEY_LOGO = '';

// Course → IANA timezone, used to render tee times in event-local time
// (matching what ESPN.com / pgatour.com show) instead of the user's browser TZ.
var COURSE_TZ = {
  'TPC Louisiana':                'America/Chicago',
  'Harbour Town Golf Links':      'America/New_York',
  'Quail Hollow Club':            'America/New_York',
  'Colonial Country Club':        'America/Chicago',
  'Muirfield Village Golf Club':  'America/New_York',
  'TPC River Highlands':          'America/New_York',
  'Pebble Beach Golf Links':      'America/Los_Angeles',
  'Augusta National Golf Club':   'America/New_York',
  'Bay Hill Club & Lodge':        'America/New_York',
  'TPC Sawgrass':                 'America/New_York',
  'Torrey Pines Golf Course':     'America/Los_Angeles',
  'Riviera Country Club':         'America/Los_Angeles',
  'PGA National Resort':          'America/New_York',
  'TPC Scottsdale':               'America/Phoenix',
  'Waialae Country Club':         'Pacific/Honolulu',
  'Plantation Course at Kapalua': 'Pacific/Honolulu',
  'Medinah Country Club':         'America/Chicago',
  'East Lake Golf Club':          'America/New_York',
  'Caves Valley Golf Club':       'America/New_York',
  'Castle Pines Golf Club':       'America/Denver',
  'TPC Twin Cities':              'America/Chicago',
  'Detroit Golf Club':            'America/Detroit',
  'TPC Deere Run':                'America/Chicago',
  'Sedgefield Country Club':      'America/New_York',
  'Liberty National Golf Club':   'America/New_York',
  'Vidanta Vallarta':             'America/Mexico_City',
  'The Renaissance Club':         'Europe/London',
  'TPC Craig Ranch':              'America/Chicago',
  'Copperhead Course':            'America/New_York',
  'Royal Liverpool':              'Europe/London'
};

function getEventTZ(courseName) {
  if (!courseName) return null;
  if (COURSE_TZ[courseName]) return COURSE_TZ[courseName];
  var lower = courseName.toLowerCase();
  for (var k in COURSE_TZ) {
    var kl = k.toLowerCase();
    if (lower.indexOf(kl) !== -1 || kl.indexOf(lower) !== -1) return COURSE_TZ[k];
  }
  return null;
}

// Format an ISO tee-time string in the event's local timezone, e.g. "8:00 AM".
// Falls back to America/New_York when the course isn't in COURSE_TZ — most
// PGA events are East Coast and we'd rather be a few hours off than silently
// use the user's browser timezone, which can land 1-3 hours off depending
// where they're sitting. Logs a one-time warn per course so we know to add
// the mapping.
var _fmtTeeTimeWarned = {};
function fmtTeeTime(iso, courseName) {
  if (!iso || iso.indexOf('T') === -1) return '';
  try {
    var tz = getEventTZ(courseName);
    if (!tz) {
      tz = 'America/New_York';
      if (courseName && !_fmtTeeTimeWarned[courseName]) {
        _fmtTeeTimeWarned[courseName] = 1;
        console.warn('🕐 No COURSE_TZ entry for "' + courseName + '" — defaulting to America/New_York. Add a row to COURSE_TZ in state.js.');
      }
    }
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  } catch (e) {
    try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
    catch (e2) { return ''; }
  }
}

var WINNING_SCORE = null; // actual tournament winner's score to par (set when tourney final)
var TOURNEY_FINAL = false; // true when all 4 rounds complete, 0 holes left

// Live probability predictions (keyed by canonical player name)
var DG_LIVE_PREDS = {};
var DG_META = { event_name: '', last_updated: '', source: '', fetched_at: 0 };
var DG_API_KEY = '3a65d1e85639edeb0476c68b9215';

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
var WELCOME_KEY = 'eastpole_welcome_v1_seen';
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
  try {
    var today = new Date().toISOString().slice(0, 10);
    var data = JSON.parse(localStorage.getItem(SPLASH_DATE_KEY) || '{}');
    // Only show splash if we haven't seen it yet today
    return data.date !== today;
  } catch(e) {
    // On error, show splash
    return true;
  }
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

// Match an identity key against an entry. New keys are prefixed:
//   __ent__<lowercased entrant>  · __eml__<lowercased email>  · __team__<team>
// Legacy keys (bare email / team / entrant) are matched loosely.
function _matchUserKey(e, key) {
  if (!key) return false;
  if (typeof key === 'string') {
    if (key.indexOf('__ent__') === 0) {
      return !!(e.entrant && e.entrant.toLowerCase().trim() === key.slice(7));
    }
    if (key.indexOf('__eml__') === 0) {
      return !!(e.email && e.email.toLowerCase() === key.slice(7));
    }
    if (key.indexOf('__team__') === 0) {
      return e.team === key.slice(8);
    }
    // Legacy/loose match: email → entrant → team
    var kl = String(key).toLowerCase();
    if (e.email && e.email === key) return true;
    if (e.entrant && e.entrant.toLowerCase() === kl) return true;
    if (e.team === key) return true;
  }
  return false;
}

function loadUser() {
  try {
    var s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (s?.email && ENTRIES.some(function(e) { return _matchUserKey(e, s.email); })) {
      setUser(s.email, s.activeTeamIdx != null ? s.activeTeamIdx : -1, false);
      return true;
    }
  } catch(e) {}
  return false;
}

function setUser(email, teamIdx, save) {
  if (save === undefined) save = true;
  currentUserEmail = email;
  currentUserTeams = ENTRIES.filter(function(e) { return _matchUserKey(e, email); });
  activeTeamIdx = teamIdx === -1 ? -1 : Math.min(teamIdx, Math.max(0, currentUserTeams.length - 1));
  if (save) saveUser();
  updateHeaderDisplay();
  updateLbSeg();
  renderAll();
}
