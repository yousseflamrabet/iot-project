# SME — Marsa Maroc (Simulation IoT) · V2.1 corrigée

**Démonstrateur pédagogique autonome**, inspiré du CPS 12/DEPA/2026 et de la spécification fonctionnelle reçue. **Ce n'est pas une solution industrielle prête pour une réception contractuelle.** Tous les relevés sont artificiels. Aucun équipement ni serveur Marsa Maroc n'est connecté.

## Version 2.1 — contrôle qualité du dashboard

Cette version corrige le panneau **Compteurs > Détails** qui disparaissait après environ trois secondes. Les détails s'ouvrent maintenant dans une fenêtre indépendante, restent visibles jusqu'à leur fermeture et continuent à recevoir les mises à jour.

Autres correctifs : boutons préservés lors du rafraîchissement, sélection de compteur pour la panne conservée, trois exports JSON différents, alertes acquittées sans être confondues avec des alertes résolues, calculs d'historique plus fiables et ouverture du navigateur après le démarrage sous Windows. Voir **`docs/AUDIT_FONCTIONNEL_V2_1.md`** pour l'audit de chaque rubrique et les tests.

**Si tu avais déjà la V2 :** décompresse la V2.1 dans un dossier distinct, ferme le serveur V2 avant de lancer le nouveau pour éviter un conflit sur le port 8088. Tu peux garder la base `sme_demo.sqlite3` de l'ancienne version en la copiant dans le nouveau dossier (migration automatique des alertes), ou ne pas la copier pour démarrer avec un historique vide.

## Prérequis

- Windows 10/11, Linux ou macOS.
- **Python 3.10 ou supérieur**, installé et accessible depuis le terminal.
- Un navigateur moderne.
- **Aucune bibliothèque externe, aucun `pip install`, aucun Docker, aucun accès Internet requis.**

## Démarrer

Depuis le dossier extrait :

Windows : double-cliquer sur `start_windows.bat` (ou `py run.py`).

Linux/macOS : `python3 run.py`.

Ouvrir **http://127.0.0.1:8088** (Windows ouvrira automatiquement le navigateur).

**Laboratoire de simulation physique** — ouvrir aussi **http://127.0.0.1:8088/laboratoire.html** dans un deuxième onglet. Le laboratoire et le dashboard central lisent **la même base de données**. Laisser les deux onglets visibles côte à côte pour la démonstration.

Au premier démarrage, un fichier `sme_demo.sqlite3` est créé. Laisser tourner le service environ 15 secondes pour accumuler des échantillons. Pour arrêter : `Ctrl+C`.

## Démonstration : éteindre ou démarrer une machine

1. Lancer le serveur avec `start_windows.bat`.
2. Ouvrir le **Tableau électrique virtuel** depuis le menu de l'application ou via `/laboratoire.html`.
3. Choisir **PT Y**, puis cliquer sur **DÉMARRER** pour la **Grue portique**.
4. Le programme ajuste immédiatement les registres simulés du compteur **P01-M01**. La réponse à une **vraie requête Modbus TCP locale (FC03)** est alors modifiée. Le collecteur enregistre tout de suite la nouvelle mesure dans SQLite.
5. Observer la hausse de puissance et de courant dans le laboratoire et dans le dashboard général (actualisation environ toutes les 3 secondes).
6. Cliquer sur **ARRÊTER** : la puissance redescend à la consommation fictive de veille.
7. Essayer les scénarios **Activité normale**, **Pointe d'activité**, **Mode nuit**, et **Arrêt des charges pilotables** : ils pilotent 24 charges réparties sur les six postes.
8. Ouvrir **Compteurs > P01-M01 > Détails** dans le dashboard pour consulter l'historique. La page **Alertes** montrera les dépassements du seuil fictif de 58 kW.

Note : les 24 charges contrôlables sont une **hypothèse pédagogique inventée**, sans référence à un inventaire réel de moteurs/portiques du port. Les autres compteurs gardent des consommations synthétiques non commandables. Aucune fonction d'écriture Modbus sur des équipements réels n'est implémentée.

## Fonctions livrées

- **6 passerelles Modbus TCP** simulées, sur 127.0.0.1 ports 15021 à 15026, adressées par Unit ID.
- **58 compteurs** répartis entre les postes PT Y, PT X, PT Z, PT 4, PT 1 et PT 7. Sur ce total, 12 compteurs sont marqués « existants » à PT 1 ; les 46 autres sont « nouveaux ».
- **Serveur Modbus TCP fonction 03** : huit grandeurs en Float32 big-endian, 16 registres au total, sans fonctions d'écriture.
- **Tableau électrique virtuel indépendant** dans le navigateur : six armoires fictives, 24 charges (moteurs, pompes, éclairage, etc.), interrupteurs et scénarios. Les commandes de simulation sont envoyées à une **API HTTP locale dédiée**, puis modifient les données remontées par les serveurs Modbus TCP ; ce ne sont pas des commandes Modbus de contrôle.
- **Couplage réel entre les deux interfaces** : action sur charge → simulation de mesure → lecture Modbus TCP locale → base SQLite → dashboards. Les compteurs restants fonctionnent sans commande.
- **Courbe temporelle et journal des actions** dans le laboratoire, échantillonnage UI toutes les 2 secondes.
- **Collecteur réel Modbus sur loopback**, avec détection des échecs de communication et stockage SQLite.
- **API HTTP locale**, tableau de bord responsive, inventaire, détails persistants des compteurs, courbe historique, indicateurs illustratifs, liste et historique des alertes, export CSV et trois rapports JSON distincts.
- **Test de panne** depuis la page Système pour simuler une perte de communication et son rétablissement.
- **Journal d'audit de démonstration** des actions sur alertes et simulation.

## Détail du mapping Modbus simulé

Lecture `FC03`, offset 0, count 16 (2 registres par Float32) :

| Offset registres | Grandeur | Unité |
|---|---|---|
| 0–1 | Tension | V |
| 2–3 | Courant | A |
| 4–5 | Puissance active | kW |
| 6–7 | Énergie active cumulée | kWh |
| 8–9 | Facteur de puissance | — |
| 10–11 | Fréquence | Hz |
| 12–13 | THD tension | % |
| 14–15 | THD courant | % |

**Attention :** ce mapping est inventé uniquement pour la simulation. Ne jamais utiliser ces offsets sur de vrais compteurs sans documentation du fabricant, protocole et validation de site.

## Écart documentaire à clarifier

Le CPS prévoit 46 centrales neuves et 12 compteurs existants, soit 58 compteurs, mais son inventaire par poste totalise 59 emplacements. Pour rendre la simulation cohérente, nous avons représenté **9 points au PT 4 au lieu des 10 listés dans cet inventaire**. Ce choix est arbitraire et **ne constitue pas une correction du CPS** ; une confirmation écrite de la DEPA serait nécessaire sur un marché réel.

## Limitations importantes

Le projet NE livre PAS : équipements physiques, montage électrique, TC, étalonnage, câblage, infrastructure réseau réelle, mise en service sur site, cybersécurité certifiée, LDAP/Active Directory, authentification et rôles, HTTPS industriel, plan de sauvegarde, disponibilité contractuelle, génération PDF/Excel avancée, rapports périodiques automatiques, graphiques de Sankey/Pareto, régression linéaire, calcul ISO 50001 officiellement validé, formation sur site ou 24 mois de maintenance. Les valeurs SER/IPE sont fictives et ne prouvent aucune conformité ISO 50001.

Les valeurs nominales et facteurs de puissance du tableau virtuel sont **inventés** pour la démonstration ; ils ne proviennent pas du CPS. Il n'y a pas de vrai schéma de protection, ni de calcul de courts-circuits, ni de modèle dynamique de moteur. Le mot « commande » désigne seulement un **changement d'état logiciel local**.

Ce logiciel doit fonctionner **uniquement sur `127.0.0.1`** ; il n'est pas conçu pour être exposé à un réseau non fiable.

## Tests

`python -m unittest discover -s tests -v` — **11 tests unitaires**.

Les **12 tests complémentaires de navigation et d'interaction** ont été réalisés pendant l'audit de cette version. Le détail et le protocole de vérification manuelle figurent dans `docs/AUDIT_FONCTIONNEL_V2_1.md`. Les tests d'interface utilisent un navigateur automatisé non inclus dans les prérequis de lancement.

## Structure

- `run.py` : lancement.
- `app/modbus_config.py` : inventaire des postes et ports de simulation.
- `app/plant.py` : état des armoires et charges fictives, calcul des mesures physiques simplifiées, intégration de l'énergie.
- `app/modbus.py` : serveurs Modbus TCP, registres synthétiques et client Modbus.
- `app/storage.py` : base SQLite, mesures et alertes.
- `app/server.py` : collecte, API et serveur HTTP local.
- `web/` : dashboard de supervision et **nouvelle interface indépendante de laboratoire** (`laboratoire.html`, `.css`, `.js`).
- `docs/specification_fournie.md` : copie de la spécification Markdown fournie dans la conversation.

## Comment étendre le prototype

Pour utiliser de **vrais compteurs**, il faut un projet séparé avec documentation matérielle et cartographies Modbus propres à chaque modèle, mesures de sécurité, autorisations du propriétaire, réseau industriel approuvé, validation des formules et essais de réception. Ne connectez pas directement ce démonstrateur à des installations portuaires.
