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
    var media = d.media || [];
    if (media.length && media[0].rendition_ref) {
      var img = document.createElement("img");
      img.src = sitePath("assets/media/" + media[0].rendition_ref);
      img.alt = "Photo of " + entry.address_label;
      img.loading = "lazy";
      photo.appendChild(img);
    } else {
      var ph = el("span", "photo-placeholder", "Photo");
      ph.setAttribute("role", "img");
      ph.setAttribute("aria-label", "No photo yet");
      photo.appendChild(ph);
    }
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
    if (limit > 0) entries = entries.slice(0, limit);
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
      var rendered = 0;
      var pastRendered = 0;
      results.forEach(function (r) {
        if (r.d && r.d.outcome === "ok") {
          var card = buildCard(r.entry, r.d);
          // Occupied homes are past rentals: they group under the Past
          // Rentals heading when the page has one, never in the main grid.
          if (pastGrid && r.d.availability === "occupied") {
            pastGrid.appendChild(card);
            pastRendered++;
          } else {
            grid.appendChild(card);
            rendered++;
          }
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
        if (d.availability === "occupied") {
          var pastBanner = container.querySelector("[data-detail-past]");
          if (pastBanner) pastBanner.hidden = false;
        }
        // Gallery — approved renditions only (the read filters them).
        var gallery = container.querySelector("[data-detail-gallery]");
        var media = d.media || [];
        if (media.length) {
          gallery.textContent = "";
          media.forEach(function (m) {
            if (!m.rendition_ref) return;
            var img = document.createElement("img");
            img.src = sitePath("assets/media/" + m.rendition_ref);
            img.alt = "Photo of this home";
            img.loading = "lazy";
            gallery.appendChild(img);
          });
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
          if (entry && entry.outcome === "ok" &&
              entry.screener_route_key === "bfp_tenant_screener") {
            var a = el("a", "btn btn-primary", "Apply");
            a.href = SCREENER + slug;
            a.target = "_blank";
            a.rel = "noopener";
            applyZone.appendChild(a);
          } else if (entry && entry.outcome === "ok") {
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
