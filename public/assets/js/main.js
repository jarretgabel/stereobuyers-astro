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
var tickerAttached = false;
var gsapCallbacks = [];
var gsapRequested = false;

// TweenMax is loaded once and kept, so later pages reuse it
var whenGsapReady = function(callback) {
  if(window.TweenMax) return callback();
  gsapCallbacks.push(callback);
  if(gsapRequested) return;
  gsapRequested = true;

  var gsap = document.createElement("script");
  gsap.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/2.0.2/TweenMax.min.js";
  gsap.onload = function() {
    gsapCallbacks.forEach(function(fn) { fn(); });
    gsapCallbacks = [];
  };
  document.head.appendChild(gsap);
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
    whenGsapReady(function() {
      if(run === introRun) animateIntro(run);
    });
  });
}

var animateIntro = function(run) {
  var background = document.querySelector(".background");
  var identity = document.querySelector(".identity");

  // Arriving by client-side navigation: the header is already on screen, so skip its entrance
  var navigated = document.documentElement.classList.contains("sb-nav");

  if(navigated) {
    TweenMax.set([background, identity], { y: 0 });
  } else {
    TweenMax.to(background, 0.75, { y: 0, ease: Power4.easeInOut });
    TweenMax.to(identity, 0.75, { y: 0, ease: Power4.easeInOut, delay: 0.2 });
  }
  TweenMax.delayedCall(0.25, () => {
    if(run === introRun) phaseTwo(run);
  });
}

var phaseTwo = function(run) {
  var scale = document.querySelectorAll(".scale");
  var slide = document.querySelectorAll(".autoAlpha0:not(.scale)");
  var contact = document.querySelector(".sticky-contact");

  if(scale && slide) {
    TweenMax.staggerTo(scale, 0.75, { autoAlpha: 1, ease: Power2.easeOut, delay: 0.2 }, 0.1);
    TweenMax.staggerTo(scale, 1, { scale: 1, ease: Power2.easeOut, delay: 0.2 }, 0.1);
    TweenMax.staggerTo(slide, 0.75, { autoAlpha: 1, ease: Power2.easeOut, delay: 0.7 }, 0.2);
    TweenMax.staggerTo(slide, 1, { y: 0, ease: Power2.easeOut, delay: 0.7 }, 0.2);
  }

  if(contact && document.documentElement.classList.contains("sb-nav")) {
    contact.classList.remove("transY100");
  } else if(contact) {
    // GSAP drops an identity transform, which would let the CSS translateY(100%) hide the bar again
    TweenMax.set(contact, { y: contact.offsetHeight });
    contact.classList.remove("transY100");
    TweenMax.to(contact, 0.5, { y: 0, ease: Power4.easeOut, delay: 1.7 });
  }

  TweenMax.delayedCall(0.1, () => {
    var scroll = window.scrollY;
    var time =(scroll > window.innerHeight ? 0 : 1.2);

    TweenMax.delayedCall(time, () => {
      if(run !== introRun || tickerAttached) return;
      tickerAttached = true;
      TweenMax.ticker.addEventListener("tick", onTick);
      onTeardown(function() {
        TweenMax.ticker.removeEventListener("tick", onTick);
        tickerAttached = false;
      });
    });
  });
}

var data = [];
var cache = function() {
  data = [];
  var images = document.querySelectorAll("[data-src]");
  images.forEach((image, index) => {
    data.push({
      image: image,
      top: image.offsetTop,
      src: image.dataset.src,
      direction: image.dataset.direction,
      cover: image.parentNode.querySelector(".image-cover"),
      loaded: 0,
      index: index
    });
  })
}
totalLoaded = 0;

var loadItem = function(item) {
  item.loaded = 1;
  totalLoaded++;

  var image = new Image();
  image.onload = () => {
    var from = { autoAlpha: 0, y: 50 };
    var to = { autoAlpha: 1, x: 0, y: 0, ease: Power4.easeOut };

    if(item.direction === "right") {
      from = { autoAlpha: 0, x: 100 };
    } else if(item.direction === "left") {
      from = { autoAlpha: 0, x: -100 };
    } if(item.direction === "bottom") {
      from = { y: "0%" };
      to = { y: "101%", ease: Power4.easeInOut };
    }

    var animateItem = item.direction === 'bottom' ? item.cover : item.image;

    TweenMax.set(animateItem, from);
    item.image.src = item.src;

    TweenMax.to(animateItem, 1.5, to);
  }
  image.src = item.src;
}

var onTick = function() {

  var scroll = window.scrollY;
  var winHeight = window.innerHeight;
  var position = scroll + winHeight;

  if(data) {
    data.forEach(item => {
      var bounds = item.image.getBoundingClientRect();
      if(!item.loaded && ((bounds.top > 0 && bounds.top < winHeight) || (bounds.bottom > 0 && bounds.bottom < winHeight))) {
        loadItem(item);
      }
    });
  }
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
  cache();
  if(document.querySelector(".index-body, .free-pick-up-in-our-service-area")) startIntro();
  else startContactBar();
}

// Pages without the homepage intro still bring the sticky call-to-action bar in
var startContactBar = function() {
  var run = introRun;
  whenFontsReady(function() {
    whenGsapReady(function() {
      var contact = document.querySelector(".sticky-contact");
      if(run !== introRun || !contact) return;
      if(document.documentElement.classList.contains("sb-nav")) {
        contact.classList.remove("transY100");
        return;
      }
      TweenMax.set(contact, { y: contact.offsetHeight });
      contact.classList.remove("transY100");
      TweenMax.to(contact, 0.5, { y: 0, ease: Power4.easeOut, delay: 0.6 });
    });
  });
}

init();
document.addEventListener("astro:page-load", function() {
  init();
  trackNavigation();
});
