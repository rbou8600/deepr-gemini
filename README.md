# DeepR — Gemini Edition

Traducteur 3 langues (IT/FR/EN) + correcteur grammatical, propulsé par l'API Gemini de Google,
avec une clé API protégée derrière un Worker Cloudflare.

## Structure

```
deepr-gemini/
├── frontend/
│   └── index.html          → l'app (à héberger où tu veux : GitHub Pages, Cloudflare Pages…)
└── worker/
    ├── src/index.js         → le proxy qui appelle Gemini (déployé sur dash.cloudflare.com)
    ├── wrangler.toml        → config Cloudflare
    ├── .dev.vars.example    → modèle pour tester en local
    └── .gitignore
```

Le frontend ne contient **aucune clé API**. Il appelle ton Worker, qui lui seul connaît la clé
Gemini (stockée comme secret chiffré côté Cloudflare). C'est l'architecture à utiliser dès
qu'une app tourne dans un navigateur : toute clé mise directement dans du JS/HTML est visible
par n'importe qui ouvre l'inspecteur du navigateur ou consulte le code sur GitHub.

⚠️ **Concernant la clé que tu m'as donnée dans le chat** : les clés Gemini (Google AI Studio)
commencent normalement par `AIzaSy...`. Celle que tu as collée a un format différent
(`AQ.Ab8...`) — vérifie que c'est bien la bonne en allant sur
[aistudio.google.com/apikey](https://aistudio.google.com/apikey). Je ne l'ai mise dans aucun
fichier : tu la colleras toi-même dans le dashboard Cloudflare à l'étape 3.

---

## 1. Mettre le code sur GitHub

```bash
cd deepr-gemini
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/deepr-gemini.git
git push -u origin main
```

(Crée le repo vide au préalable sur github.com — public ou privé, peu importe puisqu'aucun
secret n'y est commité.)

## 2. Déployer le Worker depuis dash.cloudflare.com

1. Va sur [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application**.
2. Choisis **Import a repository**, connecte ton compte GitHub, sélectionne `deepr-gemini`.
3. Dans **Root directory**, indique `worker` (c'est là que se trouve `wrangler.toml`).
4. Laisse la commande de déploiement par défaut (`npx wrangler deploy`) et clique **Save and Deploy**.
5. Une fois déployé, Cloudflare te donne une URL du type :
   `https://deepr-gemini-proxy.<ton-sous-domaine>.workers.dev`

## 3. Ajouter ta clé Gemini comme secret (jamais dans le code)

Dans le Worker que tu viens de créer :

1. **Settings → Variables and Secrets** (ou *Environment variables* selon la version du dashboard).
2. **Add** → nom `GEMINI_API_KEY`, valeur = ta clé → type **Secret** (chiffré) → **Save and deploy**.

À chaque push sur GitHub, Cloudflare redéploie automatiquement le Worker — le secret reste en
place, il n'a pas besoin d'être redéfini.

## 4. Brancher le frontend sur le Worker

Dans `frontend/index.html`, remplace la ligne :

```js
const WORKER_URL = "https://deepr-gemini-proxy.TON-SOUS-DOMAINE.workers.dev";
```

par l'URL réelle obtenue à l'étape 2. Recommit/push.

## 5. Héberger le frontend

N'importe quelle option fonctionne, par exemple **GitHub Pages** :

1. Sur GitHub, **Settings → Pages** → Source : branche `main`, dossier `/frontend` (ou déplace
   `index.html` à la racine d'un repo dédié si tu préfères).
2. Ton app sera servie sur `https://TON-PSEUDO.github.io/deepr-gemini/`.

(Tu peux aussi héberger ce même `index.html` sur Cloudflare Pages, dans le même dashboard.)

## 6. Restreindre l'accès au Worker (recommandé)

Une fois ton frontend en ligne, ouvre `worker/src/index.js` et remplace :

```js
const ALLOWED_ORIGIN = "*";
```

par l'origine exacte de ton frontend, ex. `"https://TON-PSEUDO.github.io"`. Cela empêche
n'importe quel autre site d'utiliser ton Worker (et donc ta clé) à ta place.

---

## Test en local (optionnel)

```bash
cd worker
npm install -g wrangler   # si pas déjà installé
cp .dev.vars.example .dev.vars
# édite .dev.vars et colle ta vraie clé (ce fichier est ignoré par git)
wrangler dev
```

Le Worker tournera sur `http://localhost:8787` — pointe temporairement `WORKER_URL` vers
cette adresse pour tester avant de déployer.
