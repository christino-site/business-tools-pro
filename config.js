/* Business Tools Pro — configuration
 * Renseignez ces deux valeurs (Supabase > Project Settings > API).
 * La clé "anon" est publique : elle peut figurer dans le code du site.
 * NE METTEZ JAMAIS la clé "service_role" ici.
 */
window.BT_CONFIG = {
  SUPABASE_URL: "https://VOTRE-PROJET.supabase.co",
  SUPABASE_ANON_KEY: "VOTRE_CLE_ANON_PUBLIQUE",

  // Table qui contient les enregistrements des utilisateurs (voir supabase-setup.sql)
  TABLE: "user_items",

  // Pages du site (relatives à la racine)
  PAGES: {
    home: "index.html",
    login: "connexion.html",
    signup: "inscription.html",
    dashboard: "dashboard.html"
  },

  // Outils connus : la clé sert de valeur "tool" à l'enregistrement.
  // Un outil absent de cette liste s'affiche quand même (avec sa clé comme nom).
  TOOLS: [
    { key: "benefice", label: "Calculateur de bénéfice", icon: "📊" },
    { key: "facture", label: "Facture & devis", icon: "🧾" },
    { key: "whatsapp-message", label: "Générateur de message WhatsApp", icon: "💬" },
    { key: "convertisseur", label: "Convertisseur de mesures", icon: "📏" },
    { key: "whatsapp-lien", label: "Lien WhatsApp direct", icon: "🔗" },
    { key: "cv-lettre", label: "CV & Lettre de motivation", icon: "📄" }
  ]
};
