var initNav = function() {
  var header = document.querySelector(".header");
  var toggle = document.querySelector(".nav-toggle");
  if(!header || !toggle) return;

  var setOpen = function(open) {
    header.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  toggle.addEventListener("click", function() {
    setOpen(!header.classList.contains("nav-open"));
  });

  document.addEventListener("keydown", function(event) {
    if(event.key === "Escape" && header.classList.contains("nav-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}
initNav();

var animateIntro = function() {
  var background = document.querySelector(".background");
  var identity = document.querySelector(".identity");

  TweenMax.to(background, 0.75, { y: 0, ease: Power4.easeInOut, onComplete: () => {

  }});
  TweenMax.to(identity, 0.75, { y: 0, ease: Power4.easeInOut, delay: 0.2 });
  TweenMax.delayedCall(0.25, () => {
    phaseTwo();
  });
}

var phaseTwo = function() {
  var scale = document.querySelectorAll(".scale");
  var slide = document.querySelectorAll(".autoAlpha0:not(.scale)");
  var contact = document.querySelector(".sticky-contact");

  if(scale && slide) {
    TweenMax.staggerTo(scale, 0.75, { autoAlpha: 1, ease: Power2.easeOut, delay: 0.2 }, 0.1);
    TweenMax.staggerTo(scale, 1, { scale: 1, ease: Power2.easeOut, delay: 0.2 }, 0.1);
    TweenMax.staggerTo(slide, 0.75, { autoAlpha: 1, ease: Power2.easeOut, delay: 0.7 }, 0.2);
    TweenMax.staggerTo(slide, 1, { y: 0, ease: Power2.easeOut, delay: 0.7 }, 0.2);
  }

  if(contact) {
    // GSAP drops an identity transform, which would let the CSS translateY(100%) hide the bar again
    TweenMax.set(contact, { y: contact.offsetHeight });
    contact.classList.remove("transY100");
    TweenMax.to(contact, 0.5, { y: 0, ease: Power4.easeOut, delay: 1.7 });
  }

  TweenMax.delayedCall(0.1, () => {
    var scroll = window.scrollY;
    var time =(scroll > window.innerHeight ? 0 : 1.2);

    TweenMax.delayedCall(time, () => {
      TweenMax.ticker.addEventListener("tick", () => onTick());
    });
  });
}

var data = [];
var cache = function() {
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
cache();
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

// GSAP is only needed for the intro animations on these pages
var index = document.querySelector(".index-body, .free-pick-up-in-our-service-area");
if(index) {
  var gsap = document.createElement("script");
  gsap.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/2.0.2/TweenMax.min.js";
  gsap.onload = animateIntro;
  document.head.appendChild(gsap);
}
(function() {
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
})();
