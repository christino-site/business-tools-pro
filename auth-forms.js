/* Business Tools Pro — logique des pages connexion.html et inscription.html */
(function () {
  "use strict";

  var form = document.getElementById("auth-form");
  if (!form || !window.BT) return;

  var mode = form.getAttribute("data-mode"); // "login" | "signup"
  var msg = document.getElementById("msg");
  var btn = document.getElementById("submit");
  var label = btn.textContent;

  // Déjà connecté : on envoie directement au dashboard
  if (BT.redirectIfLoggedIn()) return;

  function show(text, type) {
    msg.textContent = text || "";
    msg.className = "msg" + (text ? " msg-" + (type || "error") : "");
  }
  function busy(on) {
    btn.disabled = on;
    btn.textContent = on ? "Veuillez patienter…" : label;
  }
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  // Boutons Afficher / Masquer le mot de passe
  Array.prototype.forEach.call(document.querySelectorAll("[data-toggle-pw]"), function (b) {
    b.addEventListener("click", function () {
      var input = document.getElementById(b.getAttribute("data-toggle-pw"));
      var reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      b.textContent = reveal ? "Masquer" : "Afficher";
      b.setAttribute("aria-pressed", String(reveal));
    });
  });

  if (!BT.isConfigured()) {
    show("Configuration manquante : renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans config.js.", "error");
  } else if (mode === "login" && /[?&]deconnecte=1/.test(location.search)) {
    show("Vous êtes déconnecté.", "ok");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    show("");

    var email = val("email").trim();
    var password = val("password");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show("Entrez une adresse email valide.");
    if (password.length < 8) return show("Le mot de passe doit contenir au moins 8 caractères.");

    if (mode === "signup") {
      var name = val("name").trim();
      if (!name) return show("Entrez votre nom.");
      if (password !== val("password2")) return show("Les deux mots de passe ne sont pas identiques.");

      busy(true);
      BT.signUp(email, password, name).then(function (res) {
        if (res.session) {
          location.replace(BT.nextTarget() || BT_CONFIG.PAGES.dashboard);
          return;
        }
        busy(false);
        form.reset();
        show("Compte créé ! Un email de confirmation vient d'être envoyé : cliquez sur le lien, puis connectez-vous.", "ok");
      }, function (err) {
        busy(false);
        show(err.message);
      });
      return;
    }

    busy(true);
    BT.signIn(email, password).then(function () {
      location.replace(BT.nextTarget() || BT_CONFIG.PAGES.dashboard);
    }, function (err) {
      busy(false);
      show(err.message);
    });
  });
})();
