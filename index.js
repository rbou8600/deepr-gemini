/**
 * DeepR — Proxy Cloudflare Worker vers l'API Gemini
 *
 * Reçoit { prompt: "..." } depuis le frontend, interroge Gemini,
 * et renvoie { text: "..." }.
 *
 * IMPORTANT : la clé API n'est JAMAIS écrite ici. Elle est lue depuis
 * une variable d'environnement (env.GEMINI_API_KEY) configurée comme
 * "secret" dans le tableau de bord Cloudflare. Voir le README.
 */

const MODEL = "gemini-2.5-flash"; // modèle rapide, adapté à la traduction/correction

// En prod, remplace "*" par l'origine exacte de ton frontend
// (ex: "https://tonpseudo.github.io") pour restreindre l'accès.
const ALLOWED_ORIGIN = "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Méthode non autorisée. Utilise POST." }, 405);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse(
        { error: "GEMINI_API_KEY manquante côté serveur. Configure-la dans Settings → Variables and Secrets." },
        500
      );
    }

    let prompt;
    try {
      const body = await request.json();
      prompt = body?.prompt;
    } catch {
      return jsonResponse({ error: "Corps de requête JSON invalide." }, 400);
    }

    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "Le champ 'prompt' (string) est requis." }, 400);
    }

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              // Demande directement du JSON brut à Gemini : évite les ```json
              // autour de la réponse et simplifie le parsing côté frontend.
              responseMimeType: "application/json",
            },
          }),
        }
      );

      const data = await geminiRes.json();

      if (!geminiRes.ok) {
        const message = data?.error?.message || "Erreur retournée par l'API Gemini.";
        return jsonResponse({ error: message }, geminiRes.status);
      }

      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";

      if (!text) {
        // Cause fréquente : le modèle a été bloqué par un filtre de sécurité.
        const reason = candidate?.finishReason || "inconnue";
        return jsonResponse({ error: `Réponse vide de Gemini (raison : ${reason}).` }, 502);
      }

      return jsonResponse({ text });
    } catch (err) {
      return jsonResponse({ error: err.message || "Erreur interne du proxy." }, 500);
    }
  },
};
