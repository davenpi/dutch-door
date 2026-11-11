/* Fills the values from config.js into the page and runs the price check demo. */
(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};
  var brand = (cfg.BRAND || "").trim();
  var email = (cfg.EMAIL || "").trim();
  var founder = (cfg.FOUNDER || "").trim();
  var calendar = (cfg.CALENDAR_URL || "").trim();
  var postal = (cfg.POSTAL_ADDRESS || "").trim();

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  /* Brand name and page title */
  if (brand) {
    each("[data-brand]", function (el) { el.textContent = brand; });
    document.title = brand + " · A front door for your listings";
  }

  /* Email address, as text and as mailto links */
  if (email) {
    var subject = (brand ? brand + " pilot" : "Pilot") + " for my listings";
    each("[data-email-text]", function (el) { el.textContent = email; });
    each("[data-email-link]", function (el) {
      var href = "mailto:" + email;
      if (el.getAttribute("data-subject") === "pilot") {
        href += "?subject=" + encodeURIComponent(subject);
      }
      el.setAttribute("href", href);
    });
  }

  /* Optional values: shown only when set */
  if (founder) {
    each("[data-founder]", function (el) { el.textContent = founder; });
    each("[data-founder-wrap]", function (el) { el.hidden = false; });
  }
  if (calendar) {
    each("[data-calendar]", function (el) {
      el.setAttribute("href", calendar);
      el.setAttribute("rel", "noopener");
      el.hidden = false;
    });
  }
  if (postal) {
    each("[data-postal]", function (el) { el.textContent = postal; el.hidden = false; });
  }

  /* Blind price check demo. Everything stays in this page. */
  var buyer = document.getElementById("buyer-most");
  var seller = document.getElementById("seller-least");
  var check = document.getElementById("check");
  var result = document.getElementById("result");
  var main = document.getElementById("result-main");
  var sub = document.getElementById("result-sub");
  if (!buyer || !seller || !check || !result) { return; }

  /* Accepts 2400000, 2,400,000, $2.4m or 950k. Returns NaN for anything else. */
  function parseAmount(raw) {
    var t = String(raw).replace(/[$,\s]/g, "").toLowerCase();
    var m = /^(\d+(?:\.\d+)?)([km])?$/.exec(t);
    if (!m) { return NaN; }
    var n = Number(m[1]);
    if (m[2] === "k") { n *= 1e3; }
    if (m[2] === "m") { n *= 1e6; }
    return n;
  }

  /* The whole rule: a deal is possible when the buyer's most is at least the seller's least. */
  function blindMatch(buyerMost, sellerLeast) {
    return buyerMost >= sellerLeast ? "overlap" : "none";
  }

  function show(state, text, withNote) {
    result.setAttribute("data-state", state);
    main.textContent = text;
    sub.hidden = !withNote;
  }

  function mask(input, button) {
    input.type = "password";
    button.textContent = "Show";
    button.setAttribute("aria-pressed", "false");
  }

  function wireToggle(input, button) {
    button.addEventListener("click", function () {
      if (input.type === "password") {
        input.type = "text";
        button.textContent = "Hide";
        button.setAttribute("aria-pressed", "true");
      } else {
        mask(input, button);
      }
    });
    input.addEventListener("input", function () {
      if (result.getAttribute("data-state") !== "idle") {
        show("idle", "A number changed. Press Check again.", false);
      }
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { check.click(); }
    });
  }

  var buyerToggle = document.getElementById("buyer-toggle");
  var sellerToggle = document.getElementById("seller-toggle");
  wireToggle(buyer, buyerToggle);
  wireToggle(seller, sellerToggle);

  check.addEventListener("click", function () {
    var b = parseAmount(buyer.value);
    var s = parseAmount(seller.value);
    if (isNaN(b) || isNaN(s)) {
      show("error", "Enter a dollar amount in both boxes, such as 2,400,000.", false);
      return;
    }
    mask(buyer, buyerToggle);
    mask(seller, sellerToggle);
    if (blindMatch(b, s) === "overlap") {
      show("overlap", "A deal is possible", true);
    } else {
      show("none", "No overlap", true);
    }
  });
})();
