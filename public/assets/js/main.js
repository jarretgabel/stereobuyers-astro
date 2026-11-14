// Page swaps replace the body, so everything bound to document is undone before the next page binds again
var teardowns = [];
var onTeardown = function(fn) {
  teardowns.push(fn);
};
var runTeardowns = function() {
  teardowns.forEach(function(fn) { fn(); });
  teardowns = [];
};

var initNav = function() {
  var header = document.querySelector(".header");
  var toggle = document.querySelector(".nav-toggle");
  if(!header || !toggle) return;

  var setOpen = function(open) {
    header.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  var onToggle = function() {
    setOpen(!header.classList.contains("nav-open"));
  };
  var onKeydown = function(event) {
    if(event.key === "Escape" && header.classList.contains("nav-open")) {
      setOpen(false);
      toggle.focus();
    }
  };

  // Slide the menu away first, then let the page transition run
  var onNavClick = function(event) {
    var link = event.target.closest && event.target.closest("a[href]");
    if(!link || link.dataset.navLeaving) return;
    if(event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
    if(link.target && link.target !== "_self") return;
    if(link.hasAttribute("download") || link.origin !== location.origin) return;
    var samePage = link.pathname === location.pathname && link.search === location.search;
    if(samePage && link.hash) return;
    if(!header.classList.contains("nav-open")) return;
    if(samePage) {
      // Already here: just slide the menu away instead of reloading
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    header.classList.add("nav-closing");
    setOpen(false);
    var delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280;
    setTimeout(function() {
      header.classList.remove("nav-closing");
      link.dataset.navLeaving = "true";
      link.click();
      delete link.dataset.navLeaving;
    }, delay);
  };

  toggle.addEventListener("click", onToggle);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onNavClick, true);
  onTeardown(function() {
    toggle.removeEventListener("click", onToggle);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onNavClick, true);
  });
}

var introRun = 0;

var EASE = {
  power2Out: "cubic-bezier(0.5, 1, 0.89, 1)",
  power4Out: "cubic-bezier(0.16, 1, 0.3, 1)",
  power4InOut: "cubic-bezier(0.76, 0, 0.24, 1)"
};
var reducedMotion = function() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Animates from -> to, then commits the end state inline so it outlasts the animation
var play = function(el, from, to, duration, delay, easing) {
  if(!el) return;
  var commit = function() { Object.assign(el.style, to); };
  if(reducedMotion() || !el.animate) return commit();
  var animation = el.animate([from, to], { duration: duration, delay: delay || 0, easing: easing, fill: "both" });
  animation.onfinish = function() { commit(); animation.cancel(); };
}

var whenFontsReady = function(callback) {
  var root = document.documentElement;
  if(!root.classList.contains("fonts-pending")) return callback();
  var observer = new MutationObserver(function() {
    if(!root.classList.contains("fonts-pending")) {
      observer.disconnect();
      callback();
    }
  });
  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
}

var startIntro = function() {
  var run = introRun;
  whenFontsReady(function() {
    if(run === introRun) animateIntro();
  });
}

var animateIntro = function() {
  var background = document.querySelector(".background");
  var identity = document.querySelector(".identity");
  var visible = { opacity: 1, visibility: "visible" };

  // Arriving by client-side navigation: the header is already on screen, so skip its entrance
  if(document.documentElement.classList.contains("sb-nav")) {
    [background, identity].forEach(function(el) { if(el) el.style.transform = "none"; });
  } else {
    play(background, { transform: "translateY(-100%)" }, { transform: "none" }, 750, 0, EASE.power4InOut);
    play(identity, { transform: "translateY(-100px)" }, { transform: "none" }, 750, 200, EASE.power4InOut);
  }

  var scale = document.querySelectorAll(".scale");
  var slide = document.querySelectorAll(".autoAlpha0:not(.scale)");

  scale.forEach(function(el, i) {
    var delay = 450 + i * 100;
    play(el, { opacity: 0, visibility: "visible", transform: "scale(0.85)" }, { opacity: 1, visibility: "visible", transform: "none" }, 1000, delay, EASE.power2Out);
  });
  slide.forEach(function(el, i) {
    play(el, { opacity: 0, visibility: "visible" }, visible, 750, 950 + i * 200, EASE.power2Out);
  });

  showContactBar(1950);
}

// The bar starts below the viewport (transY100); slide it up after a delay
var showContactBar = function(delay) {
  var contact = document.querySelector(".sticky-contact");
  if(!contact) return;
  if(document.documentElement.classList.contains("sb-nav")) {
    contact.classList.remove("transY100");
    return;
  }
  play(contact, { transform: "translateY(100%)" }, { transform: "none" }, 500, delay, EASE.power4Out);
  contact.classList.remove("transY100");
}

var trackedPath = location.pathname + location.search;
var trackNavigation = function() {
  var path = location.pathname + location.search;
  if(path === trackedPath) return;
  trackedPath = path;
  if(window.fbq) window.fbq("track", "PageView");
  if(window.uetq && window.uetq.push) window.uetq.push("pageLoad");
}

var initReveal = function() {
  var items = document.querySelectorAll(".reveal-up, .reveal-left, .reveal-right");
  if(!items.length || !("IntersectionObserver" in window)) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if(entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px" });

  items.forEach(function(item) {
    item.classList.add("js-reveal");
    observer.observe(item);
  });
  onTeardown(function() {
    observer.disconnect();
  });
}

var init = function() {
  introRun++;
  runTeardowns();
  initNav();
  initReveal();
  if(document.querySelector(".index-body, .free-pick-up-in-our-service-area")) startIntro();
  else startContactBar();
}

// Pages without the homepage intro still bring the sticky call-to-action bar in
var startContactBar = function() {
  var run = introRun;
  whenFontsReady(function() {
    if(run === introRun) showContactBar(600);
  });
}

init();
document.addEventListener("astro:page-load", function() {
  init();
  trackNavigation();
});
