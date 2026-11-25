// BFP public website — intake form submitter (Piece 9).
// Posts the site's forms (maintenance, sell-your-home, contact) to
// Ezzie's public intake endpoint, which files each submission into
// Ezzie Capture.
// The endpoint is public by design (allowlisted fields, rate-limited);
// no credential of any kind lives here.
(function () {
  var ENDPOINT =
    "https://hpuugxbrvdxdpnyeueyv.supabase.co/functions/v1/public_website_intake";

  function wire(form) {
    var status = form.querySelector("[data-intake-status]");
    var button = form.querySelector("button[type=submit]");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var payload = { form_kind: form.getAttribute("data-intake-form") };
      var data = new FormData(form);
      data.forEach(function (value, key) {
        if (typeof value === "string" && value.trim() !== "") {
          payload[key] = value;
        }
      });
      if (button) button.disabled = true;
      if (status) status.textContent = "Sending…";
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (button) button.disabled = false;
          if (res.ok) {
            form.reset();
            if (status) {
              status.textContent =
                "Thank you — your message is in. We will follow up from here.";
            }
          } else if (res.status === 429) {
            if (status) {
              status.textContent =
                "Too many submissions in a short window — please wait a few minutes and try again.";
            }
          } else {
            if (status) {
              status.textContent =
                "That didn't go through. Please check the form and try again.";
            }
          }
        })
        .catch(function () {
          if (button) button.disabled = false;
          if (status) {
            status.textContent =
              "That didn't go through. Please check your connection and try again.";
          }
        });
    });
  }

  document.querySelectorAll("form[data-intake-form]").forEach(wire);
})();
