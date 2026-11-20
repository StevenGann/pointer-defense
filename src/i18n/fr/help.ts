import type { Catalogue } from '../index.ts';

/**
 * Help-page prose, French (docs/HELP-PROSE.md) — a machine draft pending native review.
 *
 * Key-for-key translation of src/i18n/en/help.ts. Key names are byte-identical and {placeholders}
 * are preserved; only the surrounding prose is French. Tower and enemy names still come through
 * towerName() / enemyName(), not here. 'Pointer Defense', DPS, tier labels, branch letters and spec
 * names (CPU/GPU/RAM/Disk) keep their game form; HP becomes PV. Review against docs/GLOSSARY.md
 * before release.
 */
export const help: Catalogue = {
  // Chapter names.
  'help.category.getting-started': 'Pour commencer',
  'help.category.mechanics': 'Mécaniques',
  'help.category.enemies': 'Ennemis',
  'help.category.bosses': 'Boss',
  'help.category.towers': 'Tours',

  // Table headers (the generated enemy HP table and the tower tier ladder).
  'help.table.tier': 'Palier',
  'help.table.cost': 'Coût',
  'help.table.wave': 'Vague',
  'help.table.hp': 'PV',
  'help.table.heal': 'Soin',

  // Page titles that are not a tower or enemy name (those keep towerName() / enemyName()).
  'help.page.getting-started.title': 'Pour commencer',
  'help.page.mechanics-pointer.title': "L'échelle du pointeur",
  'help.page.mechanics-salvage.title': 'Ferraille et spécifications',
  'help.page.mechanics-walls.title': 'Murs et tracé',
  'help.page.mechanics-early-call.title': 'Appeler les vagues en avance',
  'help.page.mechanics-auto-start.title': 'Démarrage automatique',
  'help.page.mechanics-modifiers.title': 'Modificateurs',
  'help.page.mechanics-endless.title': 'Infini',
  'help.page.bosses-in-general.title': 'Boss',

  // Getting started.
  'help.getting-started.1': 'Une partie est une suite de vagues. Entre les vagues, vous construisez\u00A0; pendant une vague, les ennemis parcourent la route et vous cliquez dessus.',
  'help.getting-started.2': 'Phase de construction\u00A0: placez des tours et dessinez le labyrinthe. Appuyez sur Lancer la vague (ou Entrée) quand vous êtes prêt.',
  'help.getting-started.3': "Vagues\u00A0: les ennemis traversent de l'entrée vers la sortie. Tout ce qui passe coûte de l'intégrité.",
  'help.getting-started.4': 'Intégrité\u00A0: vous commencez avec 20. Quand elle tombe à zéro, la partie est terminée.',
  'help.getting-started.5': "Le pointeur\u00A0: cliquez sur les ennemis pour leur tirer dessus. Visez l'encoche de tête pour infliger le double de dégâts.",
  'help.getting-started.6': "Les tours de combat s'améliorent sur {maxTier} paliers\u00A0; les murs, la Réparation et le Curseur s'arrêtent plus tôt, chacun sur sa propre échelle.",

  // Mechanics: the pointer ladder.
  'help.mechanics-pointer.1': "Un simple clic inflige {click} dégâts\u00A0; le Réticule inflige {reticle} et {hold} dégâts par seconde tant qu'il est maintenu.",
  'help.mechanics-pointer.2': "Les niveaux d'overclock multiplient les dégâts de clic par {growth} chacun, {milestones}, plafonnés à {maxLevel}\u00A0; un niveau se débloque toutes les {divisor} vagues.",
  'help.mechanics-pointer.3': 'Un clic critique pour {crit}× — {base} de base, +{marked} sur un ennemi marqué, +{weak} sur le point faible. La marque ajoute {mark} de dégâts.',
  'help.mechanics-pointer.4': "Les clics ignorent l'armure et usent les boucliers, si bien que le pointeur est la réponse aux ennemis que vos tours ne peuvent pas toucher.",
  'help.mechanics-pointer.5': 'Améliorez le pointeur depuis le panneau de droite pendant une partie.',

  // Mechanics: salvage and specs.
  'help.mechanics-salvage.1': 'La ferraille est la monnaie de la partie\u00A0: les éliminations en rapportent, et vous la dépensez en tours, en améliorations et pour le pointeur.',
  'help.mechanics-salvage.2': 'Les spécifications sont permanentes. Un redémarrage met en banque des points de restauration tirés de la ferraille cumulée de la partie, et ils sont reportés à la partie suivante.',
  'help.mechanics-salvage.3': "Chaque spécification a un effet\u00A0: CPU {cpu} de dégâts de tour, GPU {gpu} de dégâts de pointeur, RAM +{ram} de ferraille de départ, Disk {disk} d'intégrité de départ (plafonds {caps}).",
  'help.mechanics-salvage.4': 'Un niveau de spécification coûte {cost0} points de restauration au niveau 0, {cost1} au niveau 1, {cost2} au niveau 2, {cost3} au niveau 3, et continue de grimper.',
  'help.mechanics-salvage.5': 'Un redémarrage met en banque {gain20k} points de restauration à 20,000 de ferraille cumulée et {gain60k} à 60,000.',

  // Mechanics: walls and pathing.
  'help.mechanics-walls.1': 'Les murs bloquent la route, si bien que les ennemis les contournent. Une route plus longue signifie plus de temps sous vos tours.',
  'help.mechanics-walls.2': 'Le plateau refuse un mur (ou une tour) qui scellerait la route et ne laisserait aucun chemin vers la sortie.',
  'help.mechanics-walls.3': 'Certains ennemis ignorent les murs\u00A0: les volants volent droit au-dessus, et les brècheurs les rongent.',

  // Mechanics: calling waves early.
  'help.mechanics-early-call.1': "Vous pouvez appeler la vague suivante pendant qu'une autre est encore en cours. Plus vous appelez tôt, plus le bonus de ferraille est grand.",
  'help.mechanics-early-call.2': 'Un appel en tout début de vague rapporte {bonus} de ferraille à la vague 2, puis décroît vers un plancher de 5 à mesure que vous attendez.',
  'help.mechanics-early-call.3': "Deux vagues peuvent tourner en même temps, donc un appel en avance, c'est du risque contre de la récompense.",

  // Mechanics: auto-start.
  'help.mechanics-auto-start.1': 'Activez Auto et la vague suivante démarre 1.5 s après que le plateau se vide.',
  'help.mechanics-auto-start.2': "Il attend pendant qu'une tour est en réparation, puis se lance.",

  // Mechanics: modifiers.
  'help.mechanics-modifiers.1': "À partir d'un certain point de la partie, les vagues portent des modificateurs qui changent les règles.",
  'help.mechanics-modifiers.2': "- Sans construction — le plateau est gelé\u00A0: pas de placement, d'amélioration, de vente, de réparation ni de reciblage.",
  'help.mechanics-modifiers.3': '- Brouillard — la portée des tours est réduite.',
  'help.mechanics-modifiers.4': '- Avance rapide — les ennemis se déplacent plus vite.',
  'help.mechanics-modifiers.5': '- Panne — votre affichage de ferraille est masqué.',
  'help.mechanics-modifiers.6': '- Ruée — les apparitions se rapprochent.',

  // Mechanics: endless.
  'help.mechanics-endless.1': 'Après la centième vague, vous pouvez choisir Infini et continuer.',
  'help.mechanics-endless.2': "Les vagues infinies deviennent de plus en plus dures. Il n'y a pas de vague finale.",

  // Enemies: the generated stats line (body line 1) and the answer paragraph (body line 2).
  'help.enemy-grunt.1': '{hp} PV · {speed} cases/s.',
  'help.enemy-grunt.2': "Le monstre de base, l'unité à laquelle tout le reste est comparé. N'importe quoi le tue — c'est l'ennemi contre lequel vous construisez et tirez en apprenant le plateau.",
  'help.enemy-runner.1': '{hp} PV · {speed} cases/s.',
  'help.enemy-runner.2': "Rapide et petit, si bien que les tours le touchent moins souvent et que les dégâts de zone le manquent souvent. Cliquez dessus, ou placez un Taser à un coin qu'il doit contourner.",
  'help.enemy-shielded.1': '{hp} PV · {speed} cases/s · {armour} armure · {shield} bouclier.',
  'help.enemy-shielded.2': "Son bouclier absorbe tous les dégâts des tours jusqu'à ce que le pointeur le brise. Cliquez pour abattre le bouclier, puis laissez vos tours l'achever.",
  'help.enemy-flyer.1': '{hp} PV · {speed} cases/s.',
  'help.enemy-flyer.2': "Vole droit au-dessus du labyrinthe, si bien que les murs ne le ralentissent pas. Seul un mur Filet l'arrête\u00A0; la tour AA est la réponse.",
  'help.enemy-armoured.1': '{hp} PV · {speed} cases/s · {armour} armure.',
  'help.enemy-armoured.2': "Son armure absorbe les dégâts des tours (soustraction fixe, plancher à 1). Un Taser ignore l'armure, et vos clics l'ignorent aussi.",
  'help.enemy-saboteur.1': '{hp} PV · {speed} cases/s.',
  'help.enemy-saboteur.2': "Un ennemi rapide avec une santé moyenne. Traitez-le comme un Coureur plus coriace et cliquez dessus avant qu'il ne traverse le plateau.",
  'help.enemy-breacher.1': '{hp} PV · {speed} cases/s · ronge les murs.',
  'help.enemy-breacher.2': "Fonce vers vos murs et les ronge, pendant qu'une petite tourelle tire sur la tour la plus proche. Un mur le désarme pendant qu'il ronge\u00A0; tuez-le avant que le mur ne tombe.",
  'help.enemy-popup.1': '{hp} PV · {speed} cases/s · une fenêtre, pas une fuite.',
  'help.enemy-popup.2': "Une fenêtre ambulante qui protège de vos tours tous les ennemis qui se trouvent dessous. Cliquez sur sa case de fermeture pour la supprimer — c'est la seule solution.",

  // Bosses in general.
  'help.bosses-in-general.1': "Un boss est une version plus grosse et plus méchante d'un ennemi ordinaire. Il s'annonce avec une barre de nom en haut du terrain.",
  'help.bosses-in-general.2': "Les boss sont lents et coriaces, font perdre plus d'intégrité en cas de fuite, et rapportent bien plus de ferraille que l'ennemi dont ils sont tirés.",
  'help.bosses-in-general.3': "Le pointeur est la réponse fiable\u00A0: les clics ignorent l'armure et les boucliers, et un boss est assez lent pour être cliqué de nombreuses fois.",

  // Boss pages: stats line (1), gimmick (2), answer (3).
  'help.boss-grunt-boss.1': "{hp} PV · {speed} cases/s · {integrity} d'intégrité s'il fuit.",
  'help.boss-grunt-boss.2': "Un mur de points de vie — la référence à laquelle tous les autres boss sont comparés. Il n'a pas de ruse\u00A0; il faut simplement longtemps pour l'abattre.",
  'help.boss-grunt-boss.3': 'Concentrez le feu avec le pointeur et gardez-le à portée de vos tours le plus longtemps possible.',
  'help.boss-runner-boss.1': "{hp} PV · {speed} cases/s · {integrity} d'intégrité s'il fuit.",
  'help.boss-runner-boss.2': 'Tout ce qui est proche suit son rythme\u00A0: les ennemis à moins de 3 cases avancent à sa vitesse ou à la leur, selon la plus rapide.',
  'help.boss-runner-boss.3': "Tuez-le tôt, avant qu'il n'entraîne une vague à travers votre plateau.",
  'help.boss-shielded-boss.1': "{hp} PV · {speed} cases/s · {integrity} d'intégrité s'il fuit.",
  'help.boss-shielded-boss.2': "Trois couches de bouclier, une retirée à chaque coup de pointeur. Les tours ne peuvent pas le blesser tant que la dernière couche n'est pas tombée.",
  'help.boss-shielded-boss.3': "Cliquez dessus pour retirer les couches, puis laissez vos tours l'achever.",
  'help.boss-flyer-boss.1': "{hp} PV · {speed} cases/s · {integrity} d'intégrité s'il fuit.",
  'help.boss-flyer-boss.2': 'Fait éclore des volants en volant — trois toutes les 4 s, et six de plus quand il meurt.',
  'help.boss-flyer-boss.3': "Des tours AA pour la couvée, et cliquez sur le porteur lui-même pour l'abattre avant qu'il n'atteigne la sortie.",
  'help.boss-armoured-boss.1': "{hp} PV · {speed} cases/s · {integrity} d'intégrité s'il fuit.",
  'help.boss-armoured-boss.2': "Blindé et lent à refroidir\u00A0: une réduction d'armure supplémentaire, et les ralentissements n'agissent qu'à moitié sur lui.",
  'help.boss-armoured-boss.3': "Les tours qui ignorent l'armure et votre pointeur sont la source de dégâts fiable.",
  'help.boss-saboteur-boss.1': "{hp} PV · {speed} cases/s · {integrity} d'intégrité s'il fuit.",
  'help.boss-saboteur-boss.2': "Court-circuite les tours en passant\u00A0: toute tour à moins de 2.5 cases passe hors ligne pendant 3 s, puis revient d'elle-même.",
  'help.boss-saboteur-boss.3': "Espacez vos tours, ou tuez-le avant qu'il n'atteigne la ligne.",
  'help.boss-breacher-boss.1': "{hp} PV · {speed} cases/s · {integrity} d'intégrité s'il fuit.",
  'help.boss-breacher-boss.2': 'Dévore vos tours\u00A0: il ronge les murs, met les autres tours hors ligne et porte une tourelle.',
  'help.boss-breacher-boss.3': 'Un labyrinthe de murs le ralentit case par case\u00A0; gardez une tour Réparation derrière la ligne.',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-gun.2': 'Choisissez une branche au palier 3.',
  'help.tower-gun.3': '- **{name}** — {cost}\u00A0: plus de portée, des coups plus durs.',
  'help.tower-gun.4': '- **{name}** — {cost}\u00A0: tire deux fois plus vite.',
  'help.tower-gun.5': "Le pilier bon marché à cible unique. Placez-le sur une longue portion de route pour qu'il tire le plus longtemps possible.",

  'help.tower-cannon.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-cannon.2': 'Choisissez une branche au palier 3.',
  'help.tower-cannon.3': '- **{name}** — {cost}\u00A0: une zone plus grande.',
  'help.tower-cannon.4': '- **{name}** — {cost}\u00A0: pose une mine toutes les {interval} s, armée en {arm} s, {cap} mines actives max, {damage} dégâts dans une explosion de {blast}, expire en {expire} s.',
  'help.tower-cannon.5': 'Un tireur lent et lourd avec une zone de dégâts. Idéal là où le labyrinthe fait demi-tour, pour que la zone attrape un groupe.',

  'help.tower-taser.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-taser.2': 'Choisissez une branche au palier 3.',
  'help.tower-taser.3': "- **{name}** — {cost}\u00A0: enchaîne jusqu'à 3 cibles.",
  'help.tower-taser.4': '- **{name}** — {cost}\u00A0: dégâts supplémentaires aux boucliers.',
  'help.tower-taser.5': "Portée courte et cadence très rapide, et il ignore l'armure. Placez-le à l'intérieur d'une épingle à cheveux pour punir les ennemis coriaces de près.",

  'help.tower-frost.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-frost.2': 'Choisissez une branche au palier 3.',
  'help.tower-frost.3': '- **{name}** — {cost}\u00A0: un ralentissement plus fort.',
  'help.tower-frost.4': '- **{name}** — {cost}\u00A0: pas de ralentissement, de vrais dégâts.',
  'help.tower-frost.5': "Ralentit tout ce qu'il touche à 30% de vitesse pendant 3 s. Placez-le devant vos dégâts pour que les ennemis restent plus longtemps à portée.",

  'help.tower-laser.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-laser.2': 'Choisissez une branche au palier 3.',
  'help.tower-laser.3': '- **{name}** — {cost}\u00A0: perce plus profondément, plus de dégâts.',
  'help.tower-laser.4': '- **{name}** — {cost}\u00A0: se divise en trois rayons.',
  'help.tower-laser.5': "Perce une ligne droite d'ennemis. Orientez-le dans un couloir que vous avez volontairement laissé ouvert.",

  'help.tower-aa.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-aa.2': 'Choisissez une branche au palier 3.',
  'help.tower-aa.3': '- **{name}** — {cost}\u00A0: les obus explosent et touchent aussi le sol.',
  'help.tower-aa.4': "- **{name}** — {cost}\u00A0: {salvo} missiles à tête chercheuse par salve, chacun {pct} d'un coup.",
  'help.tower-aa.5': 'La tour antiaérienne dédiée. Elle ne tire que sur les volants, leur inflige le double de dégâts, et reste muette sur les vagues uniquement terrestres.',

  'help.tower-beacon.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-beacon.2': 'Choisissez une branche au palier 3.',
  'help.tower-beacon.3': '- **{name}** — {cost}\u00A0: +{aura} de dégâts aux tours dans le rayon.',
  'help.tower-beacon.4': '- **{name}** — {cost}\u00A0: +{aura} de dégâts aux tours, +{pointerDamage} de dégâts de pointeur, +{pointerRange} de portée de pointeur.',
  'help.tower-beacon.5': "Augmente les dégâts de chaque tour dans son rayon. Placez-le au-dessus d'un groupe dense.",

  'help.tower-repair.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-repair.2': "Soigne les tours endommagées dans son rayon. Gardez-le près d'un groupe que vous voulez faire survivre.",

  'help.tower-wall.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-wall.2': 'Choisissez une branche au palier 3.',
  'help.tower-wall.3': '- **{name}** — {cost}\u00A0: {hp} PV.',
  'help.tower-wall.4': '- **{name}** — {cost}\u00A0: {hp} PV, bloque les volants.',
  'help.tower-wall.5': '- **{name}** — {cost}\u00A0: {hp} PV, une porte que vous ouvrez et fermez.',
  'help.tower-wall.6': 'Bloque la route et possède des points de vie. Utilisez les murs pour faire parcourir aux ennemis un labyrinthe plus long.',

  'help.tower-cursor.1': 'Coût {cost} · se débloque à la vague {unlock}.',
  'help.tower-cursor.2': 'Choisissez une branche au palier 3.',
  'help.tower-cursor.3': '- **{name}** — {cost}\u00A0: {rate} clics/s, rayon de {radius} cases.',
  'help.tower-cursor.4': '- **{name}** — {cost}\u00A0: {rate} clics/s, rayon de {radius} cases.',
  'help.tower-cursor.5': '- **{name}** — {cost}\u00A0: répare les tours en dessous de {pct} quand son rayon est dégagé.',
  'help.tower-cursor.6': 'Un second curseur qui clique sur les ennemis pour la moitié de vos dégâts de clic. Nourrissez-le en améliorant le pointeur.',

  // Synergies (always available; docs/SYNERGIES.md §6).
  'help.synergy.title': 'Synergies',
  'help.synergy.1': 'Deux tours adjacentes des bons types se lient en une synergie. Adjacent signifie côte à côte — nord, sud, est ou ouest, jamais en diagonale.',
  'help.synergy.2': '**Tir synchronisé** — les tours AA adjacentes tirent comme une seule\u00A0: la plus rapide mène et les autres tirent avec elle. Une AA simple tire toutes les {interval} ticks.',
  'help.synergy.3': 'Une suiveuse retient son tir jusqu\'à ce que sa meneuse tire ce tick-là. Elle attend au plus {window} ticks la meneuse, et jamais plus de {cap} ticks au total.',
  'help.synergy.4': 'Un tir synchronisé est exactement aussi fort qu\'un tir non synchronisé — aucun bonus de dégâts ni de cadence — il atterrit juste avec les autres.',
} as const satisfies Catalogue;
