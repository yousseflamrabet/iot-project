# Guide de démonstration — Laboratoire IoT et supervision SME

> **PROTOTYPE PÉDAGOGIQUE** — uniquement des signaux, réseaux, machines et mesures simulés. Aucun équipement réel Marsa Maroc n'est connecté. La liste des machines, leurs puissances nominales, les scénarios et les valeurs électriques ont été inventés pour l'exercice. Le CPS décrit des points de comptage, pas cet inventaire de machines virtuelles.

## Préparer la démonstration (Windows)

1. Extraire le dossier ZIP en entier.
2. Vérifier que Python 3.10+ est installé (`py --version`).
3. Double-cliquer `start_windows.bat`. Garder la fenêtre de commande ouverte.
4. Ouvrir dans **deux onglets** :
   - **Supervision SME** : http://127.0.0.1:8088
   - **Laboratoire physique virtuel** : http://127.0.0.1:8088/laboratoire.html
5. Laisser le simulateur enregistrer quelques mesures.

## Démonstration principale : moteur électrique → Modbus → dashboard

1. Dans le **laboratoire**, sélectionner **PT Y**.
2. Vérifier la carte **Grue portique / P01-M01** : l'interrupteur est arrêté, donc le compteur mesure une puissance proche de zéro (consommation de veille fictive).
3. Dans le **dashboard SME**, sélectionner le même compteur P01-M01 sur la page Compteurs. Vous pouvez consulter la courbe d'historique avant/après.
4. Sur le laboratoire, cliquer sur **▶ DÉMARRER**.
5. La puissance et le courant augmentent dans le tableau virtuel. Le serveur simulé met à jour ses registres Modbus **fonction 03** ; le collecteur réalise une lecture TCP locale puis enregistre la mesure en base SQLite.
6. Observer l'augmentation sur le dashboard après sa prochaine actualisation (environ 3 secondes). Une **alerte de puissance élevée** peut apparaître, selon le seuil fictif fixé à 58 kW par compteur.
7. Cliquer sur **■ ARRÊTER**. La mesure redescend et l'alerte de puissance devrait se clôturer à la prochaine lecture.
8. Dans le laboratoire, comparer la courbe de puissance et l'historique des commandes.

## Scénarios globaux

- **Activité normale** : rétablit l'état initial des machines fictives.
- **Pointe d'activité** : démarre les 24 charges contrôlables réparties sur les six postes.
- **Mode nuit** : conserve les six charges d'éclairage fictives, arrête les autres charges commandables.
- **Arrêt des charges pilotables** : arrête les 24 charges fictives. **Les 34 autres points de mesure restent actifs** car leurs charges sont autonomes et ne sont pas commandables depuis le laboratoire.

## Point technique à expliquer au professeur

- Il ne s'agit pas d'une interface avec des valeurs aléatoires directement dans le navigateur.
- **La simulation côté Python fait varier les grandeurs** des compteurs en fonction de l'état des interrupteurs virtuels.
- **Le protocole Modbus TCP est effectivement exécuté en local** par six passerelles sur les ports 15021–15026. Le service d'acquisition lit les registres via socket TCP et les sauvegarde dans SQLite.
- **L'interface de supervision lit la base de données via l'API HTTP**, pas l'état des boutons du laboratoire ; les deux applications sont donc logiquement séparées.
- Pour les commandes des interrupteurs, nous utilisons **l'API HTTP du simulateur** et non l'écriture de registres Modbus de vrais appareils. Aucun contrôle de matériel n'est prévu.

## Paramètres fictifs et limites

- 58 compteurs (46 nouveaux + 12 existants à PT 1), selon la répartition de la simulation ; le CPS comporte une divergence de point de comptage entre inventaire et bordereau.
- 24 machines/charges commandables **inventées** : 4 pour chacun des six postes, associées aux compteurs virtuels d'Unit ID 1 à 4.
- Valeurs approximatives conçues pour une démonstration et non un dimensionnement électrique.
- Pas de courant de démarrage physique réaliste, de protections électriques, de calcul des courts-circuits ou de validation ISO 50001.
- Le système doit rester sur `127.0.0.1` et ne doit pas être utilisé pour piloter un port ou une armoire électrique réelle.
