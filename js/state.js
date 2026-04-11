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
  { team: 'Skippers On Top', email: 'Jules Tompkins', name: 'Jules Tompkins', picks: ['Jon Rahm','Xander Schauffele','Hideki Matsuyama','Robert MacIntyre','Sam Burns','Corey Conners','Jacob Bridgeman','Sungjae Im','Ryan Gerard','Brian Harman'] },
  { team: 'Bogey Bob', email: 'Robert bennett', name: 'Robert bennett', picks: ['Scottie Scheffler','Cameron Young','Robert MacIntyre','Chris Gotterup','Akshay Bhatia','Shane Lowry','J.J. Spaun','Gary Woodland','Sungjae Im','Keegan Bradley'] },
  { team: 'Chuck 1', email: 'Charlie Cilinski', name: 'Charlie Cilinski', picks: ['Xander Schauffele','Justin Rose','Robert MacIntyre','Si Woo Kim','Sam Burns','J.J. Spaun','Maverick McNealy','Gary Woodland','Sungjae Im','Sam Stevens'] },
  { team: 'Dinbo', email: 'Tyler Dinbokowitz', name: 'Tyler Dinbokowitz', picks: ['Xander Schauffele','Matt Fitzpatrick','Viktor Hovland','Justin Thomas','Sepp Straka','Corey Conners','Cameron Smith','Max Homa','Wyndham Clark','Dustin Johnson'] },
  { team: 'Chuck 2', email: 'Charlie Cilinski', name: 'Charlie Cilinski', picks: ['Scottie Scheffler','Tommy Fleetwood','Russell Henley','Min Woo Lee','Akshay Bhatia','Corey Conners','Harris English','Gary Woodland','Rasmus Hojgaard','Nick Taylor'] },
  { team: 'Chuck 3', email: 'Charlie Cilinski', name: 'Charlie Cilinski', picks: ['Ludvig Aberg','Matt Fitzpatrick','Chris Gotterup','Justin Thomas','Jason Day','Shane Lowry','Ben Griffin','Gary Woodland','Keegan Bradley','Ryan Gerard'] },
  { team: 'Chuck 4', email: 'Charlie Cilinski', name: 'Charlie Cilinski', picks: ['Scottie Scheffler','Bryson DeChambeau','Robert MacIntyre','Russell Henley','Kurt Kitayama','Cameron Smith','Daniel Berger','Sungjae Im','Alexander Noren','Tom McKibbin'] },
  { team: 'Chuck 5', email: 'Charlie Cilinski', name: 'Charlie Cilinski', picks: ['Jon Rahm','Xander Schauffele','Robert MacIntyre','Si Woo Kim','Akshay Bhatia','Jake Knapp','Sam Burns','Gary Woodland','Sungjae Im','Michael Kim'] },
  { team: 'I won in 2024', email: 'Brandon McCarn', name: 'Brandon McCarn', picks: ['Scottie Scheffler','Bryson DeChambeau','Brooks Koepka','Viktor Hovland','Jason Day','Shane Lowry','Cameron Smith','Max Homa','Sergio Garcia','Bubba Watson'] },
  { team: 'Tiger Woods Driving School (1)', email: 'Logan Eaton', name: 'Logan Eaton', picks: ['Scottie Scheffler','Xander Schauffele','Russell Henley','Patrick Reed','Akshay Bhatia','Sepp Straka','Tyrrell Hatton','Gary Woodland','Max Homa','Sungjae Im'] },
  { team: 'Tiger Woods Driving School (2)', email: 'Logan Eaton', name: 'Logan Eaton', picks: ['Ludvig Aberg','Tommy Fleetwood','Robert MacIntyre','Si Woo Kim','Shane Lowry','J.J. Spaun','Harris English','Keegan Bradley','Wyndham Clark','Zach Johnson'] },
  { team: 'Pimento Cheese Sandwich', email: 'robert dewitt', name: 'robert dewitt', picks: ['Scottie Scheffler','Ludvig Aberg','Brooks Koepka','Viktor Hovland','Sepp Straka','Sam Burns','Cameron Smith','Gary Woodland','Brian Harman','Bubba Watson'] },
  { team: 'Tiger Woods Driving School (3)', email: 'Logan Eaton', name: 'Logan Eaton', picks: ['Jon Rahm','Cameron Young','Brooks Koepka','Chris Gotterup','Sam Burns','Maverick McNealy','Cameron Smith','Rasmus Hojgaard','Alexander Noren','Sam Stevens'] },
  { team: 'Fat Whale', email: 'Michael Hartman', name: 'Michael Hartman', picks: ['Bryson DeChambeau','Ludvig Aberg','Hideki Matsuyama','Min Woo Lee','Akshay Bhatia','Tyrrell Hatton','Jason Day','Gary Woodland','Rasmus Hojgaard','Marco Penge'] },
  { team: 'Ridin Dirty', email: 'CHRIS RIEGLE', name: 'CHRIS RIEGLE', picks: ['Scottie Scheffler','Bryson DeChambeau','Brooks Koepka','Viktor Hovland','J.J. Spaun','Maverick McNealy','Cameron Smith','Max Homa','Keegan Bradley','Brian Harman'] },
  { team: 'SkipSkippersSkipSkippersSkipSkippers', email: 'Jared karr', name: 'Jared karr', picks: ['Jon Rahm','Xander Schauffele','Robert MacIntyre','Patrick Reed','Akshay Bhatia','Jake Knapp','Nicolai Hojgaard','Gary Woodland','Marco Penge','Ryan Fox'] },
  { team: 'Neville\'s Picks', email: 'Neville Tompkins', name: 'Neville Tompkins', picks: ['Jon Rahm','Ludvig Aberg','Chris Gotterup','Min Woo Lee','Akshay Bhatia','Jason Day','Sam Burns','Gary Woodland','Keegan Bradley','Brian Harman'] },
  { team: 'Clive\'s Contenders', email: 'Clive Tompkins', name: 'Clive Tompkins', picks: ['Jon Rahm','Bryson DeChambeau','Robert MacIntyre','Chris Gotterup','Sepp Straka','Jason Day','Sam Burns','Keegan Bradley','Harry Hall','Wyndham Clark'] },
  { team: 'Shark Selections', email: 'Jake Stoll', name: 'Jake Stoll', picks: ['Ludvig Aberg','Tommy Fleetwood','Robert MacIntyre','Chris Gotterup','Jake Knapp','Sam Burns','Maverick McNealy','Sungjae Im','Rasmus Hojgaard','Brian Harman'] },
  { team: 'The Birdie Bada Bings', email: 'Jake Stoll', name: 'Jake Stoll', picks: ['Scottie Scheffler','Cameron Young','Si Woo Kim','Adam Scott','Sepp Straka','J.J. Spaun','Jacob Bridgeman','Marco Penge','Hao-Tong Li','Michael Kim'] },
  { team: 'Birdie Boys', email: 'Andrew Steioff', name: 'Andrew Steioff', picks: ['Scottie Scheffler','Ludvig Aberg','Brooks Koepka','Robert MacIntyre','Sepp Straka','Shane Lowry','Cameron Smith','Sungjae Im','Keegan Bradley','Marco Penge'] },
  { team: 'Team Remy', email: 'Andrew Long', name: 'Andrew Long', picks: ['Ludvig Aberg','Justin Rose','Robert MacIntyre','Min Woo Lee','Jake Knapp','Jacob Bridgeman','Ben Griffin','Gary Woodland','Max Homa','Keegan Bradley'] },
  { team: 'Blackstone Golf App Ventures', email: 'Tyler Dewitt', name: 'Tyler Dewitt', picks: ['Ludvig Aberg','Jordan Spieth','Russell Henley','Patrick Reed','Tyrrell Hatton','Jason Day','Cameron Smith','Gary Woodland','Sungjae Im','Aaron Rai'] },
  { team: 'Flan', email: 'Kyle Flanagan', name: 'Kyle Flanagan', picks: ['Scottie Scheffler','Matt Fitzpatrick','Patrick Reed','Adam Scott','Tyrrell Hatton','Jason Day','Nicolai Hojgaard','Max Homa','Dustin Johnson','Michael Kim'] },
  { team: 'Sunday Rally', email: 'Peter Tompkins', name: 'Peter Tompkins', picks: ['Cameron Young','Tommy Fleetwood','Hideki Matsuyama','Viktor Hovland','Shane Lowry','Corey Conners','Cameron Smith','Gary Woodland','Wyndham Clark','Danny Willett'] },
  { team: 'Misguided Foursome', email: 'Peter Tompkins', name: 'Peter Tompkins', picks: ['Scottie Scheffler','Rory McIlroy','Russell Henley','Justin Thomas','Jason Day','Sam Burns','Harris English','Keegan Bradley','Dustin Johnson','Zach Johnson'] },
  { team: 'DUI\'s & divorces🐅', email: 'Jordan Flynn', name: 'Jordan Flynn', picks: ['Rory McIlroy','Tommy Fleetwood','Hideki Matsuyama','Min Woo Lee','Akshay Bhatia','Sam Burns','Corey Conners','Marco Penge','Ryan Gerard','Aaron Rai'] },
  { team: 'Tmoney', email: 'Thomas Meadows', name: 'Thomas Meadows', picks: ['Rory McIlroy','Tommy Fleetwood','Viktor Hovland','Patrick Cantlay','Corey Conners','Jacob Bridgeman','Cameron Smith','Max Homa','Brian Harman','Dustin Johnson'] },
  { team: 'Jmoore1', email: 'Jonathan Moore', name: 'Jonathan Moore', picks: ['Scottie Scheffler','Bryson DeChambeau','Patrick Reed','Adam Scott','Akshay Bhatia','Jason Day','Jake Knapp','Sungjae Im','Keegan Bradley','Harry Hall'] },
  { team: 'Jmoore2', email: 'Jonathan Moore', name: 'Jonathan Moore', picks: ['Matt Fitzpatrick','Justin Rose','Chris Gotterup','Min Woo Lee','Jason Day','Sam Burns','Ben Griffin','Gary Woodland','Rasmus Hojgaard','Alexander Noren'] },
  { team: 'Jmoore3', email: 'Jonathan Moore', name: 'Jonathan Moore', picks: ['Ludvig Aberg','Xander Schauffele','Brooks Koepka','Patrick Reed','Shane Lowry','Sam Burns','Nicolai Hojgaard','Max Homa','Rasmus Hojgaard','Ryan Gerard'] },
  { team: 'Jmoore4', email: 'Jonathan Moore', name: 'Jonathan Moore', picks: ['Scottie Scheffler','Rory McIlroy','Brooks Koepka','Min Woo Lee','Akshay Bhatia','Corey Conners','Daniel Berger','Sungjae Im','Aaron Rai','Wyndham Clark'] },
  { team: 'Jmoore5', email: 'Jonathan Moore', name: 'Jonathan Moore', picks: ['Cameron Young','Matt Fitzpatrick','Chris Gotterup','Min Woo Lee','Jason Day','Sam Burns','Maverick McNealy','Sungjae Im','Rasmus Hojgaard','Alexander Noren'] },
  { team: 'John McCullough', email: 'John McCullough', name: 'John McCullough', picks: ['Tommy Fleetwood','Justin Rose','Russell Henley','Patrick Reed','Akshay Bhatia','Sepp Straka','Jacob Bridgeman','Harry Hall','Nick Taylor','Wyndham Clark'] },
  { team: 'CrownMyCoke', email: 'Barron', name: 'Barron', picks: ['Scottie Scheffler','Jordan Spieth','Russell Henley','Justin Thomas','Akshay Bhatia','J.J. Spaun','Daniel Berger','Max Homa','Keegan Bradley','Wyndham Clark'] },
  { team: 'CrownMyCoke 2', email: 'Barron', name: 'Barron', picks: ['Scottie Scheffler','Jordan Spieth','Hideki Matsuyama','Justin Thomas','Sepp Straka','Jake Knapp','Daniel Berger','Max Homa','Sungjae Im','Keegan Bradley'] },
  { team: 'CrownMyCoke 3', email: 'Barron', name: 'Barron', picks: ['Scottie Scheffler','Jordan Spieth','Patrick Reed','Justin Thomas','Akshay Bhatia','Jake Knapp','J.J. Spaun','Max Homa','Keegan Bradley','Nick Taylor'] },
  { team: 'CrownMyCoke 4', email: 'Barron', name: 'Barron', picks: ['Scottie Scheffler','Ludvig Aberg','Si Woo Kim','Justin Thomas','Akshay Bhatia','Jake Knapp','Kurt Kitayama','Max Homa','Sungjae Im','Brian Harman'] },
  { team: 'CrownMyCoke 5', email: 'Barron', name: 'Barron', picks: ['Scottie Scheffler','Tommy Fleetwood','Brooks Koepka','Si Woo Kim','Akshay Bhatia','Sam Burns','Ben Griffin','Max Homa','Sungjae Im','Keegan Bradley'] },
  { team: 'WhereIsYellamaraju?', email: 'Deval Patel', name: 'Deval Patel', picks: ['Ludvig Aberg','Justin Rose','Hideki Matsuyama','Patrick Reed','Akshay Bhatia','Sepp Straka','Jacob Bridgeman','Sungjae Im','Wyndham Clark','Michael Kim'] },
  { team: 'Aberg and Fries', email: 'Jake Stoll', name: 'Jake Stoll', picks: ['Jon Rahm','Ludvig Aberg','Robert MacIntyre','Min Woo Lee','Sam Burns','Kurt Kitayama','Daniel Berger','Sungjae Im','Rasmus Hojgaard','Nicolas Echavarria'] },
  { team: 'Pimento & Pars', email: 'Tony Donald', name: 'Tony Donald', picks: ['Jon Rahm','Bryson DeChambeau','Hideki Matsuyama','Patrick Reed','Shane Lowry','Corey Conners','Cameron Smith','Sungjae Im','Brian Harman','Dustin Johnson'] },
  { team: 'Jemmy', email: 'Jessica Stoll', name: 'Jessica Stoll', picks: ['Ludvig Aberg','Cameron Young','Robert MacIntyre','Justin Thomas','Akshay Bhatia','Sepp Straka','J.J. Spaun','Rasmus Hojgaard','Ryan Fox','John Keefer'] },
  { team: 'Firm Greens & Soft Pimento', email: 'Tony Donald', name: 'Tony Donald', picks: ['Jon Rahm','Bryson DeChambeau','Brooks Koepka','Viktor Hovland','Tyrrell Hatton','Sam Burns','Cameron Smith','Rasmus Hojgaard','Wyndham Clark','Dustin Johnson'] },
  { team: 'cameron-1', email: 'Cam Cameron', name: 'Cam Cameron', picks: ['Scottie Scheffler','Jon Rahm','Chris Gotterup','Patrick Reed','Jacob Bridgeman','Maverick McNealy','Daniel Berger','Ryan Gerard','Sam Stevens','Casey Jarvis'] },
  { team: 'cameron-2', email: 'Cam Cameron', name: 'Cam Cameron', picks: ['Scottie Scheffler','Jon Rahm','Russell Henley','Patrick Reed','Akshay Bhatia','Maverick McNealy','Daniel Berger','Max Homa','Sungjae Im','Nick Taylor'] },
  { team: 'cameron-3', email: 'Cam Cameron', name: 'Cam Cameron', picks: ['Jon Rahm','Xander Schauffele','Robert MacIntyre','Patrick Reed','Akshay Bhatia','Corey Conners','Jacob Bridgeman','Gary Woodland','Max Homa','Sungjae Im'] },
  { team: 'Percocets & Pimento Cheese', email: 'Jon Deming', name: 'Jon Deming', picks: ['Ludvig Aberg','Jordan Spieth','Chris Gotterup','Patrick Reed','Jake Knapp','Corey Conners','Jacob Bridgeman','Max Homa','Sungjae Im','Alexander Noren'] },
  { team: 'cameron-4', email: 'Cam Cameron', name: 'Cam Cameron', picks: ['Xander Schauffele','Cameron Young','Patrick Reed','Min Woo Lee','Corey Conners','Nicolai Hojgaard','Harris English','Sungjae Im','Sam Stevens','Casey Jarvis'] },
  { team: 'cameron-5', email: 'Cam Cameron', name: 'Cam Cameron', picks: ['Ludvig Aberg','Cameron Young','Hideki Matsuyama','Patrick Reed','Akshay Bhatia','Jake Knapp','Jacob Bridgeman','Sungjae Im','Harry Hall','Sam Stevens'] },
  { team: 'Ignatius J. Reilly', email: 'Scott Hirons', name: 'Scott Hirons', picks: ['Bryson DeChambeau','Ludvig Aberg','Russell Henley','Patrick Reed','Sepp Straka','Jake Knapp','Daniel Berger','Rasmus Hojgaard','Kristoffer Reitan','John Keefer'] },
  { team: 'Jerky King of Sandy Springs', email: 'Alan Golivesky', name: 'Alan Golivesky', picks: ['Jon Rahm','Matt Fitzpatrick','Robert MacIntyre','Chris Gotterup','Sepp Straka','Sam Burns','Jacob Bridgeman','Harry Hall','Aaron Rai','Brian Harman'] },
  { team: 'Verogy1', email: 'Kyle Perry', name: 'Kyle Perry', picks: ['Scottie Scheffler','Jon Rahm','Patrick Reed','Patrick Cantlay','Akshay Bhatia','J.J. Spaun','Maverick McNealy','Gary Woodland','Rasmus Hojgaard','Brian Harman'] },
  { team: 'Verogy2', email: 'Kyle Perry', name: 'Kyle Perry', picks: ['Rory McIlroy','Bryson DeChambeau','Robert MacIntyre','Chris Gotterup','Shane Lowry','Harris English','Ben Griffin','Max Homa','Aaron Rai','Danny Willett'] },
  { team: 'Verogy3', email: 'Kyle Perry', name: 'Kyle Perry', picks: ['Xander Schauffele','Justin Rose','Viktor Hovland','Adam Scott','Tyrrell Hatton','Jason Day','Corey Conners','Max Homa','Nick Taylor','Ryan Fox'] },
  { team: 'Verogy4', email: 'Kyle Perry', name: 'Kyle Perry', picks: ['Jon Rahm','Bryson DeChambeau','Hideki Matsuyama','Si Woo Kim','Akshay Bhatia','Jake Knapp','Cameron Smith','Brian Harman','Wyndham Clark','Dustin Johnson'] },
  { team: 'Verogy5', email: 'Kyle Perry', name: 'Kyle Perry', picks: ['Scottie Scheffler','Rory McIlroy','Patrick Reed','Justin Thomas','Akshay Bhatia','Tyrrell Hatton','Harris English','Keegan Bradley','Brian Harman','Sergio Garcia'] },
  { team: 'PXGsR4Euros', email: 'David Cook', name: 'David Cook', picks: ['Jon Rahm','Bryson DeChambeau','Brooks Koepka','Patrick Reed','Akshay Bhatia','Nicolai Hojgaard','Maverick McNealy','Gary Woodland','Marco Penge','Harry Hall'] },
  { team: 'Skillz', email: 'Adam Skillingstad', name: 'Adam Skillingstad', picks: ['Jon Rahm','Xander Schauffele','Robert MacIntyre','Min Woo Lee','Akshay Bhatia','Tyrrell Hatton','Corey Conners','Sungjae Im','Davis Riley','Zach Johnson'] },
  { team: 'Revenge of the Spieth', email: 'Spencer Bass', name: 'Spencer Bass', picks: ['Bryson DeChambeau','Ludvig Aberg','Russell Henley','Viktor Hovland','Akshay Bhatia','Tyrrell Hatton','Jake Knapp','Max Homa','Sungjae Im','Keegan Bradley'] },
  { team: 'Skillz 2', email: 'Adam Skillingstad', name: 'Adam Skillingstad', picks: ['Scottie Scheffler','Bryson DeChambeau','Robert MacIntyre','Si Woo Kim','Akshay Bhatia','Jason Day','Corey Conners','Gary Woodland','Keegan Bradley','Davis Riley'] },
  { team: 'Revenge of the Spieth 2', email: 'Spencer Bass', name: 'Spencer Bass', picks: ['Scottie Scheffler','Jordan Spieth','Brooks Koepka','Viktor Hovland','Shane Lowry','Corey Conners','Maverick McNealy','Max Homa','Sungjae Im','Aaron Rai'] },
  { team: '🌴🥥🌺', email: 'Andrew Schmidt', name: 'Andrew Schmidt', picks: ['Bryson DeChambeau','Cameron Young','Robert MacIntyre','Justin Thomas','Akshay Bhatia','Nicolai Hojgaard','Jacob Bridgeman','Max Homa','Marco Penge','Dustin Johnson'] },
  { team: '🌴🥥🌺🌺', email: 'Andrew Schmidt', name: 'Andrew Schmidt', picks: ['Ludvig Aberg','Cameron Young','Hideki Matsuyama','Justin Thomas','Shane Lowry','Nicolai Hojgaard','J.J. Spaun','Gary Woodland','Aaron Rai','Wyndham Clark'] },
  { team: '🌴🥥🌺🌺🌺', email: 'Andrew Schmidt', name: 'Andrew Schmidt', picks: ['Scottie Scheffler','Bryson DeChambeau','Robert MacIntyre','Justin Thomas','Shane Lowry','Nicolai Hojgaard','J.J. Spaun','Gary Woodland','Max Homa','Dustin Johnson'] },
  { team: '🌴🥥🌺🌺🌺🌺', email: 'Andrew Schmidt', name: 'Andrew Schmidt', picks: ['Xander Schauffele','Cameron Young','Robert MacIntyre','Justin Thomas','Akshay Bhatia','Shane Lowry','Nicolai Hojgaard','Max Homa','Aaron Rai','Bubba Watson'] },
  { team: '🌴🥥🥥🌺', email: 'Andrew Schmidt', name: 'Andrew Schmidt', picks: ['Bryson DeChambeau','Cameron Young','Brooks Koepka','Justin Thomas','Akshay Bhatia','Shane Lowry','Nicolai Hojgaard','Max Homa','Alexander Noren','Dustin Johnson'] },
  { team: 'Sungjae Bloody Sungjae', email: 'Jake Stoll', name: 'Jake Stoll', picks: ['Scottie Scheffler','Justin Rose','Viktor Hovland','Patrick Cantlay','Tyrrell Hatton','Nicolai Hojgaard','Maverick McNealy','Sungjae Im','Aaron Rai','Wyndham Clark'] },
  { team: 'Robot Viking Potato Golfer', email: 'Ben Stoll', name: 'Ben Stoll', picks: ['Scottie Scheffler','Jon Rahm','Viktor Hovland','Patrick Cantlay','Jason Day','Shane Lowry','Corey Conners','Sungjae Im','Brian Harman','Wyndham Clark'] },
  { team: 'Magnolia Drunk Reserve', email: 'Ben Stoll', name: 'Ben Stoll', picks: ['Scottie Scheffler','Rory McIlroy','Hideki Matsuyama','Justin Thomas','Tyrrell Hatton','Sam Burns','Cameron Smith','Max Homa','Sungjae Im','Dustin Johnson'] },
  { team: 'Christopher Church', email: 'Chris Church', name: 'Chris Church', picks: ['Jon Rahm','Bryson DeChambeau','Si Woo Kim','Min Woo Lee','Sam Burns','Nicolai Hojgaard','Jacob Bridgeman','Sungjae Im','Nick Taylor','Wyndham Clark'] },
  { team: 'Gbutter2130', email: 'Gabe butterfield', name: 'Gabe butterfield', picks: ['Bryson DeChambeau','Matt Fitzpatrick','Hideki Matsuyama','Robert MacIntyre','Akshay Bhatia','Tyrrell Hatton','Shane Lowry','Sungjae Im','Rasmus Hojgaard','Aaron Rai'] },
  { team: 'Art VandeLayup', email: 'Tyler conlan', name: 'Tyler conlan', picks: ['Rory McIlroy','Bryson DeChambeau','Hideki Matsuyama','Justin Thomas','Akshay Bhatia','Shane Lowry','Sam Burns','Gary Woodland','Max Homa','Harry Hall'] },
  { team: 'Art VandeLayup 2', email: 'Tyler conlan', name: 'Tyler conlan', picks: ['Scottie Scheffler','Ludvig Aberg','Hideki Matsuyama','Robert MacIntyre','Tyrrell Hatton','Jason Day','Jake Knapp','Gary Woodland','Brian Harman','Hao-Tong Li'] },
  { team: 'Slouching Tiger, Rolling Wagon TT1', email: 'Brett Torrence', name: 'Brett Torrence', picks: ['Scottie Scheffler','Jon Rahm','Brooks Koepka','Robert MacIntyre','Akshay Bhatia','Shane Lowry','Corey Conners','Gary Woodland','Sungjae Im','Marco Penge'] },
  { team: 'No Shot', email: 'Jacob Foster', name: 'Jacob Foster', picks: ['Scottie Scheffler','Xander Schauffele','Patrick Reed','Min Woo Lee','Akshay Bhatia','Jake Knapp','Corey Conners','Max Homa','Sungjae Im','Brian Harman'] },
  { team: 'Range Rollover', email: 'Brett Torrence', name: 'Brett Torrence', picks: ['Scottie Scheffler','Rory McIlroy','Chris Gotterup','Patrick Reed','Sepp Straka','Jake Knapp','Sam Burns','Max Homa','Sungjae Im','Brian Harman'] },
  { team: 'My dog is also named Scottie', email: 'Samuel Lancaster', name: 'Samuel Lancaster', picks: ['Rory McIlroy','Xander Schauffele','Robert MacIntyre','Patrick Reed','Akshay Bhatia','Jason Day','Shane Lowry','Max Homa','Sungjae Im','Wyndham Clark'] },
  { team: 'My dogs name is Scottie', email: 'Taylor Lancaster', name: 'Taylor Lancaster', picks: ['Scottie Scheffler','Justin Rose','Russell Henley','Justin Thomas','Akshay Bhatia','Sepp Straka','Maverick McNealy','Gary Woodland','Brian Harman','Andrew Novak'] },
  { team: 'JSwartz1', email: 'Joshua Swartz', name: 'Joshua Swartz', picks: ['Scottie Scheffler','Rory McIlroy','Hideki Matsuyama','Patrick Cantlay','Jason Day','Shane Lowry','Corey Conners','Sungjae Im','Keegan Bradley','Brian Harman'] },
  { team: 'No Shot 2', email: 'Jacob Foster', name: 'Jacob Foster', picks: ['Scottie Scheffler','Jon Rahm','Hideki Matsuyama','Patrick Reed','Jake Knapp','Corey Conners','Nicolai Hojgaard','Max Homa','Sungjae Im','Alexander Noren'] },
  { team: 'Jumping\' Jupiter TT3', email: 'Brett Torrence', name: 'Brett Torrence', picks: ['Scottie Scheffler','Bryson DeChambeau','Russell Henley','Justin Thomas','Corey Conners','Jacob Bridgeman','Ben Griffin','Keegan Bradley','Marco Penge','Wyndham Clark'] },
  { team: 'Jswartz2', email: 'Joshua Swartz', name: 'Joshua Swartz', picks: ['Jon Rahm','Xander Schauffele','Brooks Koepka','Justin Thomas','Tyrrell Hatton','Sam Burns','Cameron Smith','Max Homa','Wyndham Clark','Dustin Johnson'] },
  { team: 'Masters Disciples', email: 'Jonathan Zalud', name: 'Jonathan Zalud', picks: ['Xander Schauffele','Cameron Young','Robert MacIntyre','Chris Gotterup','Jason Day','J.J. Spaun','Cameron Smith','Gary Woodland','Aaron Rai','Dustin Johnson'] },
  { team: 'Jswartz3', email: 'Joshua Swartz', name: 'Joshua Swartz', picks: ['Ludvig Aberg','Collin Morikawa','Viktor Hovland','Min Woo Lee','Akshay Bhatia','Sepp Straka','Harris English','Aaron Rai','Nick Taylor','Sergio Garcia'] },
  { team: 'Masters Disciples 2', email: 'Jonathan Zalud', name: 'Jonathan Zalud', picks: ['Cameron Young','Matt Fitzpatrick','Brooks Koepka','Chris Gotterup','Tyrrell Hatton','Shane Lowry','Sam Burns','Gary Woodland','Rasmus Hojgaard','Keegan Bradley'] },
  { team: 'Adam Simons 1', email: 'Chris Donovan', name: 'Chris Donovan', picks: ['Scottie Scheffler','Jon Rahm','Hideki Matsuyama','Robert MacIntyre','Akshay Bhatia','Jake Knapp','Shane Lowry','Gary Woodland','Sungjae Im','Keegan Bradley'] },
  { team: 'JSwartz4', email: 'Joshua Swartz', name: 'Joshua Swartz', picks: ['Scottie Scheffler','Jordan Spieth','Patrick Reed','Adam Scott','Shane Lowry','Corey Conners','Daniel Berger','Sungjae Im','Charl Schwartzel','Danny Willett'] },
  { team: 'Masters Disciples 3', email: 'Jonathan Zalud', name: 'Jonathan Zalud', picks: ['Scottie Scheffler','Matt Fitzpatrick','Chris Gotterup','Viktor Hovland','Sam Burns','J.J. Spaun','Jacob Bridgeman','Gary Woodland','Aaron Rai','Dustin Johnson'] },
  { team: 'Driver Off The Deck TT4', email: 'Brett Torrence', name: 'Brett Torrence', picks: ['Ludvig Aberg','Matt Fitzpatrick','Si Woo Kim','Patrick Cantlay','Akshay Bhatia','Shane Lowry','Maverick McNealy','Gary Woodland','Ryan Gerard','Nick Taylor'] },
  { team: 'JSwartz5', email: 'Joshua Swartz', name: 'Joshua Swartz', picks: ['Jon Rahm','Rory McIlroy','Brooks Koepka','Hideki Matsuyama','Jason Day','Sam Burns','Cameron Smith','Brian Harman','Wyndham Clark','Dustin Johnson'] },
  { team: 'Masters Disciples 4', email: 'Jonathan Zalud', name: 'Jonathan Zalud', picks: ['Rory McIlroy','Xander Schauffele','Brooks Koepka','Chris Gotterup','Jake Knapp','Sam Burns','J.J. Spaun','Gary Woodland','Aaron Rai','Brian Harman'] },
  { team: 'Adam Simons 2', email: 'Chris Donovan', name: 'Chris Donovan', picks: ['Jon Rahm','Bryson DeChambeau','Patrick Reed','Min Woo Lee','Akshay Bhatia','Tyrrell Hatton','Jason Day','Max Homa','Sungjae Im','Keegan Bradley'] },
  { team: 'Masters Disciples 5', email: 'Jonathan Zalud', name: 'Jonathan Zalud', picks: ['Bryson DeChambeau','Cameron Young','Chris Gotterup','Viktor Hovland','Jason Day','Jake Knapp','Shane Lowry','Keegan Bradley','Alexander Noren','Aaron Rai'] },
  { team: 'GolfOfAmerica1', email: 'Josh Matthews', name: 'Josh Matthews', picks: ['Rory McIlroy','Matt Fitzpatrick','Russell Henley','Patrick Reed','Sam Burns','Corey Conners','Maverick McNealy','Sungjae Im','Marco Penge','Ryan Gerard'] },
  { team: 'GolfOfAmerica2', email: 'Josh Matthews', name: 'Josh Matthews', picks: ['Scottie Scheffler','Xander Schauffele','Brooks Koepka','Patrick Reed','Akshay Bhatia','Jake Knapp','Sam Burns','Brian Harman','Wyndham Clark','Dustin Johnson'] },
  { team: 'EDJ1', email: 'Elliott DeJarnett', name: 'Elliott DeJarnett', picks: ['Scottie Scheffler','Bryson DeChambeau','Chris Gotterup','Viktor Hovland','Akshay Bhatia','Tyrrell Hatton','Shane Lowry','Gary Woodland','Keegan Bradley','Max Greyserman'] },
  { team: 'GolfOfAmerica3', email: 'Josh Matthews', name: 'Josh Matthews', picks: ['Scottie Scheffler','Jon Rahm','Hideki Matsuyama','Patrick Reed','Akshay Bhatia','Tyrrell Hatton','Nicolai Hojgaard','Brian Harman','Wyndham Clark','Casey Jarvis'] },
  { team: 'EDJ2', email: 'Elliott DeJarnett', name: 'Elliott DeJarnett', picks: ['Rory McIlroy','Cameron Young','Robert MacIntyre','Justin Thomas','Shane Lowry','Nicolai Hojgaard','Cameron Smith','Max Homa','Brian Harman','Dustin Johnson'] },
  { team: 'Olman Pineda', email: 'Chris Donovan', name: 'Chris Donovan', picks: ['Scottie Scheffler','Jon Rahm','Hideki Matsuyama','Robert MacIntyre','Sepp Straka','Nicolai Hojgaard','Jacob Bridgeman','Gary Woodland','Max Homa','Sungjae Im'] },
  { team: 'Kojo0701 1', email: 'Jordan Kordosky', name: 'Jordan Kordosky', picks: ['Scottie Scheffler','Jon Rahm','Robert MacIntyre','Patrick Reed','Akshay Bhatia','J.J. Spaun','Jacob Bridgeman','Gary Woodland','Sungjae Im','Marco Penge'] },
  { team: 'EDJ3', email: 'Elliott DeJarnett', name: 'Elliott DeJarnett', picks: ['Ludvig Aberg','Tommy Fleetwood','Brooks Koepka','Russell Henley','Akshay Bhatia','Sam Burns','J.J. Spaun','Rasmus Hojgaard','Keegan Bradley','Marco Penge'] },
  { team: 'Kojo0701 2', email: 'Jordan Kordosky', name: 'Jordan Kordosky', picks: ['Scottie Scheffler','Bryson DeChambeau','Hideki Matsuyama','Robert MacIntyre','Sepp Straka','Jason Day','J.J. Spaun','Gary Woodland','Sungjae Im','Wyndham Clark'] },
  { team: 'EDJ4', email: 'Elliott DeJarnett', name: 'Elliott DeJarnett', picks: ['Bryson DeChambeau','Xander Schauffele','Hideki Matsuyama','Patrick Reed','Sepp Straka','Maverick McNealy','Harris English','Gary Woodland','Aaron Rai','Andrew Novak'] },
  { team: 'Basha Bekele', email: 'Chris Donovan', name: 'Chris Donovan', picks: ['Rory McIlroy','Xander Schauffele','Patrick Reed','Si Woo Kim','Akshay Bhatia','Shane Lowry','J.J. Spaun','Gary Woodland','Sungjae Im','Marco Penge'] },
  { team: 'Kojo0701 3', email: 'Jordan Kordosky', name: 'Jordan Kordosky', picks: ['Jon Rahm','Bryson DeChambeau','Robert MacIntyre','Patrick Reed','Tyrrell Hatton','Corey Conners','J.J. Spaun','Gary Woodland','Max Homa','Sungjae Im'] },
  { team: 'Kojo0701 4', email: 'Jordan Kordosky', name: 'Jordan Kordosky', picks: ['Bryson DeChambeau','Matt Fitzpatrick','Hideki Matsuyama','Robert MacIntyre','Sepp Straka','Jake Knapp','J.J. Spaun','Gary Woodland','Sungjae Im','Marco Penge'] },
  { team: 'Spiethian Homasexuals', email: 'Dan Deming', name: 'Dan Deming', picks: ['Scottie Scheffler','Rory McIlroy','Robert MacIntyre','Chris Gotterup','Jake Knapp','Corey Conners','Jacob Bridgeman','Max Homa','Rasmus Hojgaard','Ryan Gerard'] },
  { team: 'HowNicoleJonesWentFromMarketingAtDelta', email: 'Chris Donovan', name: 'Chris Donovan', picks: ['Bryson DeChambeau','Ludvig Aberg','Hideki Matsuyama','Chris Gotterup','Tyrrell Hatton','Jake Knapp','Shane Lowry','Gary Woodland','Sungjae Im','Keegan Bradley'] },
  { team: 'Jared Powell', email: 'Jared Powell', name: 'Jared Powell', picks: ['Scottie Scheffler','Ludvig Aberg','Russell Henley','Min Woo Lee','Corey Conners','Nicolai Hojgaard','Cameron Smith','Max Homa','Rasmus Neergaard-Petersen','Mason Howell'] },
  { team: 'Masons Masterpiece', email: 'Bo Mason', name: 'Bo Mason', picks: ['Jon Rahm','Tommy Fleetwood','Chris Gotterup','Si Woo Kim','Sepp Straka','Sam Burns','Nicolai Hojgaard','Rasmus Hojgaard','Brian Harman','Wyndham Clark'] },
  { team: 'EDJ5', email: 'Elliott DeJarnett', name: 'Elliott DeJarnett', picks: ['Scottie Scheffler','Matt Fitzpatrick','Patrick Cantlay','Adam Scott','Jason Day','Jacob Bridgeman','Ben Griffin','Max Homa','Ryan Gerard','Wyndham Clark'] },
  { team: 'Chelsea like telsea', email: 'Matt Chesla', name: 'Matt Chesla', picks: ['Jon Rahm','Bryson DeChambeau','Robert MacIntyre','Patrick Reed','J.J. Spaun','Jacob Bridgeman','Daniel Berger','Marco Penge','Brian Harman','Dustin Johnson'] },
  { team: 'Chelsea like telsea 2', email: 'Matt Chesla', name: 'Matt Chesla', picks: ['Scottie Scheffler','Rory McIlroy','Brooks Koepka','Patrick Cantlay','Sepp Straka','Corey Conners','Cameron Smith','Gary Woodland','Wyndham Clark','Nicolas Echavarria'] },
  { team: 'Ali Khamenei', email: 'Adam Simons', name: 'Adam Simons', picks: ['Bryson DeChambeau','Matt Fitzpatrick','Chris Gotterup','Justin Thomas','Akshay Bhatia','Nicolai Hojgaard','J.J. Spaun','Gary Woodland','Aaron Rai','Sergio Garcia'] },
  { team: 'My Morning Green Jacket', email: 'Kirby Fenton', name: 'Kirby Fenton', picks: ['Bryson DeChambeau','Tommy Fleetwood','Russell Henley','Justin Thomas','Sepp Straka','J.J. Spaun','Harris English','Gary Woodland','Dustin Johnson','Danny Willett'] },
  { team: 'Mojtaba Khamenei', email: 'Adam Simons', name: 'Adam Simons', picks: ['Scottie Scheffler','Tommy Fleetwood','Russell Henley','Viktor Hovland','Sam Burns','Nicolai Hojgaard','Harris English','Keegan Bradley','Brian Harman','Wyndham Clark'] },
  { team: 'Ruhollah Khomeini', email: 'Adam Simons', name: 'Adam Simons', picks: ['Rory McIlroy','Jordan Spieth','Justin Thomas','Patrick Cantlay','Shane Lowry','J.J. Spaun','Kurt Kitayama','Keegan Bradley','Aaron Rai','Tom McKibbin'] },
  { team: 'On The Phone With The President TT5', email: 'Brett Torrence', name: 'Brett Torrence', picks: ['Scottie Scheffler','Xander Schauffele','Brooks Koepka','Hideki Matsuyama','Shane Lowry','Corey Conners','J.J. Spaun','Gary Woodland','Keegan Bradley','Marco Penge'] },
  { team: 'Rocket Dumpling', email: 'Christie Simons', name: 'Christie Simons', picks: ['Scottie Scheffler','Rory McIlroy','Brooks Koepka','Min Woo Lee','Jason Day','Kurt Kitayama','Harris English','Max Homa','Ryan Fox','Dustin Johnson'] },
  { team: 'Horton Smith', email: 'Jason Kotsko', name: 'Jason Kotsko', picks: ['Scottie Scheffler','Ludvig Aberg','Hideki Matsuyama','Min Woo Lee','Sepp Straka','Jake Knapp','Nicolai Hojgaard','Sungjae Im','Nick Taylor','Kristoffer Reitan'] },
  { team: 'Keebs', email: 'Kevin McCrady', name: 'Kevin McCrady', picks: ['Bryson DeChambeau','Xander Schauffele','Chris Gotterup','Patrick Reed','Sepp Straka','Shane Lowry','J.J. Spaun','Gary Woodland','Max Homa','Sungjae Im'] },
  { team: 'Gene Sarazen', email: 'Jason Kotsko', name: 'Jason Kotsko', picks: ['Bryson DeChambeau','Xander Schauffele','Robert MacIntyre','Patrick Reed','Tyrrell Hatton','Sam Burns','Nicolai Hojgaard','Harry Hall','Alexander Noren','Ryan Gerard'] },
  { team: 'Henry Picard', email: 'Jason Kotsko', name: 'Jason Kotsko', picks: ['Scottie Scheffler','Bryson DeChambeau','Brooks Koepka','Viktor Hovland','Sepp Straka','Nicolai Hojgaard','Jacob Bridgeman','Sungjae Im','Kristoffer Reitan','Michael Kim'] },
  { team: 'Putt it into a bunker', email: 'Adam Simons', name: 'Adam Simons', picks: ['Scottie Scheffler','Justin Rose','Viktor Hovland','Justin Thomas','Akshay Bhatia','J.J. Spaun','Daniel Berger','Max Homa','Nick Taylor','Casey Jarvis'] },
  { team: 'Ralph Guldahl', email: 'Jason Kotsko', name: 'Jason Kotsko', picks: ['Scottie Scheffler','Jon Rahm','Hideki Matsuyama','Viktor Hovland','Sepp Straka','Nicolai Hojgaard','Maverick McNealy','Sungjae Im','Nick Taylor','Rasmus Neergaard-Petersen'] },
  { team: 'Jimmy Demaret', email: 'Jason Kotsko', name: 'Jason Kotsko', picks: ['Ludvig Aberg','Jordan Spieth','Viktor Hovland','Si Woo Kim','Sepp Straka','Jake Knapp','Nicolai Hojgaard','Rasmus Hojgaard','Max Greyserman','Kristoffer Reitan'] },
  { team: 'CurtStark1', email: 'Curt Stark', name: 'Curt Stark', picks: ['Scottie Scheffler','Tommy Fleetwood','Robert MacIntyre','Viktor Hovland','Akshay Bhatia','Shane Lowry','J.J. Spaun','Sungjae Im','Marco Penge','Aaron Rai'] },
  { team: 'CurtStark2', email: 'Curt Stark', name: 'Curt Stark', picks: ['Bryson DeChambeau','Ludvig Aberg','Russell Henley','Justin Thomas','Tyrrell Hatton','Sam Burns','Corey Conners','Rasmus Hojgaard','Marco Penge','Alexander Noren'] },
  { team: 'Kojo0701 5', email: 'Jordan Kordosky', name: 'Jordan Kordosky', picks: ['Ludvig Aberg','Tommy Fleetwood','Robert MacIntyre','Chris Gotterup','Akshay Bhatia','Jacob Bridgeman','Maverick McNealy','Gary Woodland','Sungjae Im','Brian Harman'] },
  { team: 'Macon Money', email: 'Wade Bennett', name: 'Wade Bennett', picks: ['Jon Rahm','Bryson DeChambeau','Chris Gotterup','Min Woo Lee','Sepp Straka','Jake Knapp','Jacob Bridgeman','Gary Woodland','Brian Harman','Wyndham Clark'] },
  { team: 'Macon more money', email: 'Wade Bennett', name: 'Wade Bennett', picks: ['Scottie Scheffler','Bryson DeChambeau','Brooks Koepka','Russell Henley','Akshay Bhatia','Tyrrell Hatton','Cameron Smith','Gary Woodland','Sungjae Im','Keegan Bradley'] },
  { team: 'Something Clever', email: 'Matthew Weeks', name: 'Matthew Weeks', picks: ['Cameron Young','Collin Morikawa','Hideki Matsuyama','Robert MacIntyre','Akshay Bhatia','Jake Knapp','Corey Conners','Gary Woodland','Sungjae Im','Brian Harman'] },
  { team: 'East Pole Masters Pool #2', email: 'Matthew Weeks', name: 'Matthew Weeks', picks: ['Scottie Scheffler','Xander Schauffele','Robert MacIntyre','Russell Henley','Sepp Straka','Shane Lowry','Sam Burns','Max Homa','Keegan Bradley','Alexander Noren'] },
  { team: 'Fleetwood Mac', email: 'Harrison DJ', name: 'Harrison DJ', picks: ['Xander Schauffele','Tommy Fleetwood','Hideki Matsuyama','Patrick Reed','Akshay Bhatia','Shane Lowry','Nicolai Hojgaard','Sungjae Im','Brian Harman','Dustin Johnson'] },
  { team: 'RAHMstein', email: 'Harrison DJ', name: 'Harrison DJ', picks: ['Scottie Scheffler','Jon Rahm','Robert MacIntyre','Justin Thomas','Jason Day','Harris English','Daniel Berger','Gary Woodland','Keegan Bradley','Aaron Rai'] },
  { team: 'Guns and ROSE', email: 'Harrison DJ', name: 'Harrison DJ', picks: ['Rory McIlroy','Justin Rose','Russell Henley','Patrick Cantlay','Sepp Straka','Tyrrell Hatton','Corey Conners','Sungjae Im','Alexander Noren','Brian Harman'] },
  { team: 'RAI Charles', email: 'Harrison DJ', name: 'Harrison DJ', picks: ['Scottie Scheffler','Bryson DeChambeau','Hideki Matsuyama','Patrick Reed','Shane Lowry','J.J. Spaun','Ben Griffin','Gary Woodland','Sungjae Im','Aaron Rai'] },
  { team: 'R. E. IM.', email: 'Harrison DJ', name: 'Harrison DJ', picks: ['Bryson DeChambeau','Xander Schauffele','Viktor Hovland','Min Woo Lee','Jason Day','Sam Burns','Corey Conners','Sungjae Im','Nick Taylor','Wyndham Clark'] },
  { team: 'This is Golf!', email: 'Mike Deming', name: 'Mike Deming', picks: ['Bryson DeChambeau','Ludvig Aberg','Brooks Koepka','Patrick Reed','Jake Knapp','Shane Lowry','Sam Burns','Gary Woodland','Max Homa','Sungjae Im'] },
  { team: 'Mosswoods21', email: 'Austen Kordosky', name: 'Austen Kordosky', picks: ['Bryson DeChambeau','Xander Schauffele','Robert MacIntyre','Patrick Reed','Akshay Bhatia','Tyrrell Hatton','Shane Lowry','Gary Woodland','Sam Stevens','Ryan Fox'] },
  { team: 'Mosswoods22', email: 'Austen Kordosky', name: 'Austen Kordosky', picks: ['Scottie Scheffler','Ludvig Aberg','Hideki Matsuyama','Min Woo Lee','Jake Knapp','Shane Lowry','Jacob Bridgeman','Gary Woodland','Sungjae Im','Marco Penge'] },
  { team: 'mosswoods23', email: 'Austen Kordosky', name: 'Austen Kordosky', picks: ['Scottie Scheffler','Jon Rahm','Patrick Reed','Viktor Hovland','Akshay Bhatia','Tyrrell Hatton','Corey Conners','Keegan Bradley','Ryan Fox','Wyndham Clark'] },
  { team: 'mosswoods24', email: 'Austen Kordosky', name: 'Austen Kordosky', picks: ['Ludvig Aberg','Xander Schauffele','Hideki Matsuyama','Robert MacIntyre','Akshay Bhatia','Shane Lowry','Jacob Bridgeman','Max Homa','Sungjae Im','Marco Penge'] },
  { team: 'mosswoods25', email: 'Austen Kordosky', name: 'Austen Kordosky', picks: ['Scottie Scheffler','Tommy Fleetwood','Patrick Reed','Min Woo Lee','Jake Knapp','Nicolai Hojgaard','J.J. Spaun','Max Homa','Sungjae Im','Ryan Gerard'] },
  { team: 'Where There\'s a Will…', email: 'Will McKenzie', name: 'Will McKenzie', picks: ['Scottie Scheffler','Tommy Fleetwood','Brooks Koepka','Russell Henley','Akshay Bhatia','Nicolai Hojgaard','Cameron Smith','Max Homa','Sergio Garcia','Bubba Watson'] },
  { team: 'Where There\'s a Will…#2', email: 'Will McKenzie', name: 'Will McKenzie', picks: ['Bryson DeChambeau','Xander Schauffele','Viktor Hovland','Patrick Cantlay','Jason Day','Shane Lowry','Corey Conners','Sungjae Im','Brian Harman','Wyndham Clark'] },
  { team: 'Jackmerius Tacktheratrix', email: 'James Torell', name: 'James Torell', picks: ['Scottie Scheffler','Bryson DeChambeau','Brooks Koepka','Patrick Reed','Akshay Bhatia','Sepp Straka','Shane Lowry','Sungjae Im','Wyndham Clark','Sergio Garcia'] },
  { team: 'CFreddie\'s Entry', email: 'Chris Frederick', name: 'Chris Frederick', picks: ['Jon Rahm','Bryson DeChambeau','Russell Henley','Patrick Reed','Akshay Bhatia','Jason Day','Shane Lowry','Gary Woodland','Sungjae Im','Nick Taylor'] },
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
  'Johnny Keefer':'John Keefer',
  'Alexander Noren':'Alex Noren',
  'Matthew McCarty':'Matt McCarty',
  'Sam Stevens':'Samuel Stevens',
  'Sung-Jae Im':'Sungjae Im',
  'Nico Echavarria':'Nicolas Echavarria',
  'Pongsapak Laopakdee':'Fifa Laopakdee'
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
var COURSE_PAR = 72; // Augusta National — par 72 [4,5,4,3,4,3,4,5,4,4,4,3,5,4,5,3,4,4]

var WINNING_SCORE = null; // actual tournament winner's score to par (set when tourney final)
var TOURNEY_FINAL = false; // true when all 4 rounds complete, 0 holes left

// Live probability predictions (keyed by canonical player name)
var DG_LIVE_PREDS = {};
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
var FINAL_ROUND_POPUP_KEY = 'eastpole_final_round_popup_v2_seen';
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
