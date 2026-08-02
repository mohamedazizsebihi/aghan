# Prompt d'audit — 4 agents experts

**Comment s'en servir :** ouvrir une nouvelle session dans ce dépôt et dire :

> Exécute `docs/AUDIT-PROMPT.md`.

Rien à copier-coller. Ce document est autoportant : il contient tout le contexte
nécessaire à quelqu'un qui découvre le projet.

Dernière mise à jour : **2 août 2026**. Si des correctifs ont été appliqués
depuis, mettre à jour la section « Défauts déjà connus » avant de lancer, sinon
les agents perdront du temps à redécouvrir ce qui est déjà identifié.

---

## Instructions à l'assistant

1. Lancer **4 agents `general-purpose` en parallèle**, dans **un seul message**
   (4 appels à l'outil Agent en une fois). Ne pas les lancer en série.
2. Copier chaque bloc « Prompt » ci-dessous **verbatim** comme prompt de l'agent
   correspondant, en y ajoutant le **Contexte commun**, les **Règles de
   sécurité** et le **Format de sortie**.
3. Ne rien modifier soi-même pendant que les agents tournent.
4. À réception des 4 rapports : **dédoublonner**, **fusionner**, **classer par
   gravité**, séparer VERIFIED de SUSPECTED, et présenter un plan de correction
   ordonné. Ne rien corriger sans validation.
5. Si un agent échoue (limite de session, erreur API), le dire franchement et ne
   **jamais** inventer ni supposer ses résultats.

---

## Contexte commun (à inclure dans les 4 prompts)

> Tu audites une application de commande pour un restaurant, en production.
> Dépôt : `c:\Users\USER\Desktop\aziz\afghan-cyrine`
>
> **« Bagh-e-Kabul »** — Next.js 16 (App Router, Turbopack), React 19,
> Prisma 7 + SQLite (adaptateur `better-sqlite3`, mode WAL), Tailwind v4,
> Stripe, Zustand. Déployé en **un seul conteneur Node** derrière nginx +
> certbot (`docker-compose.yml`). Pipeline AR annexe : Meshy AI génère des
> modèles 3D de plats, servis depuis un dossier `uploads/` hors `public/`.
>
> Trois parcours client : **livraison**, **à emporter**, et **sur place**
> (`DINE_IN`) — ce dernier déclenché par un QR code collé sur chaque table, qui
> ouvre `/menu?table=N`. Un back-office `/admin` protégé par cookie de session.
>
> Conventions du projet, à respecter dans tes recommandations : les commentaires
> expliquent le *pourquoi*, pas le *quoi* ; l'état partagé entre routes est
> épinglé sur `globalThis` (voir `src/lib/prisma.ts`) ; les valeurs dérivées
> sont préférées aux `useState` initialisés depuis un effet (voir
> `src/hooks/use-hydrated.ts`).
>
> **Trois autres agents auditent d'autres domaines en parallèle. Reste
> strictement dans le tien** pour éviter les doublons.

---

## Règles de sécurité (à inclure dans les 4 prompts — non négociables)

> 1. **Ne modifie, ne crée et ne supprime AUCUN fichier.** Audit uniquement.
> 2. **Un serveur de dev appartenant à l'UTILISATEUR tourne sur
>    `http://localhost:3000`.** Ne l'arrête pas, ne le relance pas, ne lance pas
>    `npm run dev`. Vérifier le port avant toute action.
> 3. **N'écris jamais dans la base.** Aucun POST / PATCH / PUT / DELETE sur
>    l'API, aucune écriture SQL. Lecture seule : `prisma/dev.db`, en important
>    `better-sqlite3` par chemin absolu depuis `node_modules`, ouvert avec
>    `{ readonly: true }`. **Les vraies commandes et tables de l'utilisateur s'y
>    trouvent et ont déjà été endommagées deux fois.** Aucun nettoyage
>    « automatique » de données, sous aucun prétexte.
> 4. Ne lance ni `prisma migrate`, ni `prisma db push`, ni `prisma generate`,
>    ni `docker compose`.
> 5. **Autorisé :** lire, `grep`, `npx tsc --noEmit`, `npm run build`,
>    `npm ls`, `npm audit`, et des requêtes **GET** en lecture seule.
> 6. **Vérifie avant d'affirmer.** Étiqueter chaque constat **VERIFIED** (tu l'as
>    prouvé, avec la preuve) ou **SUSPECTED** (raisonnement seul). Ne jamais
>    présenter une hypothèse comme un fait.

---

## Format de sortie (à inclure dans les 4 prompts)

> Une liste classée, du plus grave au moins grave. Pour chaque constat :
> **gravité (P0 / P1 / P2)**, titre en une ligne, `fichier:ligne`, ce qui se
> passe réellement et **le scénario concret qui le déclenche**, puis un
> correctif proposé. Étiquette VERIFIED ou SUSPECTED.
>
> Concis et spécifique. Ne pas reformuler le code, ne pas remplir. Si une
> catégorie est saine, le dire en une ligne — c'est une information utile.
> Signaler aussi le **code mort** et les **exports jamais utilisés ailleurs**.

---

## Agent 1 — Argent et cycle de vie des commandes

**Prompt :**

```
YOUR DOMAIN — money and the order lifecycle. Audit ONLY this.

- src/lib/orders.ts (buildOrderFromCart, createOrder, order-number collision retry)
- src/lib/validators.ts (cashOrderSchema, cardOrderSchema, base schema, superRefine)
- src/app/api/orders/route.ts, src/app/api/orders/[id]/route.ts
- src/app/api/checkout/session/route.ts, src/app/api/stripe/webhook/route.ts
- src/lib/stripe.ts, src/lib/constants.ts (DELIVERY_FEE_CENTS, CURRENCY)
- src/components/checkout/** (CheckoutForm, FulfillmentToggle, PaymentMethodChoice)
- src/store/cart-store.ts
- Order / OrderItem in prisma/schema.prisma
- src/components/admin/OrderStatusSelect.tsx, PaymentStatusButton.tsx

BUSINESS RULES that must actually be enforced:
- Prices are ALWAYS re-derived server-side from the Dish table; client prices never trusted.
- Contact details (name/email/phone) are OPTIONAL only for DINE_IN paid by CASH.
  Required for every other combination. The contact columns are nullable.
- DINE_IN is CASH-only; cardOrderSchema must reject DINE_IN.
- tableNumber is required for DINE_IN and forbidden for DELIVERY/PICKUP.
- The delivery fee applies to DELIVERY only.
- Orders store snapshots (nameSnapshot / priceSnapshot; tableNumber is a plain Int, no FK).

HUNT FOR: money correctness (rounding, totals, fee application, currency);
order state-machine holes (illegal transitions, terminal states reversed, the
webhook resurrecting a cancelled order); races and idempotency (double submit,
concurrent PATCH, webhook retries and replays); validation bypasses; error paths
leaving orphaned or inconsistent rows; TypeScript types that lie about
nullability; UI and server disagreeing about a rule.
```

## Agent 2 — Tables, QR codes et session sur place

**Prompt :**

```
YOUR DOMAIN — tables, QR codes and the dine-in session. Audit ONLY this.

- src/lib/table-qr.ts (base URL resolution, parseTableParam, MAX_TABLE_COUNT, clampTableCount)
- src/store/table-session-store.ts (localStorage session, 3h TTL, activeTableNumber)
- src/components/menu/TableSessionCapture.tsx
- src/app/(site)/menu/page.tsx (reads ?table=, validates against the Table model)
- src/app/api/tables/route.ts, src/app/api/tables/[id]/route.ts
- src/components/admin/TableManager.tsx, src/components/admin/TableQrCodes.tsx
- src/app/admin/(protected)/tables/page.tsx
- Table model in prisma/schema.prisma; the @media print block in src/app/globals.css
- dine-in parts of src/components/checkout/CheckoutForm.tsx and FulfillmentToggle.tsx

RULES that must actually be enforced:
- The Table model is the source of truth for which table numbers exist. A dine-in
  order is refused unless an ACTIVE table with that number exists — checked in
  src/lib/orders.ts, not in the Zod schema, because the schema is pure and synchronous.
- Table creation is APPEND-ONLY: numbers continue from the highest existing one and
  are NEVER reused or renumbered, because a printed card says "Table 3" and must keep
  meaning the same table. PATCH accepts only isActive — there must be no renumbering
  path anywhere in the API or UI.
- Only ACTIVE tables get printed QR codes.
- A ?table= value that is malformed, out of range, repeated (?table=1&table=2),
  unknown or inactive must be ignored: the customer gets the ordinary takeaway menu.
- The table session must expire (3h), so a Friday scan cannot file a Sunday delivery
  order as dine-in.

HUNT FOR: any way to order for a table that should not accept orders; any way an
existing table's QR meaning could change; sessions leaking across customers,
devices or time; hydration mismatches from reading localStorage or Date.now()
during render; races in table creation (concurrent "add"); off-by-one and
boundary errors on table numbers; admin UI disagreeing with the server; print
and layout correctness.
```

## Agent 3 — Temps réel, authentification et exposition de données

**Prompt :**

```
YOUR DOMAIN — real-time streams, the auth boundary, and data exposure. Audit ONLY this.

- src/lib/order-events.ts (in-process pub/sub pinned on globalThis; per-order + global channels)
- src/app/api/orders/[id]/stream/route.ts, src/app/api/orders/[id]/status/route.ts
- src/app/api/admin/orders/stream/route.ts (admin SSE, signal-only)
- src/hooks/use-order-tracking.ts, src/hooks/use-order-alert-sound.ts
- src/components/orders/** (OrderTracker, MyOrdersList, RememberOrder)
- src/components/admin/OrdersLiveFeed.tsx
- src/store/my-orders-store.ts
- src/lib/order-tracking.ts (PUBLIC_ORDER_SELECT, per-fulfillment-type steps)
- src/lib/auth.ts, src/proxy.ts, src/lib/api-limits.ts, src/lib/rate-limit.ts, src/lib/http.ts
- EVERY route under src/app/api/** — check each one's authentication individually

RULES that must actually be enforced:
- Public tracking endpoints expose ONLY PUBLIC_ORDER_SELECT: never customerName,
  customerEmail, customerPhone, deliveryAddress or stripeSessionId. Server Components
  must not pass full order rows as props to Client Components either — that serialises
  them into the RSC payload sent to the browser.
- GET /api/orders/[id] is admin-only (it was previously an unauthenticated PII leak).
- The admin SSE stream requires an admin session and carries no order data at all.
- src/proxy.ts guards only /admin/* pages. Every /api/* route must check auth by hand —
  find any that forgot.
- Rate limiting is two-stage: a coarse per-IP flood gate (60/15min) before the body is
  read, then per-TABLE for dine-in and per-IP otherwise (10/15min). Dine-in is keyed by
  table because a whole restaurant shares one public IP over WiFi.
- Streams must not leak memory, sockets or timers: unsubscribe on abort, heartbeats,
  closure on terminal state, connection caps.

HUNT FOR: any PII reaching an unauthenticated caller (including via RSC payloads
and server-rendered HTML — inspect the actual bytes); missing auth checks; SSE
listener / socket / timer leaks; EventSource reconnect storms; the globalThis
registry misbehaving across HMR or separate module instances; rate-limit
bypasses, or accidental denial of service for legitimate customers; unbounded
memory growth; races between publish and subscribe.

ALSO REQUIRED: a table of EVERY route under src/app/api/** with its auth status —
public-by-design / admin-required / MISSING.
```

## Agent 4 — Ops, build, déploiement et stratégie

**Prompt :**

```
YOUR DOMAIN — build, deployment, data layer, and cross-cutting strategy. Audit ONLY this.

- Dockerfile, docker-compose.yml, docker-compose.dev.yml, .dockerignore,
  docker/docker-entrypoint.sh
- nginx/conf.d/default.conf and nginx/ generally
- .env.example, .env.production.example, next.config.ts, prisma.config.ts, package.json
- src/lib/prisma.ts (WAL enablement, busy timeout, client singleton)
- prisma/schema.prisma and prisma/migrations/** — migration safety, indexes, data-loss risk
- prisma/seed.ts, scripts/**
- src/lib/uploads.ts, src/app/api/uploads/[...path]/route.ts,
  src/app/api/dishes/[id]/image/route.ts
- src/lib/ar-generation.ts, src/lib/meshy.ts, src/lib/glb.ts, src/lib/ar-scale.ts,
  src/app/api/dishes/[id]/ar-generate/route.ts
- src/app/globals.css print rules; overall page and query performance

HUNT FOR: build-time versus runtime configuration mistakes; anything in the image
that differs from what runs in dev; migration hazards (data loss, table rebuilds,
missing indexes on columns actually queried); SQLite concurrency and backup
correctness (the WAL sidecar files); container correctness (permissions, volumes,
healthcheck, entrypoint ordering, non-root user); nginx misconfiguration (headers,
timeouts, buffering, body size, TLS); secret handling and leakage; path traversal
and unbounded resource use in the upload and file-serving routes; the AR
pipeline's failure modes and cost controls; dependency and supply-chain risk.

END WITH a short STRATEGIC section: the three things most likely to break first
in real service, and why.
```

---

## Défauts déjà connus au 2 août 2026

À inclure dans les 4 prompts, précédés de : *« Already known — do not merely
re-report these; only deepen them if you find something genuinely new. »*

| # | Défaut | Domaine |
|---|---|---|
| **P0-1** | `NEXT_PUBLIC_*` est figé à la **compilation**, et `.dockerignore` exclut `.env*` : les URL de redirection Stripe (`success_url` / `cancel_url`) sont gravées sur `http://localhost:3000` dans l'image Docker. Vérifié dans le chunk serveur émis. Le client paie puis atterrit sur une adresse morte. | 1 et 4 |
| **P0-2** | Le webhook Stripe est le **seul** chemin qui passe `paymentStatus` à `PAID`. `success_url` transporte `session_id={CHECKOUT_SESSION_ID}` que la page de confirmation ne lit jamais — la réconciliation de secours est déjà à moitié construite et inutilisée. | 1 |
| **P1** | **Zone de silence QR sous la norme** en impression individuelle : 3,07 modules pour 4 requis. `marginSize={0}`, et le blanc vient d'un padding CSS qui ne suit pas l'agrandissement à 70 mm. | 2 |
| **P1** | Niveau de correction d'erreur **`M`** ; `Q` serait plus robuste sur une table grasse. | 2 |
| **P1** | Supprimer la table **au numéro le plus haut** libère ce numéro pour le prochain ajout. Seule fenêtre de réutilisation restante ; annoncée dans la confirmation de suppression. | 2 |
| **P1** | La génération AR peut se **bloquer définitivement** : `arGenerationTaskId` n'est effacé que sur succès ou échec rapporté par Meshy. Une erreur réseau laisse le plat incapable de regénérer, sans aucun bouton de réinitialisation. | 4 |
| **P2** | `FALLBACK_BASE_URL` est codé en dur à `http://192.168.1.11:3000`. | 2 |
| **P2** | Le tableau de bord `/admin` n'est **pas** temps réel : statistiques et commandes récentes figées jusqu'à rafraîchissement. | 3 |
| **P2** | Les QR sont regénérés à chaque `router.refresh()` de `/admin/tables` — sensible au-delà d'une quarantaine de tables. | 2 |

## Jamais vérifié physiquement

À signaler aux agents pour qu'ils ne le présentent pas comme validé :

- **Le rendu papier des QR** et le **scan réel depuis un téléphone**. Tout ce qui
  est affirmé sur l'impression vient du CSS produit et de calculs, pas d'une
  feuille imprimée.
- **Le comportement derrière nginx en production** (SSE, tampons, timeouts) :
  testé en dev direct uniquement.
- **La reconnexion `EventSource`** après une vraie coupure réseau.
- **Le bip sonore** (audio navigateur, non testable en ligne de commande).
- **La purge côté client** des commandes terminées (localStorage + React).
