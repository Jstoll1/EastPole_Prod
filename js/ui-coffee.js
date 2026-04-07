// ── Coffee View: Shopify products, gallery, sponsor chip ──

var _coffeeInit = false;

// Curated cafe gallery — additional URLs can be appended here as East Pole publishes them.
// Falls back to Shopify product images if list is short.
var COFFEE_GALLERY = [
  'https://eastpole.coffee/cdn/shop/files/eastpole-gv-armouryards-67_2048x2048.jpg?v=1693404725',
  'https://eastpole.coffee/cdn/shop/articles/IMG_7365_2_900x.jpg?v=1691674657',
  'https://eastpole.coffee/cdn/shop/articles/East_Pole_-_Poncey_900x.jpg?v=1673465270'
];

// Press logos: { name, url }. Add real entries when you have them.
var COFFEE_PRESS = [
  { name: 'Eater Atlanta', url: 'https://atlanta.eater.com' },
  { name: 'Atlanta Magazine', url: 'https://www.atlantamagazine.com' },
  { name: 'Sprudge', url: 'https://sprudge.com' },
  { name: 'AJC', url: 'https://www.ajc.com' }
];

function initCoffeeView() {
  if (_coffeeInit) return;
  _coffeeInit = true;
  loadShopifyProducts();
  renderCoffeeGallery();
  renderCoffeePress();
}

async function loadShopifyProducts() {
  var grid = document.getElementById('coffee-products-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="coffee-products-loading">Loading fresh roasts…</div>';
  try {
    var res = await fetch('https://eastpole.coffee/products.json?limit=12');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var products = (data.products || []).filter(function(p) {
      return p.images && p.images.length && p.variants && p.variants.length;
    });
    if (!products.length) { grid.innerHTML = ''; return; }
    // Pick up to 6 with images
    products = products.slice(0, 6);
    grid.innerHTML = products.map(function(p) {
      var img = p.images[0].src;
      var price = p.variants[0].price;
      var url = 'https://eastpole.coffee/products/' + p.handle;
      return '<a class="coffee-product-card" href="' + url + '" target="_blank" rel="noopener">'
        + '<div class="coffee-product-img"><img src="' + img + '" alt="' + escapeHtml(p.title) + '" loading="lazy"></div>'
        + '<div class="coffee-product-title">' + escapeHtml(p.title) + '</div>'
        + '<div class="coffee-product-price">$' + parseFloat(price).toFixed(2) + '</div>'
        + '</a>';
    }).join('');
    // If gallery is sparse, sprinkle a couple product images into it
    if (COFFEE_GALLERY.length < 4) {
      products.slice(0, 4 - COFFEE_GALLERY.length).forEach(function(p) {
        if (p.images[0] && p.images[0].src) COFFEE_GALLERY.push(p.images[0].src);
      });
      renderCoffeeGallery();
    }
  } catch(e) {
    console.warn('Shopify products fetch failed:', e.message);
    grid.innerHTML = '<div class="coffee-products-loading">Couldn\'t load products. <a href="https://eastpole.coffee/collections/coffee" target="_blank" rel="noopener">Shop direct →</a></div>';
  }
}

function renderCoffeeGallery() {
  var track = document.getElementById('coffee-gallery-track');
  if (!track) return;
  if (!COFFEE_GALLERY.length) { track.innerHTML = ''; return; }
  track.innerHTML = COFFEE_GALLERY.map(function(src, i) {
    return '<div class="coffee-gallery-slide"><img src="' + src + '" alt="East Pole Coffee #' + (i + 1) + '" loading="lazy"></div>';
  }).join('');
}

function renderCoffeePress() {
  var row = document.getElementById('coffee-press-row');
  if (!row) return;
  row.innerHTML = COFFEE_PRESS.map(function(p) {
    return '<a class="coffee-press-chip" href="' + p.url + '" target="_blank" rel="noopener">' + escapeHtml(p.name) + '</a>';
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
