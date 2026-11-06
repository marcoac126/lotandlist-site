// Visit and link-click counter for Lot & List, sending to GoatCounter (goatcounter.com).
// Our own small script (no outside code). No cookies, no screen size, no IDs.
// Sends only: page path, page title, referring page, and for link clicks the store's domain plus the page it was clicked on.
// Never sends anything typed into the calculators (those stay in the browser).
// Opt-out: LotCount.setOff(true) stores "skipgc" in this browser (also honored by GoatCounter's own tools).
(function () {
  var ENDPOINT = 'https://lotandlist.goatcounter.com/count';
  var enc = encodeURIComponent;
  function isOff() { try { return localStorage.getItem('skipgc') === 't'; } catch (e) { return false; } }
  function setOff(off) { try { if (off) localStorage.setItem('skipgc', 't'); else localStorage.removeItem('skipgc'); } catch (e) {} }
  window.LotCount = { isOff: isOff, setOff: setOff };

  if (location.hostname !== 'lotandlist.com' || navigator.webdriver || isOff()) return;

  function send(path, title, referrer, event) {
    if (isOff()) return;
    var url = ENDPOINT + '?p=' + enc(path) + '&t=' + enc(title) + '&r=' + enc(referrer || '') +
      (event ? '&e=true' : '') + '&rnd=' + Math.random().toString(36).slice(2, 7);
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) {}
    var img = new Image(); img.src = url;
  }

  // Page visit (once the page is actually visible).
  function visit() { send(location.pathname + location.search, document.title, document.referrer, false); }
  if (document.visibilityState === 'hidden') {
    var once = function () { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', once); visit(); } };
    document.addEventListener('visibilitychange', once);
  } else visit();

  // Outbound link clicks: "out: etsy.com", titled with the page it came from.
  function onClick(ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (e) { return; }
    if (!/^https?:$/.test(u.protocol) || u.hostname === location.hostname) return;
    var host = u.hostname.replace(/^www\./, '');
    send('out: ' + host, host + ' from ' + location.pathname, '', true);
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', function (ev) { if (ev.button === 1) onClick(ev); }, true);
})();
