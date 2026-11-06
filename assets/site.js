/* Lot & List calculators. Everything runs in the browser; nothing is sent anywhere. */
(function () {
  "use strict";

  // Optional: set to the Etsy shop URL once the shop is live. Empty hides the template promo.
  var ETSY_SHOP_URL = "https://www.etsy.com/shop/LotAndListShop";

  // US standard-account seller fees, checked 2026-10-01 (Underpriced reseller fee tracker).
  // Same model as the Lot & List spreadsheets.
  var FEES_CHECKED = "Oct 1, 2026";
  var PLATFORMS = [
    { id: "ebay", name: "eBay", pct: 0.136, onShip: true, fixed: 0.40, smallUnder: 10, smallFixed: 0.30, note: "13.6% of order total (most categories) + $0.40 per order ($0.30 if $10 or less)" },
    { id: "poshmark", name: "Poshmark", pct: 0.20, onShip: false, fixed: 0, flatUnder: 15, flat: 2.95, note: "$2.95 flat under $15; 20% at $15 and up. Buyer pays shipping to Poshmark", noShip: true },
    { id: "mercari", name: "Mercari", pct: 0.10, onShip: true, fixed: 0, note: "10% of item price and buyer-paid shipping" },
    { id: "depop", name: "Depop", pct: 0.033, onShip: true, fixed: 0.45, note: "US: no selling fee; payment processing 3.3% + $0.45" },
    { id: "fbship", name: "Facebook (shipped)", pct: 0.10, onShip: true, fixed: 0, minFee: 0.80, note: "10% of order total, $0.80 minimum" },
    { id: "fblocal", name: "Facebook (local)", pct: 0, onShip: false, fixed: 0, note: "No fee for local pickup", local: true },
    { id: "etsy", name: "Etsy", pct: 0.095, onShip: true, fixed: 0.45, note: "6.5% transaction + 3% processing + $0.25, plus $0.20 listing. Vintage, handmade, or craft supplies only" }
  ];

  function feeFor(p, price, shipIn) {
    if (!(price > 0)) return 0;
    var ship = p.local || p.noShip ? 0 : shipIn;
    if (p.flatUnder && price < p.flatUnder) return p.flat;
    var fee = p.pct * (price + (p.onShip ? ship : 0));
    fee += p.smallUnder && price + ship <= p.smallUnder ? p.smallFixed : p.fixed;
    if (p.minFee) fee = Math.max(fee, p.minFee);
    return fee;
  }

  // Profit for one sale. Local pickup and Poshmark ignore shipping (no label paid by seller).
  function profitFor(p, price, cost, shipIn, shipOut, other) {
    var sIn = p.local || p.noShip ? 0 : shipIn;
    var sOut = p.local || p.noShip ? 0 : shipOut;
    return price + sIn - feeFor(p, price, shipIn) - sOut - other - cost;
  }

  function ceilCents(x) { return Math.ceil(x * 100 - 1e-7) / 100; }

  // Smallest price (to the cent) that reaches the target profit. Profit is linear within each fee
  // branch, so the answer is either a branch's own solution or the start of a branch.
  function priceForTarget(p, target, cost, shipIn, shipOut, other) {
    var sIn = p.local || p.noShip ? 0 : shipIn;
    var sOut = p.local || p.noShip ? 0 : shipOut;
    var feeShip = p.onShip ? sIn : 0;
    var k = cost + sOut + other - sIn;
    var c = [0.01];
    var fixes = [p.fixed || 0];
    if (p.smallUnder) fixes.push(p.smallFixed);
    if (p.pct < 1) fixes.forEach(function (fx) { c.push((target + k + p.pct * feeShip + fx) / (1 - p.pct)); });
    if (p.flatUnder) { c.push(target + k + p.flat); c.push(p.flatUnder); }
    if (p.minFee) c.push(target + k + p.minFee);
    if (p.smallUnder) { c.push(p.smallUnder - sIn); c.push(p.smallUnder - sIn + 0.01); }
    var best = null;
    c.forEach(function (x) {
      if (!isFinite(x) || x <= 0) return;
      [ceilCents(x), ceilCents(x) + 0.01].forEach(function (cand) {
        cand = Math.round(cand * 100) / 100;
        if (profitFor(p, cand, cost, shipIn, shipOut, other) >= target - 1e-9 && (best === null || cand < best)) best = cand;
      });
    });
    return best;
  }

  // ---------- helpers
  var money = function (n) {
    if (n === null || n === undefined || isNaN(n)) return "–";
    var s = "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < -0.004 ? "−" + s : s;
  };
  var num = function (el) { var v = parseFloat(String(el.value).replace(/[$,\s]/g, "")); return isFinite(v) ? v : 0; };
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem("rl." + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem("rl." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (a) { e.setAttribute(a, attrs[a]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function remember(ids, key) {
    var saved = store.get(key) || {};
    ids.forEach(function (id) {
      var input = $(id);
      if (saved[id] !== undefined && saved[id] !== null) input.value = saved[id];
      input.addEventListener("input", function () {
        var all = store.get(key) || {};
        all[id] = input.value;
        store.set(key, all);
      });
    });
  }
  function copyText(btn, text) {
    function done(msg) { var old = btn.textContent; btn.textContent = msg; setTimeout(function () { btn.textContent = old; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done("Copied"); }, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = el("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done("Copied"); } catch (e) { done("Select and copy"); }
      document.body.removeChild(ta);
    }
  }

  // ---------- fee comparison
  function initCompare() {
    var ids = ["price", "cost", "shipIn", "shipOut", "other"];
    remember(ids, "compare");
    var body = $("cmp-body");
    function render() {
      var price = num($("price")), cost = num($("cost")), shipIn = num($("shipIn")), shipOut = num($("shipOut")), other = num($("other"));
      var rows = PLATFORMS.map(function (p) {
        var fee = feeFor(p, price, shipIn);
        var prof = profitFor(p, price, cost, shipIn, shipOut, other);
        return { p: p, fee: fee, prof: prof, roi: cost > 0 ? prof / cost : null };
      }).sort(function (a, b) { return b.prof - a.prof; });
      body.textContent = "";
      rows.forEach(function (r, i) {
        var tr = el("tr");
        var name = el("th", { scope: "row" });
        name.appendChild(el("span", null, r.p.name));
        if (i === 0 && price > 0) name.appendChild(el("span", { class: "pill" }, "Most profit"));
        name.appendChild(el("small", null, r.p.note));
        tr.appendChild(name);
        tr.appendChild(el("td", { class: "num" }, money(r.fee)));
        var pc = el("td", { class: "num strong" + (r.prof < 0 ? " loss" : "") }, money(r.prof));
        tr.appendChild(pc);
        tr.appendChild(el("td", { class: "num" }, r.roi === null ? "–" : Math.round(r.roi * 100) + "%"));
        body.appendChild(tr);
      });
      var best = rows[0];
      $("cmp-summary").textContent = price > 0
        ? best.p.name + " keeps the most: " + money(best.prof) + " profit on a " + money(price) + " sale."
        : "Type a sale price to compare.";
    }
    ids.forEach(function (id) { $(id).addEventListener("input", render); });
    render();
  }

  // ---------- list price calculator
  function initListPrice() {
    var ids = ["lp-cost", "lp-target", "lp-shipIn", "lp-shipOut", "lp-other", "lp-offer"];
    remember(ids, "listprice");
    var sel = $("lp-platform");
    PLATFORMS.forEach(function (p) { sel.appendChild(el("option", { value: p.id }, p.name)); });
    var savedP = store.get("listprice.platform");
    if (savedP) sel.value = savedP;
    sel.addEventListener("change", function () { store.set("listprice.platform", sel.value); render(); });
    var body = $("lp-body");
    function render() {
      var cost = num($("lp-cost")), target = num($("lp-target")), shipIn = num($("lp-shipIn")), shipOut = num($("lp-shipOut")),
        other = num($("lp-other")), offer = Math.min(Math.max(num($("lp-offer")), 0), 90) / 100;
      var results = PLATFORMS.map(function (p) {
        var min = priceForTarget(p, target, cost, shipIn, shipOut, other);
        var list = min === null ? null : Math.ceil(min / (1 - offer) - 1e-7);
        return { p: p, min: min, list: list, fee: min === null ? null : feeFor(p, min, shipIn) };
      });
      body.textContent = "";
      results.forEach(function (r) {
        var tr = el("tr");
        var th = el("th", { scope: "row" });
        th.appendChild(el("span", null, r.p.name));
        tr.appendChild(th);
        tr.appendChild(el("td", { class: "num" }, money(r.min)));
        tr.appendChild(el("td", { class: "num" }, money(r.fee)));
        tr.appendChild(el("td", { class: "num strong" }, r.list === null ? "–" : money(r.list)));
        if (r.p.id === sel.value) tr.className = "picked";
        body.appendChild(tr);
      });
      var pick = results.filter(function (r) { return r.p.id === sel.value; })[0] || results[0];
      $("tag-price").textContent = pick.list === null ? "–" : money(pick.list).replace(".00", "");
      $("tag-platform").textContent = "on " + pick.p.name;
      $("tag-detail").textContent = pick.min === null ? "" :
        "Accept offers down to " + money(pick.min) + " and you still make " + money(target) + ".";
    }
    ids.forEach(function (id) { $(id).addEventListener("input", render); });
    render();
  }

  // ---------- lot splitter
  function initLot() {
    var EXAMPLE = { total: "40", method: "value", items: [
      { name: "Glass bowl set", value: "45" }, { name: "Cast iron skillet", value: "35" },
      { name: "Stoneware mug", value: "24" }, { name: "Vintage tin", value: "12" }, { name: "Utensil bundle", value: "8" }] };
    var saved = store.get("lot");
    var state = saved && saved.items && saved.items.length ? saved : JSON.parse(JSON.stringify(EXAMPLE));
    var isExample = !saved;
    var list = $("lot-items");
    $("lot-total").value = state.total;
    document.querySelectorAll("input[name=method]").forEach(function (r) { r.checked = r.value === state.method; });

    function save() { isExample = false; $("lot-example").hidden = true; store.set("lot", state); }

    function draw() {
      list.textContent = "";
      state.items.forEach(function (it, i) {
        var row = el("div", { class: "lot-row" });
        var n = el("input", { type: "text", id: "lot-name-" + i, "aria-label": "Item " + (i + 1) + " name", placeholder: "Item " + (i + 1) });
        n.value = it.name;
        n.addEventListener("input", function () { it.name = n.value; save(); calc(); });
        var v = el("input", { type: "text", inputmode: "decimal", id: "lot-value-" + i, "aria-label": "Item " + (i + 1) + " expected sale price", placeholder: "Expected $" });
        v.value = it.value;
        v.addEventListener("input", function () { it.value = v.value; save(); calc(); });
        var share = el("output", { class: "num share", id: "lot-share-" + i });
        var del = el("button", { type: "button", class: "icon", "aria-label": "Remove item " + (i + 1) }, "×");
        del.addEventListener("click", function () { state.items.splice(i, 1); save(); draw(); });
        row.appendChild(n); row.appendChild(v); row.appendChild(share); row.appendChild(del);
        list.appendChild(row);
      });
      calc();
    }

    function calc() {
      var total = num($("lot-total"));
      var method = state.method;
      var vals = state.items.map(function (it) { var x = parseFloat(String(it.value).replace(/[$,]/g, "")); return isFinite(x) && x > 0 ? x : 0; });
      var sumV = vals.reduce(function (a, b) { return a + b; }, 0);
      var n = state.items.length;
      var useEven = method === "even" || sumV <= 0;
      var shares = vals.map(function (v) { return n ? (useEven ? total / n : total * v / sumV) : 0; });
      // round to cents and put any leftover cent on the first item so the shares add up exactly
      var rounded = shares.map(function (s) { return Math.round(s * 100) / 100; });
      var diff = Math.round((total - rounded.reduce(function (a, b) { return a + b; }, 0)) * 100) / 100;
      if (n && Math.abs(diff) > 0) rounded[0] = Math.round((rounded[0] + diff) * 100) / 100;
      rounded.forEach(function (s, i) { var o = $("lot-share-" + i); if (o) o.textContent = money(s); });
      $("lot-count").textContent = n + (n === 1 ? " item" : " items");
      $("lot-avg").textContent = n ? money(total / n) : "–";
      $("lot-note").textContent = method === "value" && sumV <= 0 && n
        ? "Add expected sale prices to split by value. Splitting evenly for now."
        : method === "value" ? "Items you expect to sell for more carry more of the cost." : "Every item carries the same share.";
      $("lot-copy").onclick = function () {
        var lines = ["Item\tCost share"].concat(state.items.map(function (it, i) { return (it.name || "Item " + (i + 1)) + "\t" + rounded[i].toFixed(2); }));
        copyText($("lot-copy"), lines.join("\n"));
      };
    }

    $("lot-total").addEventListener("input", function () { state.total = $("lot-total").value; save(); calc(); });
    document.querySelectorAll("input[name=method]").forEach(function (r) {
      r.addEventListener("change", function () { if (r.checked) { state.method = r.value; save(); calc(); } });
    });
    $("lot-add").addEventListener("click", function () {
      state.items.push({ name: "", value: "" }); save(); draw();
      var last = $("lot-name-" + (state.items.length - 1)); if (last) last.focus();
    });
    $("lot-clear").addEventListener("click", function () {
      state = { total: "", method: state.method, items: [{ name: "", value: "" }, { name: "", value: "" }] };
      $("lot-total").value = ""; save(); draw();
    });
    $("lot-example").hidden = !isExample;
    draw();
  }

  // ---------- shared page bits
  function initShared() {
    document.querySelectorAll("[data-fees-checked]").forEach(function (n) { n.textContent = FEES_CHECKED; });
    if (ETSY_SHOP_URL) {
      document.querySelectorAll("[data-etsy]").forEach(function (promo) {
        promo.querySelectorAll("a[data-etsy-link]").forEach(function (a) { a.href = ETSY_SHOP_URL; });
        promo.hidden = false;
      });
    }
  }

  // Exposed for testing only.
  window.LotAndList = { PLATFORMS: PLATFORMS, feeFor: feeFor, profitFor: profitFor, priceForTarget: priceForTarget };

  document.addEventListener("DOMContentLoaded", function () {
    initShared();
    var host = document.querySelector("[data-page]");
    var page = host ? host.getAttribute("data-page") : "";
    if (page === "compare") initCompare();
    if (page === "listprice") initListPrice();
    if (page === "lot") initLot();
  });
})();
