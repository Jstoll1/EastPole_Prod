// ─── Native Pool Entry Form ────────────────────────────────────
// Replaces the embedded Google Form iframe with an in-app tiered picker.
// Submits via Google Forms formResponse endpoint (no-cors POST) so
// responses still land in the existing sheet.

var POOL_ENTRY_CONFIG = {
  eventName: 'Zurich Classic of New Orleans',
  subtitle: 'Select 2 teams from each of the 4 tiers (8 picks total)',
  formAction: 'https://docs.google.com/forms/d/e/1FAIpQLSdb81xBTFvU2EvNqNlctTAWfP2cmh8gyypLQyfyW25WAs1p_g/formResponse',
  fields: {
    email: 'emailAddress',
    entryName: 'entry.1263544329',
    tier1: 'entry.1319784930',
    tier2: 'entry.1885727326',
    tier3: 'entry.1111188814',
    tier4: 'entry.958388114',
    tieBreaker: 'entry.725955178'
  },
  tiers: [
    {
      name: 'Tier 1 · Favorites',
      desc: '34.1% – 59.3% TOP 20 probability',
      picks: 2,
      fieldKey: 'tier1',
      teams: [
        '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Matt Fitzpatrick / 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Alex Fitzpatrick',
        '🇺🇸 Ryan Gerard / David Ford',
        '🇮🇪 Shane Lowry / 🇺🇸 Brooks Koepka',
        '🇺🇸 Andrew Novak / 🇺🇸 Ben Griffin',
        '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Aaron Rai / 🇺🇸 Sahith Theegala',
        '🇺🇸 Michael Brennan / 🇺🇸 Johnny Keefer',
        '🇨🇳 Haotong Li / 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Jordan Smith',
        '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Matt Wallace / 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Marco Penge',
        '🇦🇺 Karl Vilips / 🇺🇸 Michael Thorbjornsen',
        '🇺🇸 Taylor Moore / 🇺🇸 Wyndham Clark',
        '🇺🇸 Mac Meissner / 🇺🇸 Matt McCarty',
        '🇺🇸 Austin Eckroat / 🇺🇸 Davis Thompson',
        '🇺🇸 Zach Bauchou / 🇺🇸 Sam Stevens',
        'Kris Ventura / Kristoffer Reitan',
        '🇨🇦 Mackenzie Hughes / 🇨🇦 Taylor Pendrith',
        '🇺🇸 Kevin Roy / 🇺🇸 Max McGreevy',
        '🇺🇸 Alex Smalley / 🇺🇸 Hayden Springer',
        'Kevin Yu / 🇰🇷 Tom Kim',
        '🇺🇸 Tony Finau / 🇺🇸 Max Greyserman'
      ]
    },
    {
      name: 'Tier 2 · Contenders',
      desc: '26.2% – 34.1% TOP 20 probability',
      picks: 2,
      fieldKey: 'tier2',
      teams: [
        '🇺🇸 David Lipsky / 🇺🇸 Rico Hoey',
        '🇺🇸 Andrew Putnam / 🇺🇸 Austin Smotherman',
        '🇨🇦 A.J. Ewart / 🇿🇦 Casey Jarvis',
        '🇮🇪 Seamus Power / 🇩🇪 Matti Schmid',
        '🏴󠁧󠁢󠁥󠁮󠁧󠁿 John Parry / 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Dan Brown',
        '🇯🇵 Takumi Kanaya / 🇺🇸 William Mouw',
        '🇺🇸 Blades Brown / 🇺🇸 Luke Clanton',
        '🇩🇰 Rasmus Neergaard-Petersen / 🇩🇰 Jacob Skov Olesen',
        '🇺🇸 Brandt Snedeker / 🇺🇸 Keith Mitchell',
        '🇨🇳 Zecheng Dou / Dylan Wu',
        '🇺🇸 Chandler Blanchet / 🇺🇸 John VanDerLaan',
        'Pontus Nyholm / 🇸🇪 Jesper Svensson',
        '🇩🇪 Stephan Jaeger / 🇺🇸 Jackson Suber',
        '🇺🇸 Beau Hossler / 🇺🇸 Sam Ryder',
        '🇺🇸 Eric Cole / 🇺🇸 Hank Lebioda',
        '🇧🇪 Adrien Dumont de Chassart / Davis Chatfield',
        '🇿🇦 Erik van Rooyen / 🇿🇦 Christiaan Bezuidenhout',
        '🇺🇸 Billy Horschel / 🇺🇸 Tom Hoge'
      ]
    },
    {
      name: 'Tier 3 · Midfield',
      desc: '18.6% – 24.8% TOP 20 probability',
      picks: 2,
      fieldKey: 'tier3',
      teams: [
        '🇿🇦 Christo Lamprecht / 🇺🇸 Neal Shipley',
        '🇺🇸 Greyson Sigg / 🇺🇸 Vince Whaley',
        '🇨🇦 Adam Hadwin / 🇨🇦 Adam Svensson',
        '🇺🇸 Jeffrey Kang / 🇺🇸 Doug Ghim',
        '🇺🇸 Justin Lower / 🇺🇸 Chad Ramey',
        '🇺🇸 Chris Kirk / 🇺🇸 Patton Kizzire',
        '🇺🇸 Zac Blair / 🇺🇸 Patrick Fishburn',
        '🇫🇷 Matthieu Pavon / 🇫🇷 Martin Couvra',
        '🇺🇸 Kevin Streelman / 🇺🇸 Joel Dahmen',
        '🇨🇦 Ben Silverman / 🇺🇸 Cameron Champ',
        '🇺🇸 Carson Young / 🇺🇸 Chandler Phillips',
        '🏴󠁧󠁢󠁥󠁮󠁧󠁿 David Skinns / 🇺🇸 Trey Mullinax',
        '🇺🇸 Matt Kuchar / 🇿🇦 Garrick Higgo',
        '🇺🇸 Jimmy Stanger / 🇺🇸 Danny Walker',
        '🇺🇸 Lanto Griffin / 🇺🇸 Ben Kohles',
        '🇯🇵 Kensei Hirata / 🇯🇵 Keita Nakajima',
        '🇺🇸 Tyler Duncan / 🇺🇸 Adam Schenk',
        '🇺🇸 Brice Garnett / 🇺🇸 Lee Hodges'
      ]
    },
    {
      name: 'Tier 4 · Longshots',
      desc: '4.8% – 18.3% TOP 20 probability',
      picks: 2,
      fieldKey: 'tier4',
      teams: [
        '🇺🇸 Ben Martin / Trace Crowe',
        '🇺🇸 Nick Dunlap / 🇺🇸 Gordon Sargent',
        '🇺🇸 Ryan Brehm / 🇺🇸 Mark Hubbard',
        '🇺🇸 Nick Hardy / 🇺🇸 Davis Riley',
        '🇺🇸 Harry Higgs / 🇩🇪 Jeremy Paul',
        '🇺🇸 Luke List / 🇸🇪 Henrik Norlander',
        '🇵🇷 Rafael Campos / 🇦🇷 Alejandro Tosti',
        '🇺🇸 Frankie Capan III / 🇺🇸 Noah Goodwin',
        '🇺🇸 Charley Hoffman / 🇺🇸 Nick Watney',
        '🇺🇸 Paul Peterson / 🇺🇸 Will Gordon',
        '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Russell Knox / 🇺🇸 Peter Malnati',
        '🇺🇸 Ryan Palmer / 🇰🇷 Chan Kim',
        '🇺🇸 Scott Piercy / 🇺🇸 Taylor Montgomery',
        '🇨🇴 Camilo Villegas / 🇨🇴 Marcelo Rozo',
        '🇺🇸 Jonathan Byrd / 🇺🇸 Chez Reavie',
        '🇺🇸 Troy Merritt / 🇺🇸 Robert Streb',
        '🇦🇺 Geoff Ogilvy / 🇦🇺 Cam Davis',
        '🇺🇸 Jason Dufner / 🇺🇸 Austin Cook'
      ]
    }
  ]
};

function _efEscape(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function buildEntryFormHTML() {
  var cfg = POOL_ENTRY_CONFIG;
  var h = '<form id="ef-form" class="ef-form" onsubmit="return submitEntryForm(event)">';
  h += '<div class="ef-intro">' + _efEscape(cfg.subtitle) + '. Tiers are ordered by DataGolf TOP 20 probability — Tier 1 favorites, Tier 4 longshots.</div>';
  h += '<div class="ef-field"><label>Email <span class="ef-req">*</span></label>'
    +  '<input type="email" name="email" required placeholder="you@example.com" oninput="validateEntryForm()"></div>';
  h += '<div class="ef-field"><label>Entry Name <span class="ef-req">*</span></label>'
    +  '<input type="text" name="entryName" required maxlength="60" placeholder="e.g. Jake - Entry 1" oninput="validateEntryForm()"></div>';

  cfg.tiers.forEach(function(tier, i) {
    h += '<div class="ef-tier">';
    h += '<div class="ef-tier-hdr">'
      +    '<span class="ef-tier-name">' + _efEscape(tier.name) + '</span>'
      +    '<span class="ef-tier-count" id="ef-tc-' + i + '">0 / ' + tier.picks + '</span>'
      +  '</div>';
    h += '<div class="ef-tier-desc">' + _efEscape(tier.desc) + ' · Pick exactly ' + tier.picks + '</div>';
    h += '<div class="ef-team-list">';
    tier.teams.forEach(function(team, ti) {
      var id = 'ef-t' + i + '-' + ti;
      h += '<label class="ef-team-card" for="' + id + '">'
        +    '<input type="checkbox" id="' + id + '" name="tier_' + i + '" value="' + _efEscape(team) + '" onchange="onTierChange(' + i + ')">'
        +    '<span class="ef-team-txt">' + _efEscape(team) + '</span>'
        +  '</label>';
    });
    h += '</div></div>';
  });

  h += '<div class="ef-field"><label>Tiebreaker <span class="ef-req">*</span></label>'
    +  '<div class="ef-field-hint">Winning team\'s 72-hole score (e.g. -24)</div>'
    +  '<input type="text" name="tieBreaker" required placeholder="-24" oninput="validateEntryForm()"></div>';

  h += '<button type="submit" class="ef-submit" id="ef-submit" disabled>Submit Entry</button>';
  h += '<div class="ef-validation" id="ef-validation"></div>';
  h += '</form>';
  return h;
}

function onTierChange(tierIdx) {
  var tier = POOL_ENTRY_CONFIG.tiers[tierIdx];
  var form = document.getElementById('ef-form');
  if (!form) return;
  var checked = form.querySelectorAll('input[name="tier_' + tierIdx + '"]:checked');
  var countEl = document.getElementById('ef-tc-' + tierIdx);
  if (countEl) {
    countEl.textContent = checked.length + ' / ' + tier.picks;
    countEl.classList.toggle('ef-good', checked.length === tier.picks);
    countEl.classList.toggle('ef-over', checked.length > tier.picks);
  }
  // Disable remaining checkboxes in this tier when at limit
  var all = form.querySelectorAll('input[name="tier_' + tierIdx + '"]');
  all.forEach(function(cb) {
    cb.disabled = !cb.checked && checked.length >= tier.picks;
    cb.closest('.ef-team-card').classList.toggle('ef-disabled', cb.disabled);
    cb.closest('.ef-team-card').classList.toggle('ef-selected', cb.checked);
  });
  validateEntryForm();
}

function validateEntryForm() {
  var form = document.getElementById('ef-form');
  var btn = document.getElementById('ef-submit');
  var valEl = document.getElementById('ef-validation');
  if (!form || !btn) return;
  var issues = [];
  if (!form.email.value.trim()) issues.push('Email required');
  if (!form.entryName.value.trim()) issues.push('Entry name required');
  POOL_ENTRY_CONFIG.tiers.forEach(function(tier, i) {
    var n = form.querySelectorAll('input[name="tier_' + i + '"]:checked').length;
    if (n !== tier.picks) issues.push(tier.name.split(' · ')[0] + ' needs ' + tier.picks + ' picks (have ' + n + ')');
  });
  if (!form.tieBreaker.value.trim()) issues.push('Tiebreaker required');
  btn.disabled = issues.length > 0;
  if (valEl) valEl.textContent = issues.length ? issues[0] : '';
}

function submitEntryForm(ev) {
  ev.preventDefault();
  var form = document.getElementById('ef-form');
  var btn = document.getElementById('ef-submit');
  if (!form || !btn) return false;
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  var cfg = POOL_ENTRY_CONFIG;
  var fd = new FormData();
  fd.append(cfg.fields.email, form.email.value.trim());
  fd.append(cfg.fields.entryName, form.entryName.value.trim());
  fd.append(cfg.fields.tieBreaker, form.tieBreaker.value.trim());
  cfg.tiers.forEach(function(tier, i) {
    var checked = form.querySelectorAll('input[name="tier_' + i + '"]:checked');
    checked.forEach(function(cb) {
      fd.append(cfg.fields[tier.fieldKey], cb.value);
    });
  });

  // no-cors so the browser doesn't reject the cross-origin Google Forms POST
  fetch(cfg.formAction, { method: 'POST', body: fd, mode: 'no-cors' })
    .then(function() { showEntrySuccess(form.entryName.value.trim()); })
    .catch(function(e) {
      btn.disabled = false;
      btn.textContent = 'Submit Entry';
      var valEl = document.getElementById('ef-validation');
      if (valEl) valEl.textContent = 'Submission failed: ' + e.message;
    });
  return false;
}

function showEntrySuccess(entryName) {
  var container = document.getElementById('entry-form-container');
  if (!container) return;
  container.innerHTML =
    '<div class="ef-success">'
    + '<div class="ef-success-mark">✓</div>'
    + '<div class="ef-success-title">Entry Submitted</div>'
    + '<div class="ef-success-sub">' + _efEscape(entryName) + ' is locked in.</div>'
    + '<div class="ef-success-note">It may take a few minutes to appear in the pool.</div>'
    + '<button onclick="closeAddEntry()" class="ef-submit ef-submit-done">Done</button>'
    + '</div>';
}

function openAddEntry() {
  var el = document.getElementById('addentry-overlay');
  var bd = document.getElementById('addentry-backdrop');
  if (!el) return;
  // Populate / reset the container on each open
  var container = document.getElementById('entry-form-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'entry-form-container';
    // Replace any existing iframe with the form container
    var existing = el.querySelector('iframe');
    if (existing) existing.parentNode.replaceChild(container, existing);
    else el.appendChild(container);
  }
  container.innerHTML = buildEntryFormHTML();
  el.classList.add('open');
  if (bd) bd.classList.add('open');
  if (typeof trackEvent === 'function') trackEvent('add-entry-open');
}

function closeAddEntry() {
  var el = document.getElementById('addentry-overlay');
  var bd = document.getElementById('addentry-backdrop');
  if (el) el.classList.remove('open');
  if (bd) bd.classList.remove('open');
}
