// BFP public website — listing rendering (Pieces 5/6).
// Facts never live in this repo. Cards and home pages render at request
// time from Ezzie's anonymous listing_public_read, which serves only the
// approved published projection. The publishable key below is a client
// key by design — the read function itself is the lock. Which homes
// exist at all rides the publish-time identity manifest (listing_id +
// slug + address label only), embedded in each page as JSON.
(function () {
  var RPC = "https://hpuugxbrvdxdpnyeueyv.supabase.co/rest/v1/rpc/";
  var KEY = "sb_publishable_OX7MU_Y_byuwkAVppdfNBQ_hWsa-nmm";
  var SCREENER = "https://bfpapply.lovable.app/apply/";
  var baseMeta = document.querySelector('meta[name="site-base"]');
  var BASE = baseMeta ? baseMeta.getAttribute("content") : "/";
  if (BASE.charAt(BASE.length - 1) !== "/") BASE += "/";

  function sitePath(p) {
    return BASE + p.replace(/^\//, "");
  }

  function rpc(name, listingId) {
    return fetch(RPC + name, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: "Bearer " + KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_input: { listing_id: listingId } }),
    }).then(function (res) {
      return res.json();
    });
  }

  function fact(facts, key) {
    var f = facts && facts[key];
    if (!f || f.value === null || f.value === undefined || f.value === "") {
      return null;
    }
    return f.value;
  }

  function money(v) {
    return "$" + Number(v).toLocaleString("en-US");
  }

  // A home whose status is not known is never shown as Available.
  function bannerFor(d) {
    if (d.availability === "occupied") return "Rented";
    if (d.availability === "available" && d.publication_state === "published") {
      return "Available";
    }
    return "Coming Soon";
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function buildCard(entry, d) {
    var banner = bannerFor(d);
    var card = el("article", "listing-card");
    card.setAttribute("data-banner", banner);

    var photo = el("div", "card-photo");
    // The photo itself is a door to the home's detail page (Jen,
    // 2026-11-25), same destination as the address link below.
    var photoLink = el("a", "card-photo-link");
    photoLink.href = sitePath("homes/" + entry.slug + "/");
    photoLink.setAttribute(
      "aria-label",
      "See details for " + entry.address_label
    );
    var media = d.media || [];
    if (media.length && media[0].rendition_ref) {
      var img = document.createElement("img");
      img.src = sitePath("assets/media/" + media[0].rendition_ref);
      img.alt = "Photo of " + entry.address_label;
      img.loading = "lazy";
      photoLink.appendChild(img);
    } else {
      var ph = el("span", "photo-placeholder", "Photo");
      ph.setAttribute("role", "img");
      ph.setAttribute("aria-label", "No photo yet");
      photoLink.appendChild(ph);
    }
    photo.appendChild(photoLink);
    var b = el("span", "banner banner-" + banner.toLowerCase().replace(/ /g, "-"), banner);
    photo.appendChild(b);
    card.appendChild(photo);

    var body = el("div", "card-body");
    var rent = fact(d.facts, "rent_monthly");
    if (rent !== null) body.appendChild(el("p", "card-rent", money(rent) + "/mo"));
    var addr = el("h3", "card-address");
    var link = el("a", null, entry.address_label);
    link.href = sitePath("homes/" + entry.slug + "/");
    addr.appendChild(link);
    body.appendChild(addr);
    var bits = [];
    var beds = fact(d.facts, "beds");
    var baths = fact(d.facts, "baths");
    if (beds !== null) bits.push(beds + " bd");
    if (baths !== null) bits.push(baths + " ba");
    if (bits.length) body.appendChild(el("p", "card-facts", bits.join(" · ")));
    var deposit = fact(d.facts, "deposit");
    if (deposit !== null) {
      body.appendChild(el("p", "card-deposit", "Deposit " + money(deposit)));
    }
    card.appendChild(body);
    return card;
  }

  function readManifest() {
    var node = document.getElementById("listings-manifest");
    if (!node) return [];
    try {
      return JSON.parse(node.textContent).listings || [];
    } catch (e) {
      return [];
    }
  }

  function wireGrid(grid) {
    var entries = readManifest();
    var limit = parseInt(grid.getAttribute("data-limit") || "0", 10);
    var note = document.querySelector("[data-listing-note]");
    if (!entries.length) return;
    var pastGrid = document.querySelector("[data-listing-grid-past]");
    var pastSection = document.querySelector("[data-past-section]");
    Promise.all(
      entries.map(function (entry) {
        return rpc("listing_public_read", entry.listing_id)
          .then(function (d) {
            return { entry: entry, d: d };
          })
          .catch(function () {
            return { entry: entry, d: null };
          });
      })
    ).then(function (results) {
      // Default order (Jen, 2026-11-25): Available first, then Coming
      // Soon, then Past Rentals — ranked by each home's live read
      // state, never by manifest order. Sort is stable, so homes of
      // the same standing keep their manifest order.
      var rank = { Available: 0, "Coming Soon": 1, Rented: 2 };
      var cards = [];
      results.forEach(function (r) {
        if (r.d && r.d.outcome === "ok") {
          cards.push({ d: r.d, card: buildCard(r.entry, r.d) });
        }
      });
      cards.sort(function (a, b) {
        return (
          rank[a.card.getAttribute("data-banner")] -
          rank[b.card.getAttribute("data-banner")]
        );
      });
      var rendered = 0;
      var pastRendered = 0;
      cards.forEach(function (c) {
        // Occupied homes are past rentals: they group under the Past
        // Rentals heading when the page has one, never in the main grid.
        if (pastGrid && c.d.availability === "occupied") {
          pastGrid.appendChild(c.card);
          pastRendered++;
        } else if (limit <= 0 || rendered < limit) {
          grid.appendChild(c.card);
          rendered++;
        }
      });
      if (pastSection && pastRendered) pastSection.hidden = false;
      if (note) {
        note.textContent =
          rendered || pastRendered
            ? ""
            : "These homes are not showing right now — please check back shortly.";
      }
      var samples = document.querySelector("[data-sample-block]");
      if (samples && (rendered || pastRendered)) samples.style.display = "none";
    });
  }

  function wireFilters() {
    var buttons = document.querySelectorAll("[data-filter]");
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var want = btn.getAttribute("data-filter");
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        document
          .querySelectorAll(
            "[data-listing-grid] .listing-card, [data-listing-grid-past] .listing-card"
          )
          .forEach(function (card) {
            card.style.display =
              want === "All" || card.getAttribute("data-banner") === want
                ? ""
                : "none";
          });
        var pastSection = document.querySelector("[data-past-section]");
        if (pastSection && !pastSection.hidden) {
          pastSection.style.display =
            want === "All" || want === "Rented" ? "" : "none";
        }
      });
    });
  }

  var FACT_ROWS = [
    ["rent_monthly", "Rent", function (v) { return money(v) + "/mo"; }],
    ["deposit", "Deposit", function (v) { return money(v); }],
    ["beds", "Bedrooms", String],
    ["baths", "Bathrooms", String],
    ["square_feet", "Square feet", function (v) { return Number(v).toLocaleString("en-US"); }],
    ["available_date", "Available", String],
    ["utility_responsibility", "Utilities", String],
    ["school_district", "School district", String],
  ];

  // Photo carousel for the detail page (Jen, 2026-11-25): one photo at
  // a time, the WHOLE photo visible — renditions are contained, never
  // cropped — with prev/next buttons, touch swipe, and arrow keys.
  function buildCarousel(gallery, media, label) {
    gallery.textContent = "";
    gallery.classList.add("has-carousel");

    var carousel = el("div", "carousel");
    carousel.setAttribute("role", "region");
    carousel.setAttribute("aria-roledescription", "carousel");
    carousel.setAttribute("aria-label", "Photos of " + label);

    var viewport = el("div", "carousel-viewport");
    var track = el("div", "carousel-track");
    var slides = media.map(function (m, i) {
      var slide = el("div", "carousel-slide");
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", i + 1 + " of " + media.length);
      var img = document.createElement("img");
      img.src = sitePath("assets/media/" + m.rendition_ref);
      img.alt = "Photo of " + label;
      if (i > 0) img.loading = "lazy";
      slide.appendChild(img);
      track.appendChild(slide);
      return slide;
    });
    viewport.appendChild(track);
    carousel.appendChild(viewport);
    gallery.appendChild(carousel);

    if (media.length < 2) return;

    var live = el("span", "visually-hidden");
    live.setAttribute("aria-live", "polite");
    carousel.appendChild(live);
    var counter = el("span", "carousel-counter", "1 / " + media.length);
    counter.setAttribute("aria-hidden", "true");
    carousel.appendChild(counter);

    var idx = 0;
    function go(n) {
      idx = ((n % media.length) + media.length) % media.length;
      track.style.transform = "translateX(" + -idx * 100 + "%)";
      counter.textContent = idx + 1 + " / " + media.length;
      live.textContent = "Photo " + (idx + 1) + " of " + media.length;
      slides.forEach(function (s, i) {
        if (i === idx) s.removeAttribute("aria-hidden");
        else s.setAttribute("aria-hidden", "true");
      });
    }

    function navButton(cls, ariaLabel, path, delta) {
      var btn = el("button", "carousel-btn " + cls);
      btn.type = "button";
      btn.setAttribute("aria-label", ariaLabel);
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="' + path + '" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" ' +
        'stroke-linejoin="round"/></svg>';
      btn.addEventListener("click", function () {
        go(idx + delta);
      });
      return btn;
    }
    carousel.appendChild(
      navButton("carousel-prev", "Previous photo", "M15 5l-7 7 7 7", -1)
    );
    carousel.appendChild(
      navButton("carousel-next", "Next photo", "M9 5l7 7-7 7", 1)
    );

    carousel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") go(idx - 1);
      else if (e.key === "ArrowRight") go(idx + 1);
      else return;
      e.preventDefault();
    });

    var startX = null;
    viewport.addEventListener(
      "touchstart",
      function (e) {
        startX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    viewport.addEventListener(
      "touchend",
      function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
        startX = null;
      },
      { passive: true }
    );

    go(0);
  }

  function wireDetail(container) {
    var listingId = container.getAttribute("data-listing-id");
    var slug = container.getAttribute("data-slug");
    var status = container.querySelector("[data-detail-status]");
    rpc("listing_public_read", listingId)
      .then(function (d) {
        if (!d || d.outcome !== "ok") {
          status.textContent = "This home is not currently listed.";
          return;
        }
        status.textContent = "";
        // The badge matches the read state exactly: occupied shows
        // Past Rental, unavailable_review shows Coming Soon, and an
        // available home shows no badge.
        if (d.availability === "occupied") {
          var pastBanner = container.querySelector("[data-detail-past]");
          if (pastBanner) pastBanner.hidden = false;
        } else if (d.availability === "unavailable_review") {
          var soonBanner = container.querySelector("[data-detail-soon]");
          if (soonBanner) soonBanner.hidden = false;
        }
        // Gallery — approved renditions only (the read filters them),
        // shown as a carousel with the whole photo visible.
        var gallery = container.querySelector("[data-detail-gallery]");
        var media = (d.media || []).filter(function (m) {
          return m.rendition_ref;
        });
        if (media.length) {
          var h1 = container.querySelector("h1");
          buildCarousel(gallery, media, h1 ? h1.textContent : "this home");
        } else {
          // No approved photos yet — say so plainly instead of leaving
          // a large empty box.
          gallery.textContent = "No photos yet";
          gallery.classList.add("no-photos");
        }
        // Facts grid — unknown facts are omitted, never invented.
        var grid = container.querySelector("[data-detail-facts]");
        FACT_ROWS.forEach(function (row) {
          var v = fact(d.facts, row[0]);
          if (v === null) return;
          var cell = el("div");
          cell.appendChild(el("dt", null, row[1]));
          cell.appendChild(el("dd", null, row[2](v)));
          grid.appendChild(cell);
        });
        if (fact(d.facts, "voucher_acceptance") === true) {
          var vch = container.querySelector("[data-detail-voucher]");
          if (vch) {
            vch.textContent =
              "This home accepts Housing Choice Vouchers.";
            vch.style.display = "";
          }
        }
        // Apply — only when Ezzie says applications are open for this home.
        var applyZone = container.querySelector("[data-detail-apply]");
        if (d.availability === "occupied") {
          applyZone.appendChild(el("p", null, "This home is rented."));
          var back = el("a", "btn btn-ghost", "See available homes");
          back.href = sitePath("find-a-home/");
          applyZone.appendChild(back);
          return;
        }
        if (!d.application_open) return;
        rpc("listing_apply_entry_read", listingId).then(function (entry) {
          // The read's success outcome is "entry" (verified live
          // 2026-11-25); it binds this listing + property exactly.
          if (entry && entry.outcome === "entry" &&
              entry.screener_route_key === "bfp_tenant_screener") {
            var a = el("a", "btn btn-primary", "Pre-screen Now (Free)");
            a.href = SCREENER + slug;
            a.target = "_blank";
            a.rel = "noopener";
            applyZone.appendChild(a);
          } else if (entry && entry.outcome === "entry") {
            var c = el("a", "btn btn-primary", "Contact us to apply");
            c.href = sitePath("our-family/#contact");
            applyZone.appendChild(c);
          }
        });
      })
      .catch(function () {
        status.textContent =
          "This home's details are not loading right now — please check back shortly.";
      });
  }

  document.querySelectorAll("[data-listing-grid]").forEach(wireGrid);
  wireFilters();
  document.querySelectorAll("[data-listing-detail]").forEach(wireDetail);
})();
