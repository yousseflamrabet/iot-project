# Spécification fonctionnelle et technique — Système de Monitoring Énergétique (SME)

**Référence du marché :** 12/DEPA/2026  
**Maître d’ouvrage :** Marsa Maroc — Direction d’Exploitation au Port d’Agadir (DEPA)  
**Document source :** *CPS_AOO_12DEPA2026.pdf* — Cahier des Prescriptions Spéciales  
**Version de travail :** 1.0  
**Langue de l’interface :** Français, avec architecture permettant l’ajout d’autres langues si demandé.

> **Note de fidélité au CPS :** cette spécification reprend les objectifs et exigences qui ont pu être extraits du document fourni. Le PDF est principalement numérisé et son extraction textuelle automatique est incomplète. Les exigences détaillées des articles techniques 45 à 51, les quantités du bordereau des prix et les conditions administratives particulières doivent être relues sur le PDF original avant validation contractuelle. Les propositions marquées « à confirmer » ne doivent pas être considérées comme des exigences contractuelles acquises.

---

## 1. Contexte et objectif

Le marché porte sur la **fourniture, l’installation, l’intégration et la mise en service d’un Système de Monitoring Énergétique (SME)** des postes électriques de Marsa Maroc au Port d’Agadir, ainsi que sur les prestations associées, notamment la formation des exploitants.

Le SME doit renforcer le dispositif de mesurage, de comptage et de suivi des **Indicateurs de Performance Énergétique (IPE)**, conformément aux objectifs du système de management de l’énergie et à la norme **ISO 50001:2018**.

La DEPA dispose d’un Système de Management Intégré certifié ISO 9001, ISO 14001, ISO 45001 et ISO 50001. Le SME doit contribuer au maintien et à l’amélioration continue de ce dispositif.

### 1.1 Objectifs principaux

- Mettre à niveau les appareils de comptage électrique des **six postes** concernés.
- Collecter automatiquement les mesures et permettre leur communication en **Modbus TCP/IP**.
- Déployer une plateforme digitale de management de l’énergie.
- Suivre les consommations et les mesures énergétiques aussi près du temps réel que le permettent les équipements.
- Calculer et suivre les IPE et la **Situation Énergétique de Référence (SER)**.
- Générer des alertes liées aux mesures et aux conditions configurées.
- Intégrer les points de comptage déjà instrumentés sans dupliquer les investissements.
- Produire des rapports structurés et exploitables pour la revue énergétique et la planification énergétique.
- Mettre en service la solution et former les exploitants.

## 2. Périmètre fonctionnel

### 2.1 Gestion des sites et postes électriques

La plateforme devra permettre de représenter la structure du périmètre énergétique :

- Site : Port d’Agadir / DEPA.
- Postes électriques : six postes concernés par le marché.
- Tableaux, départs, équipements et points de comptage : structure à préciser lors de l’inventaire terrain.
- Compteurs et appareils de mesure associés à chaque point de comptage.

Chaque élément devra posséder un identifiant unique, un libellé, un emplacement et un état de fonctionnement. La possibilité de gérer les relations parent-enfant devra permettre de faire évoluer la structure sans modifier le logiciel.

**À confirmer lors de l’étude d’exécution :** noms exacts des postes, nombre de compteurs, liste des grandeurs mesurées, équipements existants à conserver et équipements à remplacer.

### 2.2 Gestion des compteurs et acquisition

Le système devra prendre en charge les compteurs communicants prévus dans le marché et les points déjà instrumentés pouvant être intégrés.

Fonctions attendues :

- Enregistrer les caractéristiques de chaque compteur : identifiant, fabricant, modèle, adresse réseau, protocole, point de comptage et paramètres de communication.
- Lire les mesures via **Modbus TCP/IP**, selon la cartographie de registres fournie par le fabricant de chaque appareil.
- Horodater les mesures reçues.
- Conserver les valeurs brutes, les unités et les informations de qualité de lecture.
- Détecter les erreurs de communication, les valeurs absentes et les mesures manifestement invalides.
- Indiquer la date et l’heure de la dernière communication.
- Permettre le paramétrage de la période d’acquisition selon les contraintes des équipements et les prescriptions validées.
- Éviter les doubles comptages lors de l’intégration de points existants.

Les registres Modbus, facteurs d’échelle, unités, codes d’erreur, fréquences d’interrogation et délais de reconnexion devront être configurables. Ils ne doivent pas être codés en dur sans validation de la documentation des compteurs.

**Mesures possibles à confirmer selon les appareils réellement installés :** énergie active importée/exportée, puissance active, puissance réactive, tension, courant, fréquence, facteur de puissance et autres grandeurs disponibles. La liste définitive doit être issue des fiches techniques et du registre Modbus de chaque compteur.

### 2.3 Plateforme de monitoring énergétique

La plateforme devra offrir une interface web permettant aux utilisateurs autorisés de consulter les données énergétiques.

Fonctions de base :

- Tableau de bord général du site.
- Vue synthétique des six postes électriques.
- Consultation des mesures instantanées et de leur état de fraîcheur.
- Courbes d’évolution par période et par point de comptage.
- Comparaison entre postes, équipements et périodes, lorsque les données le permettent.
- Consultation des historiques.
- Filtrage par période, poste, compteur et grandeur mesurée.
- Export des données et rapports dans les formats retenus lors de la validation du projet.
- Affichage clair des pertes de communication et des périodes sans données.

L’interface ne doit pas présenter une mesure ancienne comme une mesure en temps réel : l’horodatage et l’état de fraîcheur des données doivent rester visibles.

### 2.4 Indicateurs de performance énergétique (IPE)

La plateforme devra permettre de définir, calculer, consulter et historiser les IPE utilisés par la DEPA.

Chaque IPE devrait comporter au minimum :

- Nom et description.
- Formule de calcul documentée.
- Grandeurs sources et unités.
- Périmètre et points de comptage utilisés.
- Période d’agrégation.
- Règles de traitement des données manquantes.
- Date d’entrée en vigueur et historique des changements.

Les formules et les IPE officiels ne sont pas inventés dans ce document : ils devront être validés avec le responsable énergie de la DEPA et les documents de revue énergétique.

### 2.5 Situation Énergétique de Référence (SER)

La plateforme devra permettre de représenter la SER utilisée pour l’évaluation de la performance énergétique.

Fonctions à prévoir :

- Enregistrer la période de référence et les données qui la composent.
- Documenter les hypothèses, variables pertinentes et règles de calcul.
- Comparer les consommations observées à la référence.
- Présenter les écarts par période et par périmètre.
- Conserver les versions de la SER et les raisons des modifications.
- Garantir la traçabilité des calculs et des données utilisées.

Les méthodes de normalisation, variables pertinentes, périodes de référence et critères de révision sont **à valider avec la DEPA** selon son système de management de l’énergie et la norme ISO 50001:2018.

### 2.6 Alertes

Le CPS indique la génération d’alertes. La plateforme devra donc prévoir un mécanisme configurable d’alertes.

Exemples de règles à confirmer avec le maître d’ouvrage :

- Absence de communication d’un compteur au-delà d’un délai paramétrable.
- Donnée manquante ou invalide.
- Dépassement d’un seuil énergétique configuré.
- Valeur anormale par rapport à une règle validée.
- Écart significatif par rapport à une référence ou à un IPE, si les critères sont définis.

Chaque alerte devrait conserver : type, équipement, date/heure de détection, valeur mesurée, seuil ou règle, niveau de priorité, état (nouvelle, prise en charge, clôturée), commentaire et historique des actions.

Les canaux de notification (interface, courriel, SMS ou autre) et les niveaux de criticité restent à confirmer ; ne pas les considérer comme contractuels sans validation.

### 2.7 Reporting énergétique

La solution doit produire un reporting structuré, exploitable pour la revue énergétique et la planification énergétique.

Rapports à définir avec la DEPA :

- Synthèse des consommations par période.
- Comparaison entre postes et points de comptage.
- Historique des grandeurs énergétiques.
- Suivi des IPE.
- Comparaison avec la SER.
- Synthèse des alertes et des indisponibilités de mesure.
- État de complétude et qualité des données.
- Traçabilité des périodes analysées et des méthodes de calcul.

Les périodicités, modèles de rapports, destinataires et formats exacts doivent être validés lors des ateliers de cadrage.

### 2.8 Intégration des points de comptage existants

Le système doit intégrer les points déjà instrumentés dans le dispositif global **sans duplication d’investissement**.

Avant installation, un inventaire contradictoire devra identifier :

- Les compteurs et équipements déjà installés.
- Leurs protocoles et possibilités de communication.
- Les données disponibles et leur qualité.
- Les éventuelles passerelles ou interfaces nécessaires.
- Les points conservés, remplacés ou ajoutés.

La réception de l’intégration devra vérifier qu’un point de comptage n’est pas comptabilisé deux fois dans les agrégations énergétiques.

### 2.9 Utilisateurs et habilitations

Le CPS fourni dans son état d’extraction ne permet pas de confirmer les profils exacts. Prévoir une gestion d’accès à faire valider, avec par exemple :

- Administrateur technique.
- Responsable énergie.
- Exploitant / opérateur.
- Lecteur / auditeur.

Les permissions doivent être attribuées selon le principe du moindre privilège. Les actions sensibles (modification des seuils, des IPE, de la SER et de la configuration des compteurs) doivent être journalisées.

## 3. Exigences non fonctionnelles

### 3.1 Disponibilité et qualité des données

- Surveiller l’état de communication des compteurs.
- Distinguer valeur nulle, valeur égale à zéro, donnée absente et donnée invalide.
- Conserver l’horodatage de mesure et l’horodatage de réception.
- Prévoir une stratégie de reprise après interruption réseau.
- Éviter les doublons lors de la reprise des acquisitions.
- Documenter les limites de précision et les dépendances aux compteurs.

Les objectifs chiffrés de disponibilité, de rétention et de temps de réponse sont à fixer contractuellement.

### 3.2 Sécurité

- Authentification des utilisateurs et gestion des rôles.
- Chiffrement des accès web lorsque l’infrastructure le permet.
- Protection des identifiants et secrets de configuration.
- Journalisation des connexions et actions sensibles.
- Sauvegardes et procédures de restauration testées.
- Segmentation des réseaux de mesure et du réseau utilisateur selon l’architecture approuvée.
- Accès d’administration limité aux personnes autorisées.
- Synchronisation horaire des serveurs et équipements lorsque possible.

Le protocole Modbus TCP/IP ne fournit pas à lui seul une authentification ou un chiffrement applicatif. Les mesures de cloisonnement réseau et de protection doivent donc être définies dans l’architecture de déploiement.

### 3.3 Maintenabilité et évolutivité

- Configuration des compteurs et registres sans modification du code lorsque possible.
- Journalisation technique exploitable pour le diagnostic.
- Supervision du service d’acquisition.
- Documentation d’installation, d’exploitation et de sauvegarde.
- Possibilité d’ajouter ultérieurement des compteurs et indicateurs après validation.

### 3.4 Traçabilité

Les mesures sources et les données calculées doivent être distinguées. Les modifications des paramètres, formules, seuils et références doivent être historisées avec l’utilisateur et l’horodatage, dans la mesure prévue par les exigences validées.

## 4. Architecture logique proposée — à valider

L’architecture ci-dessous constitue une proposition de conception et non une prescription explicitement confirmée par le CPS.

1. **Couche terrain :** compteurs électriques communicants et équipements existants.
2. **Couche communication :** réseau industriel et Modbus TCP/IP.
3. **Couche acquisition :** service de lecture, validation, horodatage, gestion des erreurs et reprise.
4. **Couche données :** stockage des mesures brutes, données agrégées, configurations et journaux.
5. **Couche métier énergétique :** calcul des consommations, IPE, SER et règles d’alerte.
6. **Couche présentation :** application web, tableaux de bord, historiques, rapports et administration.
7. **Couche exploitation :** sauvegarde, supervision, gestion des accès et documentation.

Le choix des technologies, du système d’exploitation, du moteur de base de données, de l’hébergement et de l’éventuelle architecture redondante doit être arrêté dans l’offre technique et approuvé par le maître d’ouvrage.

## 5. Modèle de données indicatif

Le modèle suivant est une base de conception à adapter à l’inventaire terrain.

- `sites` : sites ou entités de rattachement.
- `electrical_posts` : postes électriques.
- `equipment` : compteurs et appareils de mesure.
- `measurement_points` : points de comptage.
- `measurement_definitions` : grandeurs, unités, registres et facteurs d’échelle.
- `measurements_raw` : mesures brutes horodatées et état de qualité.
- `measurements_aggregated` : agrégations par période, si nécessaires.
- `energy_indicators` : définition des IPE.
- `indicator_values` : valeurs calculées des IPE.
- `energy_baselines` : versions de la SER et paramètres associés.
- `alerts` : alertes générées.
- `alert_events` : changements d’état et actions sur les alertes.
- `users`, `roles`, `permissions` : gestion des accès.
- `audit_log` : journal des actions sensibles.
- `system_config` : paramètres techniques.
- `report_jobs` : génération et historique des rapports.

Prévoir des clés étrangères, des index adaptés aux recherches temporelles et des règles de rétention validées. Les unités et facteurs de conversion doivent être explicites et contrôlés.

## 6. Parcours d’utilisation principaux

### 6.1 Mise en service d’un compteur

1. Créer ou sélectionner le poste électrique.
2. Enregistrer le compteur et ses paramètres réseau.
3. Charger ou configurer la cartographie des registres validée.
4. Tester la communication Modbus TCP/IP.
5. Vérifier les valeurs, unités, échelles et horodatages.
6. Associer le compteur à son point de comptage.
7. Valider la remontée dans le tableau de bord.
8. Documenter les résultats du test.

### 6.2 Consultation de la performance énergétique

1. L’utilisateur s’authentifie.
2. Il sélectionne une période et un périmètre.
3. Le système affiche les mesures et leur état de qualité.
4. Il consulte les consommations, les IPE et les écarts à la SER disponibles.
5. Il exporte ou consulte le rapport correspondant.

### 6.3 Traitement d’une alerte

1. Le moteur détecte une condition configurée.
2. L’alerte est enregistrée avec sa valeur et son contexte.
3. L’exploitant consulte l’alerte et la prend en charge.
4. Il ajoute un commentaire ou une action corrective.
5. Il clôture l’alerte selon les règles validées.
6. L’historique reste consultable.

## 7. Installation, intégration et mise en service

Le titulaire doit réaliser les prestations de fourniture, installation, intégration et mise en service prévues par le marché.

Plan de travail proposé :

1. Visite technique et inventaire des six postes.
2. Validation de la liste des compteurs et des points existants.
3. Validation de l’architecture et du plan d’adressage.
4. Installation des appareils et raccordements selon les règles applicables.
5. Configuration des communications Modbus TCP/IP.
6. Installation et paramétrage de la plateforme.
7. Intégration des points de comptage existants.
8. Vérification des mesures et des calculs.
9. Essais de bout en bout, alertes et rapports.
10. Formation des exploitants.
11. Remise des documents et procès-verbaux de réception.

Les méthodes de consignation électrique, autorisations d’accès au port, plans de prévention, règles de sécurité et conditions d’intervention doivent suivre les exigences du maître d’ouvrage et les documents contractuels applicables.

## 8. Plan de tests et critères d’acceptation proposés

Les critères chiffrés devront être validés dans le plan de recette.

| ID | Test | Résultat attendu |
|---|---|---|
| T01 | Connectivité Modbus TCP/IP | Le compteur configuré répond selon ses spécifications. |
| T02 | Vérification des registres | Valeurs, unités, signes et facteurs d’échelle vérifiés sur un échantillon. |
| T03 | Horodatage | La mesure et sa date de réception sont enregistrées correctement. |
| T04 | Perte de communication | L’incident est visible et signalé conformément à la règle configurée. |
| T05 | Reprise après coupure | La collecte reprend sans duplication non maîtrisée. |
| T06 | Tableau de bord | Les données du poste et du compteur sont consultables. |
| T07 | Historique | La recherche par période renvoie les mesures disponibles. |
| T08 | Calcul énergétique | Les résultats sont conformes aux formules et jeux d’essai validés. |
| T09 | IPE et SER | Les calculs et comparaisons sont traçables et vérifiables. |
| T10 | Alertes | Une règle de test génère une alerte et son historique. |
| T11 | Reporting | Le rapport présente le périmètre, la période, les unités et les indicateurs validés. |
| T12 | Intégration existante | Les points existants sont intégrés sans double comptage. |
| T13 | Habilitations | Un utilisateur ne peut pas exécuter une action non autorisée. |
| T14 | Sauvegarde/restauration | La procédure est documentée et le test de restauration est concluant. |
| T15 | Formation | Les exploitants réalisent les opérations principales après formation. |

## 9. Formation et transfert de compétences

Le CPS mentionne la formation des exploitants. Le programme détaillé, la durée, le nombre de participants et les supports exigés doivent être confirmés à partir du CPS complet et de la planification du projet.

Programme indicatif :

- Navigation et lecture des tableaux de bord.
- Consultation des historiques et export des rapports.
- Interprétation des IPE et de la SER.
- Consultation, prise en charge et clôture des alertes.
- Diagnostic de premier niveau des communications.
- Gestion des utilisateurs selon les habilitations accordées.
- Procédures de sauvegarde et d’escalade vers le support, selon le rôle des participants.

Les feuilles de présence, supports, guides et attestations seront fournis si cela est exigé dans les documents contractuels ou validé avec le maître d’ouvrage.

## 10. Livrables proposés

La liste définitive doit être alignée sur les articles techniques du CPS. À titre de base de travail :

- Dossier d’architecture et schéma de communication.
- Inventaire des postes, compteurs et points de comptage.
- Liste des adresses IP et paramètres Modbus.
- Matrice des registres, unités et facteurs d’échelle.
- Dossier d’installation et de configuration.
- Plateforme SME opérationnelle.
- Paramétrage documenté des IPE et de la SER, après validation par la DEPA.
- Catalogue des alertes et règles configurées.
- Modèles de reporting validés.
- Procès-verbaux d’essais et de mise en service.
- Guides utilisateur et administrateur.
- Procédures de sauvegarde et restauration.
- Supports et compte rendu de formation.
- Dossier des réserves et corrections, le cas échéant.

## 11. Informations à confirmer avant développement ou engagement contractuel

Les points suivants doivent être extraits et vérifiés dans les articles techniques du CPS et le bordereau des prix :

- Liste et désignation des six postes électriques.
- Quantités exactes de compteurs, accessoires, passerelles et équipements.
- Marques, modèles, classes de précision et caractéristiques minimales des compteurs.
- Grandeurs à mesurer et cartographies Modbus.
- État des équipements existants et points à intégrer.
- Topologie réseau, adressage, contraintes de cybersécurité et règles d’accès.
- Architecture d’hébergement, serveur et stockage.
- Période d’échantillonnage, rétention et disponibilité attendues.
- Formules et référentiels officiels des IPE.
- Méthode et période de calcul de la SER.
- Seuils, priorités et canaux de notification des alertes.
- Formats, modèles et périodicités des rapports.
- Profils et nombre d’utilisateurs.
- Exigences de sauvegarde, restauration, garantie et maintenance.
- Planning, délai d’exécution, réception et période de garantie.
- Programme de formation, durée et nombre de participants.
- Détail estimatif, prix et quantités du bordereau.

## 12. Consignes à destination d’une équipe de développement ou d’un assistant de programmation

1. Prendre ce fichier comme base de cadrage fonctionnel, mais ne pas traiter les propositions « à confirmer » comme des obligations contractuelles.
2. Ne jamais inventer les quantités, modèles de compteurs, registres Modbus, formules d’IPE, paramètres de SER, seuils, délais ou prix.
3. Prévoir une architecture modulaire séparant acquisition, stockage, calcul énergétique, alertes, reporting et interface web.
4. Externaliser les paramètres des compteurs et les règles métier dans une configuration administrable.
5. Enregistrer les mesures avec leurs unités, horodatages et indicateurs de qualité.
6. Conserver la traçabilité des modifications de configuration et des calculs.
7. Prévoir des tests automatisés pour les conversions, agrégations, indicateurs et règles d’alerte.
8. Documenter les hypothèses et tenir une liste des décisions en attente de validation.
9. Avant la mise en production, faire valider par la DEPA les données terrain, les calculs, les rapports et les critères de recette.
10. Vérifier la conformité finale avec la totalité du CPS, les documents constitutifs du marché et les règles de sécurité du site.

---

## Annexe — Référence de la source

Le document fourni est intitulé **« Fourniture, installation, intégration et mise en service d’un Système de Monitoring Énergétique (SME) des postes électriques de Marsa Maroc au Port d’Agadir »**, référence **12/DEPA/2026**.

Les objectifs explicitement identifiés dans le début du CPS sont : mise à niveau du comptage électrique des six postes, remontée automatisée via Modbus TCP/IP, plateforme de management de l’énergie, suivi des consommations, calcul des IPE et de la SER, alertes, intégration des points existants sans duplication d’investissement, reporting pour la revue et la planification énergétique, et formation des exploitants.
