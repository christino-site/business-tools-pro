/* Business Tools Pro — authentification et stockage par utilisateur.
 * Parle directement à l'API REST de Supabase (fetch) : aucune bibliothèque externe.
 * Expose : window.BT
 */
(function () {
  "use strict";

  var C = window.BT_CONFIG || {};
  var P = C.PAGES || {};
  var TABLE = C.TABLE || "user_items";
  var KEY = "bt_session";

  /* ---------- Configuration ---------- */
  function isConfigured() {
    return !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY &&
      !/VOTRE/i.test(C.SUPABASE_URL) && !/VOTRE/i.test(C.SUPABASE_ANON_KEY));
  }

  /* ---------- Session (stockée dans le navigateur) ---------- */
  function readSession() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function writeSession(s) {
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch (e) { /* stockage indisponible : la session ne survivra pas au rechargement */ }
  }
  function toSession(d) {
    if (!d || !d.access_token) return null;
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
      user: d.user || null
    };
  }

  /* ---------- Messages d'erreur en français ---------- */
  function frError(msg) {
    var m = String(msg || "").toLowerCase();
    if (m.indexOf("invalid login") > -1) return "Email ou mot de passe incorrect.";
    if (m.indexOf("already registered") > -1 || m.indexOf("already been registered") > -1)
      return "Un compte existe déjà avec cet email. Connectez-vous.";
    if (m.indexOf("email not confirmed") > -1)
      return "Confirmez d'abord votre email : consultez votre boîte de réception.";
    if (m.indexOf("password") > -1 && (m.indexOf("least") > -1 || m.indexOf("weak") > -1 || m.indexOf("short") > -1))
      return "Mot de passe trop faible (8 caractères minimum).";
    if (m.indexOf("rate limit") > -1 || m.indexOf("too many") > -1)
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    if (m.indexOf("valid email") > -1 || m.indexOf("invalid email") > -1)
      return "Adresse email invalide.";
    if (m.indexOf("signups not allowed") > -1)
      return "Les inscriptions sont désactivées pour le moment.";
    if (m.indexOf("invalid api key") > -1 || m.indexOf("no api key") > -1)
      return "Clé Supabase invalide : vérifiez config.js.";
    return "Une erreur est survenue. Réessayez.";
  }
  function userError(err) {
    var e = new Error(err && err.network ? err.message : frError(err && err.message));
    e.status = err && err.status;
    return e;
  }

  /* ---------- Requêtes ---------- */
  function request(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.text().then(function (t) {
        var d = null;
        try { d = t ? JSON.parse(t) : null; } catch (e) { d = null; }
        if (!r.ok) {
          var err = new Error((d && (d.msg || d.message || d.error_description || d.error)) || ("HTTP " + r.status));
          err.status = r.status;
          throw err;
        }
        return d;
      });
    }, function () {
      var e = new Error("Connexion impossible. Vérifiez votre réseau.");
      e.network = true;
      throw e;
    });
  }

  function authCall(path, body, token) {
    if (!isConfigured()) {
      return Promise.reject(userError(new Error("Configuration Supabase manquante (config.js).")));
    }
    var headers = { "apikey": C.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return request(C.SUPABASE_URL + "/auth/v1/" + path, {
      method: "POST", headers: headers, body: JSON.stringify(body || {})
    });
  }

  /* ---------- Inscription / connexion / déconnexion ---------- */
  function signUp(email, password, fullName) {
    return authCall("signup", { email: email, password: password, data: { full_name: fullName || "" } })
      .then(function (d) {
        var session = toSession(d);
        if (session) {
          writeSession(session);
          return { session: session, needsConfirmation: false };
        }
        // Email déjà utilisé : Supabase répond sans erreur mais sans identité
        if (d && d.identities && d.identities.length === 0) {
          throw new Error("already registered");
        }
        return { session: null, needsConfirmation: true };
      })
      .catch(function (err) { throw userError(err); });
  }

  function signIn(email, password) {
    return authCall("token?grant_type=password", { email: email, password: password })
      .then(function (d) {
        var session = toSession(d);
        if (!session) throw new Error("invalid login");
        writeSession(session);
        return session;
      })
      .catch(function (err) { throw userError(err); });
  }

  function signOut(redirect) {
    var s = readSession();
    var done = function () {
      writeSession(null);
      if (redirect !== false) location.replace((P.login || "connexion.html") + "?deconnecte=1");
    };
    if (!s) { done(); return Promise.resolve(); }
    // Invalide la session côté serveur (sans bloquer si le réseau échoue)
    return authCall("logout", {}, s.access_token).then(done, done);
  }

  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    var s = readSession();
    if (!s || !s.refresh_token) return Promise.reject(new Error("no session"));
    refreshing = authCall("token?grant_type=refresh_token", { refresh_token: s.refresh_token })
      .then(function (d) {
        var n = toSession(d);
        if (!n) throw new Error("no session");
        writeSession(n);
        return n;
      })
      .then(function (n) { refreshing = null; return n; },
            function (e) { refreshing = null; throw e; });
    return refreshing;
  }

  function validToken() {
    var s = readSession();
    if (!s) return Promise.reject(sessionExpired());
    if (s.expires_at - Date.now() > 60000) return Promise.resolve(s.access_token);
    return refresh().then(function (n) { return n.access_token; }, function (err) {
      if (err && err.network) throw err;
      writeSession(null);
      throw sessionExpired();
    });
  }
  function sessionExpired() {
    var e = new Error("Votre session a expiré. Reconnectez-vous.");
    e.expired = true;
    return e;
  }

  /* ---------- Accès à la base (REST, protégé par la RLS de Supabase) ---------- */
  function rest(method, path, body, prefer) {
    return validToken().then(function (token) {
      var headers = {
        "apikey": C.SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      };
      if (prefer !== null) headers.Prefer = prefer || "return=representation";
      return request(C.SUPABASE_URL + "/rest/v1/" + path, {
        method: method, headers: headers, body: body ? JSON.stringify(body) : undefined
      });
    }).catch(function (err) {
      if (err && err.expired) throw err;
      if (err && err.status === 401) { writeSession(null); throw sessionExpired(); }
      if (err && err.network) throw err;
      var e = new Error(err && err.status === 404
        ? "Table introuvable : exécutez supabase-setup.sql dans Supabase."
        : "Opération impossible pour le moment. Réessayez.");
      e.status = err && err.status;
      throw e;
    });
  }

  var store = {
    // Liste uniquement les enregistrements de l'utilisateur connecté (garanti par la RLS)
    list: function (tool) {
      var q = "?select=id,tool,title,data,created_at,updated_at&order=created_at.desc";
      if (tool) q += "&tool=eq." + encodeURIComponent(tool);
      return rest("GET", TABLE + q, null, null);
    },
    // À appeler depuis chaque outil : BT.store.save("facture", "Facture client X", {...})
    save: function (tool, title, data) {
      return rest("POST", TABLE, { tool: tool, title: title, data: data || {} })
        .then(function (r) { return r && r[0]; });
    },
    rename: function (id, title) {
      return rest("PATCH", TABLE + "?id=eq." + encodeURIComponent(id), { title: title });
    },
    remove: function (id) {
      return rest("DELETE", TABLE + "?id=eq." + encodeURIComponent(id), null, "return=minimal");
    }
  };

  /* ---------- Garde de pages ---------- */
  function nextTarget() {
    var m = /[?&]next=([^&]+)/.exec(location.search);
    if (!m) return null;
    try {
      var v = decodeURIComponent(m[1]);
      return /^[\w\-]+\.html$/.test(v) ? v : null; // uniquement un fichier du même site
    } catch (e) { return null; }
  }
  function requireAuth() {
    if (readSession()) return true;
    var here = (location.pathname.split("/").pop() || "");
    location.replace((P.login || "connexion.html") + (here ? "?next=" + encodeURIComponent(here) : ""));
    return false;
  }
  function redirectIfLoggedIn() {
    if (!readSession()) return false;
    location.replace(nextTarget() || P.dashboard || "dashboard.html");
    return true;
  }

  function getUser() {
    var s = readSession();
    return s && s.user ? s.user : null;
  }
  function displayName() {
    var u = getUser();
    if (!u) return "";
    var n = u.user_metadata && u.user_metadata.full_name;
    return (n && n.trim()) || (u.email ? u.email.split("@")[0] : "");
  }

  window.BT = {
    isConfigured: isConfigured,
    getSession: readSession,
    getUser: getUser,
    displayName: displayName,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    store: store,
    requireAuth: requireAuth,
    redirectIfLoggedIn: redirectIfLoggedIn,
    nextTarget: nextTarget,
    SESSION_KEY: KEY
  };
})();
