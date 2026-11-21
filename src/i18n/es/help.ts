import type { Catalogue } from '../index.ts';

/**
 * Help-page prose (docs/HELP-PROSE.md) — Spanish (European).
 *
 * Machine draft, pending native review. Translated key-for-key from src/i18n/en/help.ts: key names
 * and {placeholders} are byte-identical to the English contract, and tower/enemy names keep going
 * through towerName() / enemyName(), so they never appear here.
 */
export const help: Catalogue = {
  // Chapter names.
  'help.category.getting-started': 'Primeros pasos',
  'help.category.mechanics': 'Mecánica',
  'help.category.enemies': 'Enemigos',
  'help.category.bosses': 'Jefes',
  'help.category.towers': 'Torres',

  // Table headers (the generated enemy HP table and the tower tier ladder).
  'help.table.tier': 'Rango',
  'help.table.cost': 'Coste',
  'help.table.wave': 'Oleada',
  'help.table.hp': 'HP',
  'help.table.heal': 'Cura',

  // Page titles that are not a tower or enemy name (those keep towerName() / enemyName()).
  'help.page.getting-started.title': 'Primeros pasos',
  'help.page.mechanics-pointer.title': 'La escalera del puntero',
  'help.page.mechanics-salvage.title': 'Chatarra y especificaciones',
  'help.page.mechanics-walls.title': 'Muros y trazado de rutas',
  'help.page.mechanics-early-call.title': 'Adelantar oleadas',
  'help.page.mechanics-auto-start.title': 'Inicio automático',
  'help.page.mechanics-modifiers.title': 'Modificadores',
  'help.page.mechanics-endless.title': 'Infinito',
  'help.page.mechanics-licences.title': 'Licencias de torre',
  'help.page.mechanics-maps.title': 'Mapas',
  'help.page.mechanics-global-upgrades.title': 'Mejoras globales',
  'help.page.mechanics-daily.title': 'Desafío diario',
  'help.page.mechanics-achievements.title': 'Logros',
  'help.page.mechanics-editor.title': 'El editor',
  'help.page.bosses-in-general.title': 'Jefes',

  // Getting started.
  'help.getting-started.1': 'Una partida es una serie de oleadas. Entre oleadas construyes; durante una oleada los enemigos recorren la ruta y tú haces clic sobre ellos.',
  'help.getting-started.2': 'Fase de construcción: coloca torres y da forma al laberinto. Pulsa Iniciar oleada (o Intro) cuando estés listo.',
  'help.getting-started.3': 'Oleadas: los enemigos cruzan de la entrada a la salida. Todo lo que se cuela cuesta integridad.',
  'help.getting-started.4': 'Integridad: empiezas con {integrity}. Cuando llega a cero, la partida termina.',
  'help.getting-started.5': 'El puntero: haz clic en los enemigos para dispararles. Apunta a la muesca delantera para infligir el doble de daño.',
  'help.getting-started.6': 'Las torres de combate mejoran hasta {maxTier} rangos; los muros, la Reparación y el Cursor se detienen antes en sus propias escaleras.',

  // Mechanics: the pointer ladder.
  'help.mechanics-pointer.1': 'Un clic a secas inflige {click} de daño; la Retícula inflige {reticle} y mantiene {hold} de daño por segundo.',
  'help.mechanics-pointer.2': 'Cada nivel de overclock multiplica el daño de clic por {growth}, {milestones}, con tope en {maxLevel}; se desbloquea uno cada {divisor} oleadas.',
  'help.mechanics-pointer.3': 'Un clic hace crítico de {crit}× — {base} base, +{marked} sobre un enemigo marcado, +{weak} en el punto débil. La marca añade {mark} de daño.',
  'help.mechanics-pointer.4': 'Los clics ignoran la armadura y desgastan los escudos, así que el puntero es la respuesta a los enemigos que tus torres no pueden tocar.',
  'help.mechanics-pointer.5': 'Mejora el puntero desde el panel de la derecha durante una partida.',

  // Mechanics: salvage and specs.
  'help.mechanics-salvage.1': 'La chatarra es la moneda de la partida: las bajas la pagan, y la gastas en torres, mejoras y el puntero.',
  'help.mechanics-salvage.2': 'Las especificaciones son permanentes. Un reinicio acumula Puntos de restauración a partir de la chatarra total de la partida, y se trasladan a la siguiente partida.',
  'help.mechanics-salvage.3': 'Cada especificación tiene un efecto: CPU {cpu} de daño de torres, GPU {gpu} de daño del puntero, RAM +{ram} de chatarra inicial, Disk {disk} de integridad inicial (topes {caps}).',
  'help.mechanics-salvage.4': 'Un nivel de especificación cuesta {cost0} Puntos de restauración en el nivel 0, {cost1} en el nivel 1, {cost2} en el nivel 2, {cost3} en el nivel 3, y sigue subiendo.',
  'help.mechanics-salvage.5': 'Un reinicio acumula {gain20k} Puntos de restauración con 20.000 de chatarra total y {gain60k} con 60.000.',

  // Mechanics: walls and pathing.
  'help.mechanics-walls.1': 'Los muros bloquean la ruta, así que los enemigos los rodean. Una ruta más larga significa más tiempo bajo tus torres.',
  'help.mechanics-walls.2': 'El tablero rechaza un muro (o una torre) que sellaría la ruta y no dejaría camino hasta la salida.',
  'help.mechanics-walls.3': 'Algunos enemigos ignoran los muros: los voladores pasan volando por encima, y los demoledores los roen.',

  // Mechanics: calling waves early.
  'help.mechanics-early-call.1': 'Puedes adelantar la siguiente oleada mientras otra sigue en curso. Cuanto antes la adelantes, mayor es el bono de chatarra.',
  'help.mechanics-early-call.2': 'Adelantar del todo paga {bonus} de chatarra en la oleada 2, y decae hacia un mínimo de {floor} cuanto más tarde esperes.',
  'help.mechanics-early-call.3': 'Pueden correr dos oleadas a la vez, así que adelantar es arriesgar por recompensa.',

  // Mechanics: auto-start.
  'help.mechanics-auto-start.1': 'Activa Auto y la siguiente oleada empezará 1.5 s después de que se despeje el tablero.',
  'help.mechanics-auto-start.2': 'Espera mientras una torre está reparándose, y luego dispara.',

  // Mechanics: modifiers.
  'help.mechanics-modifiers.1': 'Más avanzada la partida, las oleadas traen modificadores que cambian las reglas.',
  'help.mechanics-modifiers.2': '- Sin construcción — el tablero se congela: no hay colocación, mejora, venta, reparación ni reorientación.',
  'help.mechanics-modifiers.3': '- Niebla — el alcance de las torres se reduce.',
  'help.mechanics-modifiers.4': '- Avance rápido — los enemigos se mueven más rápido.',
  'help.mechanics-modifiers.5': '- Apagón — tu lectura de chatarra queda oculta.',
  'help.mechanics-modifiers.6': '- Avalancha — las apariciones llegan más juntas.',

  // Mechanics: endless.
  'help.mechanics-endless.1': 'Después de la oleada {final} puedes elegir Infinito y seguir jugando.',
  'help.mechanics-endless.2': 'Las oleadas infinitas se van volviendo más difíciles. No hay oleada final.',
  'help.mechanics-licences.1': 'Ocho desbloqueos permanentes, uno por cada torre que normalmente llega más tarde en una partida, comprados con puntos de restauración en la ventana Restaurar.',
  'help.mechanics-licences.2': 'Una licencia pone esa torre en la paleta de construcción desde la oleada 1 de todas las partidas posteriores. Una vez conseguida, se conserva.',
  'help.mechanics-licences.3': 'Cada una tiene un precio según lo tarde que llega la torre normalmente, de {low} a {high} puntos de restauración; el precio está en la fila.',
  'help.mechanics-licences.4': 'Una partida diaria hereda tus licencias, igual que el resto del árbol de restauración.',
  'help.mechanics-maps.1': 'El juego incluye {maps} mapas, desde campos abiertos hasta pasillos con compuertas.',
  'help.mechanics-maps.2': 'Jugar abre la galería de mapas, una tarjeta por mapa; elige uno para empezar.',
  'help.mechanics-maps.3': 'Cuando las tarjetas no caben, la galería se desplaza. El último mapa que elegiste se recuerda y queda seleccionado la próxima vez.',
  'help.mechanics-global-upgrades.1': 'Las mejoras globales viven en el panel de la derecha y se compran con chatarra durante una partida.',
  'help.mechanics-global-upgrades.2': 'Cada una se compra una vez y dura solo el resto de esa partida.',
  'help.mechanics-global-upgrades.3': 'Una nueva partida o un reinicio las borra — nada se traslada.',
  'help.mechanics-daily.1': 'Una partida con semilla por día local: la fecha es la semilla, así que todos los que jueguen en la misma fecha obtienen el mismo tablero.',
  'help.mechanics-daily.2': 'Tienes un intento, y dura {waves} oleadas.',
  'help.mechanics-daily.3': 'El resultado se registra en tu historial de partidas, pero no es un récord puntuado — una diaria nunca cuenta como victoria ni derrota.',
  'help.mechanics-achievements.1': 'Hay {count} logros, guardados en tu perfil: una vez conseguidos, se quedan conseguidos.',
  'help.mechanics-achievements.2': 'Se desbloquean cuando se cumplen sus condiciones. La ventana Logros los enumera, y uno bloqueado dice qué necesita.',
  'help.mechanics-achievements.3': 'Los logros ocultos permanecen ocultos hasta que se consiguen.',
  'help.mechanics-editor.1': 'El editor te permite dibujar un mapa: pinta muros y compuertas, y coloca la entrada y la salida.',
  'help.mechanics-editor.2': 'Pruébalo dentro del editor, luego juégalo — o copia su código para compartirlo.',
  'help.mechanics-editor.3': 'Un mapa debe dejar una ruta de la entrada a la salida, o el editor se niega a jugarlo.',

  // Enemies: the generated stats line (body line 1) and the answer paragraph (body line 2).
  'help.enemy-grunt.1': '{hp} HP · {speed} casillas/s.',
  'help.enemy-grunt.2': 'El enemigo básico y la unidad con la que se compara todo lo demás. Cualquier cosa lo mata — es el enemigo contra el que construyes y disparas mientras aprendes el tablero.',
  'help.enemy-runner.1': '{hp} HP · {speed} casillas/s.',
  'help.enemy-runner.2': 'Rápido y pequeño, así que las torres le hacen menos disparos y el área suele fallarle. Hazle clic, o coloca un Táser en una esquina que tenga que rodear.',
  'help.enemy-shielded.1': '{hp} HP · {speed} casillas/s · {armour} de armadura · {shield} de escudo.',
  'help.enemy-shielded.2': 'Su escudo absorbe todo el daño de torres hasta que el puntero lo rompe. Haz clic para bajar el escudo y deja que tus torres lo rematen.',
  'help.enemy-flyer.1': '{hp} HP · {speed} casillas/s.',
  'help.enemy-flyer.2': 'Vuela recto por encima del laberinto, así que los muros no lo frenan. Solo un muro de Malla lo detiene; la torre AA es la respuesta.',
  'help.enemy-armoured.1': '{hp} HP · {speed} casillas/s · {armour} de armadura.',
  'help.enemy-armoured.2': 'Su armadura absorbe el daño de torres (resta plana, con mínimo de 1). Un Táser ignora la armadura, y tus clics también la ignoran.',
  'help.enemy-saboteur.1': '{hp} HP · {speed} casillas/s.',
  'help.enemy-saboteur.2': 'Un enemigo rápido con vida moderada. Trátalo como un Corredor más duro y hazle clic antes de que cruce el tablero.',
  'help.enemy-breacher.1': '{hp} HP · {speed} casillas/s · roe muros.',
  'help.enemy-breacher.2': 'Va a por tus muros y los roe, mientras una pequeña torreta dispara a la torre más cercana. Un muro lo desarma mientras roe; mátalo antes de que caiga el muro.',
  'help.enemy-popup.1': '{hp} HP · {speed} casillas/s · una ventana, no una fuga.',
  'help.enemy-popup.2': 'Una ventana andante que protege de tus torres a todos los enemigos que hay debajo. Haz clic en su botón de cerrar para quitarla — es la única forma.',

  // Bosses in general.
  'help.bosses-in-general.1': 'Un jefe es una versión más grande y temible de un enemigo normal. Se anuncia con una barra con su nombre en la parte superior del campo.',
  'help.bosses-in-general.2': 'Los jefes son lentos y duros, cuestan más integridad si se cuelan, y pagan mucha más chatarra que el enemigo en el que se basan.',
  'help.bosses-in-general.3': 'El puntero es la respuesta fiable: los clics ignoran la armadura y los escudos, y un jefe es lo bastante lento para hacerle clic muchas veces.',

  // Boss pages: stats line (1), gimmick (2), answer (3).
  'help.boss-grunt-boss.1': '{hp} HP · {speed} casillas/s · {integrity} de integridad si se cuela.',
  'help.boss-grunt-boss.2': 'Un muro de puntos de vida — la referencia con la que se mide a los demás jefes. No tiene truco; solo tarda mucho en caer.',
  'help.boss-grunt-boss.3': 'Concentra el fuego con el puntero y mantenlo dentro del alcance de tus torres todo lo que puedas.',
  'help.boss-runner-boss.1': '{hp} HP · {speed} casillas/s · {integrity} de integridad si se cuela.',
  'help.boss-runner-boss.2': 'Lo que esté cerca sigue su ritmo: los enemigos en un radio de {radius} casillas se mueven a su velocidad o a la suya propia, la que sea más rápida.',
  'help.boss-runner-boss.3': 'Mátalo pronto, antes de que arrastre una oleada por tu tablero.',
  'help.boss-shielded-boss.1': '{hp} HP · {speed} casillas/s · {integrity} de integridad si se cuela.',
  'help.boss-shielded-boss.2': 'Tres capas de blindaje, una retirada por cada impacto del puntero. Las torres no pueden dañarlo hasta que desaparezca la última capa.',
  'help.boss-shielded-boss.3': 'Hazle clic para quitarle las capas y deja que tus torres lo rematen.',
  'help.boss-flyer-boss.1': '{hp} HP · {speed} casillas/s · {integrity} de integridad si se cuela.',
  'help.boss-flyer-boss.2': 'Suelta voladores mientras vuela — {brood} cada {interval} s, y {death} más al morir.',
  'help.boss-flyer-boss.3': 'Torres AA para la camada, y haz clic sobre el portaaviones para derribarlo antes de que llegue a la salida.',
  'help.boss-armoured-boss.1': '{hp} HP · {speed} casillas/s · {integrity} de integridad si se cuela.',
  'help.boss-armoured-boss.2': 'Blindado y difícil de ralentizar: reducción extra de armadura, y las ralentizaciones solo funcionan {resist} de lo normal en él.',
  'help.boss-armoured-boss.3': 'Las torres que ignoran la armadura y tu puntero son el daño fiable.',
  'help.boss-saboteur-boss.1': '{hp} HP · {speed} casillas/s · {integrity} de integridad si se cuela.',
  'help.boss-saboteur-boss.2': 'Cortocircuita las torres a su paso: cualquier torre en un radio de {radius} casillas se desconecta durante {duration} s, y luego vuelve por sí sola.',
  'help.boss-saboteur-boss.3': 'Separa tus torres, o mátalo antes de que llegue a la línea.',
  'help.boss-breacher-boss.1': '{hp} HP · {speed} casillas/s · {integrity} de integridad si se cuela.',
  'help.boss-breacher-boss.2': 'Devora tus torres: roe muros y deja desconectadas otras torres, y monta una torreta.',
  'help.boss-breacher-boss.3': 'Un laberinto de muros lo frena una casilla cada vez; mantén una torre de Reparación detrás de la línea.',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-gun.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-gun.3': '- **{name}** — {cost}: más alcance, golpes más fuertes.',
  'help.tower-gun.4': '- **{name}** — {cost}: dispara el doble de rápido.',
  'help.tower-gun.5': 'La columna vertebral barata de objetivo único. Ponla en un tramo largo de ruta para que dispare el mayor tiempo posible.',

  'help.tower-cannon.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-cannon.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-cannon.3': '- **{name}** — {cost}: un área más grande.',
  'help.tower-cannon.4': '- **{name}** — {cost}: coloca una mina cada {interval} s, se arma en {arm} s, {cap} activas como máximo, {damage} de daño en una explosión de {blast}, caduca en {expire} s.',
  'help.tower-cannon.5': 'Un golpeador lento y pesado con área. Ideal donde el laberinto da la vuelta, para que el área alcance a un grupo.',

  'help.tower-taser.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-taser.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-taser.3': '- **{name}** — {cost}: encadena a {chain} objetivos.',
  'help.tower-taser.4': '- **{name}** — {cost}: daño extra a los escudos.',
  'help.tower-taser.5': 'Corto alcance y muy rápido, e ignora la armadura. Colócalo en el interior de una horquilla para castigar de cerca a los enemigos duros.',

  'help.tower-frost.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-frost.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-frost.3': '- **{name}** — {cost}: una ralentización más fuerte.',
  'help.tower-frost.4': '- **{name}** — {cost}: sin ralentización, daño real.',
  'help.tower-frost.5': 'Ralentiza lo que golpea a {slow} de velocidad durante {duration} s. Ponla delante de tu daño para que los enemigos pasen más tiempo en alcance.',

  'help.tower-laser.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-laser.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-laser.3': '- **{name}** — {cost}: perfora más profundo, más daño.',
  'help.tower-laser.4': '- **{name}** — {cost}: se divide en tres rayos.',
  'help.tower-laser.5': 'Perfora una línea recta de enemigos. Apúntalo por un pasillo que hayas dejado abierto a propósito.',

  'help.tower-aa.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-aa.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-aa.3': '- **{name}** — {cost}: los proyectiles estallan y también alcanzan a los terrestres.',
  'help.tower-aa.4': '- **{name}** — {cost}: {salvo} misiles teledirigidos por salva, cada uno {pct} de un impacto.',
  'help.tower-aa.5': 'La torre antiaérea dedicada. Solo dispara a voladores, los golpea con {mult}× de daño y no dispara en oleadas solo terrestres.',

  'help.tower-beacon.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-beacon.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-beacon.3': '- **{name}** — {cost}: +{aura} de daño a las torres dentro del radio.',
  'help.tower-beacon.4': '- **{name}** — {cost}: +{aura} de daño a las torres, +{pointerDamage} de daño del puntero, +{pointerRange} de alcance del puntero.',
  'help.tower-beacon.5': 'Aumenta el daño de cada torre dentro de su radio. Colócala sobre un grupo denso.',

  'help.tower-repair.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-repair.2': 'Cura torres dañadas dentro de su radio. Mantenla cerca de un grupo que quieras que sobreviva.',

  'help.tower-wall.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-wall.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-wall.3': '- **{name}** — {cost}: {hp} HP.',
  'help.tower-wall.4': '- **{name}** — {cost}: {hp} HP, bloquea voladores.',
  'help.tower-wall.5': '- **{name}** — {cost}: {hp} HP, una compuerta que abres y cierras.',
  'help.tower-wall.6': 'Bloquea la ruta y tiene puntos de vida. Usa los muros para que los enemigos recorran un laberinto más largo.',

  'help.tower-cursor.1': 'Coste {cost} · se desbloquea en la oleada {unlock}.',
  'help.tower-cursor.2': 'Elige una rama en el rango {branchTier}.',
  'help.tower-cursor.3': '- **{name}** — {cost}: {rate} clics/s, radio {radius} casillas.',
  'help.tower-cursor.4': '- **{name}** — {cost}: {rate} clics/s, radio {radius} casillas.',
  'help.tower-cursor.5': '- **{name}** — {cost}: repara torres por debajo del {pct} cuando su radio está despejado.',
  'help.tower-cursor.6': 'Un segundo cursor que hace clic a los enemigos con {pct} de tu daño de clic. Aliméntalo mejorando el puntero.',

  // Synergies (always available; docs/SYNERGIES.md §6).
  'help.synergy.title': 'Sinergias',
  'help.synergy.1': 'Dos torres adyacentes del tipo adecuado se enlazan en una sinergia. Adyacente significa lado a lado — norte, sur, este u oeste, nunca en diagonal. Una línea en cheurón apunta de la torre que presta a la torre que recibe.',
  'help.synergy.2': '**Fuego sincronizado** — las torres AA adyacentes disparan a la vez: la más rápida lidera y las demás disparan con ella. Una AA normal dispara cada {interval} ticks.',
  'help.synergy.3': 'Una seguidora retiene su disparo hasta que su líder dispara en ese tick. Espera como máximo {window} ticks al líder, y nunca más de {cap} ticks en total.',
  'help.synergy.4': 'Un disparo sincronizado es exactamente tan fuerte como uno sin sincronizar — sin bonus de daño ni de cadencia — solo aterriza con el resto.',
} as const satisfies Catalogue;
