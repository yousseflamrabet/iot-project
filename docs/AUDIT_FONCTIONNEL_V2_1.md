# Audit fonctionnel — SME Marsa Maroc, simulation V2.1

**Objet :** vérifier les fonctions réellement développées dans le démonstrateur V2, corriger les interactions défectueuses, expliciter ce qui n'est pas une solution industrielle.

**Nature du projet :** simulation locale et pédagogique. Les chiffres, machines, charges et seuils sont fictifs. Il n'existe aucune connexion aux installations du port d'Agadir. Les 58 compteurs viennent de l'hypothèse de simulation documentée dans le README.

## 1. Anomalies de la V2 identifiées et corrigées

| Anomalie | Cause observée | Correction V2.1 |
|---|---|---|
| **Détails apparaît puis disparaît** | Le rafraîchissement toutes les 3 secondes reconstruisait `#page` et supprimait le panneau de détail qui y avait été ajouté | Fenêtre de détail indépendante de `#page`, conservée tant qu'on ne la ferme pas ; ses huit valeurs et son historique sont rafraîchis en arrière-plan |
| **Boutons parfois difficiles à cliquer** | Des boutons et éléments HTML étaient recréés périodiquement pendant les clics | Mise à jour des cellules/valeurs existantes sur le dashboard et des commandes existantes du laboratoire sans recréer inutilement les boutons |
| **Compteur de panne sélectionné qui revient au premier** | Le `<select>` était recréé sans conserver la sélection | Sauvegarde de la sélection et mise à jour de l'état sans remplacer le sélecteur |
| **Trois rapports JSON identiques** | Les trois boutons appelaient la même fonction de synthèse | Trois types de rapports et fichiers distincts : postes, disponibilité, indicateurs |
| **Acquitter une alerte provoquait sa disparition et sa réapparition** | `acknowledged_at` était utilisé aussi pour définir la clôture | Nouveau champ `resolved_at` ; une alerte acquittée reste ouverte jusqu'à disparition de la cause ; historique consultable |
| **Courbe globale avec possibles pics artificiels** | Somme des échantillons de la minute, divisée par un nombre moyen puis multipliée par 58 | Une seule lecture la plus récente par compteur et par minute ; somme des compteurs disponibles |
| **La puissance totale incluait des données anciennes de compteurs hors ligne** | Les dernières mesures archivées étaient additionnées sans vérifier le statut | Seuls les compteurs en ligne sont utilisés pour la puissance instantanée affichée |
| **Navigateur ouvert avant le serveur sous Windows** | Le `.bat` ouvrait le lien avant le démarrage HTTP | Ouverture après démarrage du serveur, dans `SME_OPEN_BROWSER=1` |
| **Valeur `null` montrée comme 0,0 dans le laboratoire** | `Number(null)` vaut zéro | Affichage `—` lorsqu'une lecture est absente |

## 2. Fonctionnalités des sept pages

| Page | Actions disponibles et vérifiées | Résultat V2.1 |
|---|---|---|
| Vue d'ensemble | Puissance totale, compteurs connectés, alerte en cours, six cartes, courbe et bouton « Actualiser » | Fonctionnel sur données simulées |
| Postes électriques | Six cartes cliquables, inventaire, état des communications, puissance par poste | Fonctionnel ; ouverture du filtre des compteurs |
| Compteurs | Filtre par poste, tableau de 58 compteurs, bouton « Détails », mesures et historique | **Corrigé** : détail reste ouvert pendant le rafraîchissement et indique l'état et la dernière mesure |
| Analyse énergétique | Trois IPE illustratifs, tendance et comparaison par poste | Fonctionnel en démonstration ; aucun IPE réglementaire validé |
| Alertes | Alertes d'anomalie de puissance et de communication, acquittement, vues en cours/historique | **Corrigé** : acquittement distinct de résolution automatique |
| Rapports et exports | CSV des mesures, trois rapports JSON différents | **Corrigé** ; PDF/Excel et envois planifiés non livrés |
| Système | État des services, sélection d'un compteur, simulation et rétablissement de panne | **Corrigé** : sélection conservée et changement visible après lecture immédiate |

## 3. Laboratoire électrique virtuel

| Élément | Test fonctionnel |
|---|---|
| Six boutons de choix des postes | Sélection du poste et de l'armoire associée |
| Quatre interrupteurs par poste, soit 24 charges | ON/OFF avec mise à jour du compteur virtuel et de la base de données |
| Scénario « Activité normale » | Réinitialise les états prévus par le modèle |
| Scénario « Pointe d'activité » | Met les 24 charges à ON |
| Scénario « Mode nuit » | Conserve six éclairages actifs |
| Scénario « Arrêt des charges » | Met les 24 charges pilotables à OFF ; les 34 autres points continuent à mesurer des charges autonomes |
| Mesures Modbus | Puissance, courant, tension, facteur de puissance, énergie, état, date de la dernière mesure |
| Historique des commandes | Retrace les changements d'état et scénarios |
| Courbe de puissance contrôlée | Évolution illustrative calculée par le navigateur pendant la session |

Le laboratoire effectue des **requêtes HTTP locales pour commander le simulateur** ; le collecteur lit ensuite réellement les *réponses Modbus TCP virtuelles* via des sockets locales. Aucun équipement réel n'est piloté.

## 4. Vérifications exécutées

- **11 tests unitaires Python** : protocole Modbus, inventaire, 24 charges, scénarios, impact sur les mesures, gestion et migration des alertes.
- **12 tests d'interface et de parcours** avec Chromium en page isolée et appels à l'API locale via un pont de test : navigation, boutons, filtres, persistance de la fiche après plus de cinq secondes, panne et récupération, acquittement durable, trois rapports distincts et commandes du laboratoire.
- Vérification de la syntaxe de `app.js` et `laboratoire.js` avec Node.js.

Les tests ci-dessus vérifient un ensemble défini de scénarios, **pas l'absence de tout défaut**. Le navigateur automatisé est exécuté avec chargement isolé de la page, son accès réseau direct étant restreint par l'environnement de test. L'API, elle, est appelée sur le vrai serveur local.

## 5. Comment refaire la vérification manuellement

1. Lancer `start_windows.bat`, ouvrir le dashboard et le laboratoire.
2. Aller dans **Compteurs**, filtrer sur PT Y, ouvrir `P01-M01 > Détails` ; garder la fenêtre ouverte plus de 10 secondes. Elle doit rester visible et actualiser les valeurs.
3. Fermer la fenêtre, ouvrir **Système**, choisir `P06-M01`, attendre 5 secondes. La sélection doit rester `P06-M01`.
4. Cliquer sur **Simuler une panne**, puis aller dans **Alertes**. Une alerte de communication doit apparaître.
5. **Acquitter** l'alerte : son état devient « Acquittée » mais elle reste en cours tant que la panne dure.
6. Revenir dans **Système**, rétablir `P06-M01` et vérifier dans **Alertes > Historique complet** que l'alerte passe à « Résolue ».
7. Aller dans **Rapports**, exporter les trois fichiers JSON : chaque nom et chaque contenu doivent être différents. Exporter le CSV.
8. Dans **Laboratoire**, sélectionner PT Y, cliquer sur la grue portique puis les scénarios. Le dashboard doit afficher les changements de consommation.

## 6. Limites à ne pas confondre avec le CPS

La V2.1 n'est **pas** un SME industriel conforme au marché 12/DEPA/2026 : elle ne fournit ni équipements physiques, ni vérification d'étalonnage, ni analyse réglementaire ISO 50001, ni authentification/LDAP, ni accès industrialisé sécurisé, ni architecture haute disponibilité, ni maintenance contractuelle, ni rapport ISO validé. Les registres Modbus et l'inventaire des charges sont fictifs. La plateforme doit rester accessible uniquement sur l'ordinateur local.
