/* Business Tools Pro — tableau de bord utilisateur.
 * N'affiche que les enregistrements du compte connecté (la RLS de Supabase l'impose côté serveur).
 * Tout le contenu utilisateur est inséré via textContent : jamais d'innerHTML avec des données.
 */
(function () {
  "use strict";

  if (!window.BT || !BT.requireAuth()) return;

  var PAGES = (window.BT_CONFIG && BT_CONFIG.PAGES) || {};
  var TOOLS = (window.BT_CONFIG && BT_CONFIG.TOOLS) || [];

  var $ = function (id) { return document.getElementById(id); };
  var all = [];
  var filter = "all";
  var query = "";

  /* ---------- Utilitaires ---------- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function toolInfo(key) {
    for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].key === key) return TOOLS[i];
    return { key: key, label: key, icon: "🧰" };
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  function setStatus(text, isError, retry) {
    var s = $("status");
    s.textContent = text || "";
    s.className = "status" + (isError ? " error" : "");
    if (retry) s.appendChild(h("button", { class: "btn btn-outline btn-sm", type: "button", text: "Réessayer", onclick: load }));
  }
  function goLogin() {
    BT.signOut(true);
  }
  function handleError(err) {
    if (err && err.expired) { goLogin(); return; }
    setStatus(err && err.message ? err.message : "Une erreur est survenue.", true, true);
  }

  /* ---------- En-tête et compte ---------- */
  function renderHeader() {
    var name = BT.displayName();
    $("hello").textContent = name ? "Bonjour, " + name + " 👋" : "Bonjour 👋";

    var u = BT.getUser() || {};
    var dl = $("account");
    dl.textContent = "";
    [["Nom", (u.user_metadata && u.user_metadata.full_name) || "—"],
     ["Email", u.email || "—"],
     ["Inscrit le", u.created_at ? fmtDate(u.created_at) : "—"]].forEach(function (row) {
      dl.appendChild(h("dt", { text: row[0] }));
      dl.appendChild(h("dd", { text: row[1] }));
    });

    if (!BT.isConfigured()) {
      var b = $("banner");
      b.hidden = false;
      b.textContent = "Configuration manquante : renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans config.js.";
    }
  }

  /* ---------- Statistiques ---------- */
  function renderStats() {
    var tools = {};
    all.forEach(function (it) { tools[it.tool] = true; });
    var last = all.length ? fmtDate(all[0].created_at) : "—";
    var box = $("stats");
    box.textContent = "";
    [[String(all.length), "Enregistrements"],
     [String(Object.keys(tools).length), "Outils utilisés"],
     [last, "Dernier enregistrement"]].forEach(function (s) {
      box.appendChild(h("div", { class: "stat" }, [
        h("div", { class: "n", text: s[0] }),
        h("div", { class: "l", text: s[1] })
      ]));
    });
  }

  /* ---------- Filtres ---------- */
  function renderChips() {
    var counts = {};
    all.forEach(function (it) { counts[it.tool] = (counts[it.tool] || 0) + 1; });
    var chips = $("chips");
    chips.textContent = "";

    function chip(key, text) {
      chips.appendChild(h("button", {
        class: "chip", type: "button", text: text,
        "aria-pressed": String(filter === key),
        onclick: function () { filter = key; render(); }
      }));
    }
    chip("all", "Tous (" + all.length + ")");
    Object.keys(counts).forEach(function (k) {
      var t = toolInfo(k);
      chip(k, t.icon + " " + t.label + " (" + counts[k] + ")");
    });
    // Le filtre actif n'existe plus (dernier élément supprimé) : retour à « Tous »
    if (filter !== "all" && !counts[filter]) { filter = "all"; renderChips(); }
  }

  /* ---------- Liste ---------- */
  function visible() {
    var q = query.trim().toLowerCase();
    return all.filter(function (it) {
      if (filter !== "all" && it.tool !== filter) return false;
      return !q || String(it.title).toLowerCase().indexOf(q) > -1;
    });
  }

  function renderItems() {
    var grid = $("items");
    grid.textContent = "";
    var list = visible();

    if (!all.length) {
      grid.appendChild(h("div", { class: "empty", style: "grid-column:1/-1" }, [
        h("div", { class: "big", text: "🗂️" }),
        h("p", { text: "Aucun enregistrement pour le moment." }),
        h("a", { class: "btn btn-accent", href: PAGES.home || "index.html", text: "Découvrir les outils" })
      ]));
      return;
    }
    if (!list.length) {
      grid.appendChild(h("div", { class: "empty", style: "grid-column:1/-1", text: "Aucun résultat pour cette recherche." }));
      return;
    }

    list.forEach(function (it) {
      var t = toolInfo(it.tool);
      var fields = it.data && typeof it.data === "object" ? Object.keys(it.data).length : 0;
      grid.appendChild(h("article", { class: "item" }, [
        h("div", { class: "item-top" }, [
          h("span", { class: "badge", text: t.icon + " " + t.label }),
          h("small", { text: fmtDate(it.created_at) })
        ]),
        h("h3", { text: it.title }),
        h("small", { text: fields + (fields > 1 ? " champs enregistrés" : " champ enregistré") }),
        h("div", { class: "item-actions" }, [
          h("button", { class: "btn btn-outline btn-sm", type: "button", text: "Voir", onclick: function () { openItem(it); } }),
          h("button", { class: "btn btn-outline btn-sm", type: "button", text: "Renommer", onclick: function () { renameItem(it); } }),
          h("button", { class: "btn btn-outline btn-sm", type: "button", text: "Exporter", onclick: function () { exportItem(it); } }),
          h("button", { class: "btn btn-danger btn-sm", type: "button", text: "Supprimer", onclick: function () { deleteItem(it); } })
        ])
      ]));
    });
  }

  function render() {
    renderStats();
    renderChips();
    renderItems();
  }

  /* ---------- Actions ---------- */
  var current = null;
  function openItem(it) {
    current = it;
    var t = toolInfo(it.tool);
    $("dlg-tool").textContent = t.icon + " " + t.label;
    $("dlg-title").textContent = it.title;
    $("dlg-date").textContent = "Enregistré le " + fmtDate(it.created_at);
    $("dlg-data").textContent = JSON.stringify(it.data, null, 2);
    $("dlg-copy").textContent = "Copier";
    var d = $("dlg");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }

  function renameItem(it) {
    var title = window.prompt("Nouveau titre :", it.title);
    if (title === null) return;
    title = title.trim();
    if (!title || title === it.title) return;
    BT.store.rename(it.id, title).then(function () {
      it.title = title;
      render();
    }, handleError);
  }

  function exportItem(it) {
    var blob = new Blob([JSON.stringify({ tool: it.tool, title: it.title, created_at: it.created_at, data: it.data }, null, 2)],
      { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var slug = String(it.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "enregistrement";
    var a = h("a", { href: url, download: slug + ".json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function deleteItem(it) {
    if (!window.confirm("Supprimer « " + it.title + " » ? Cette action est définitive.")) return;
    BT.store.remove(it.id).then(function () {
      all = all.filter(function (x) { return x.id !== it.id; });
      render();
    }, handleError);
  }

  /* ---------- Chargement ---------- */
  function load() {
    setStatus("Chargement de vos enregistrements…");
    BT.store.list().then(function (rows) {
      all = Array.isArray(rows) ? rows : [];
      setStatus("");
      render();
    }, handleError);
  }

  /* ---------- Événements ---------- */
  $("btn-logout").addEventListener("click", function () { BT.signOut(true); });
  $("search").addEventListener("input", function (e) { query = e.target.value; renderItems(); });
  $("dlg-close").addEventListener("click", function () { $("dlg").close(); });
  $("dlg-copy").addEventListener("click", function () {
    if (!current || !navigator.clipboard) return;
    navigator.clipboard.writeText(JSON.stringify(current.data, null, 2)).then(function () {
      $("dlg-copy").textContent = "Copié ✓";
    }, function () {});
  });
  // Déconnexion dans un autre onglet : on quitte aussi celui-ci
  window.addEventListener("storage", function (e) {
    if (e.key === BT.SESSION_KEY && !e.newValue) location.replace(PAGES.login || "connexion.html");
  });

  renderHeader();
  load();
})();
