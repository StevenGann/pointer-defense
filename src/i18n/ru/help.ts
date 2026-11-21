import type { Catalogue } from '../index.ts';

/**
 * Russian (ru) Help-page prose — machine draft, pending native review.
 *
 * Keys are byte-identical to the English help module (src/i18n/en/help.ts); every `{placeholder}`
 * survives verbatim and may be reordered, never dropped, added or renamed. `HP`, `DPS`, the game
 * title `Pointer Defense`, spec names CPU/GPU/RAM/Disk, branch letters A/B/C and id-like tokens are
 * left untouched. Tower and enemy names keep going through `towerName()` / `enemyName()`; branch
 * names through `branchName()`. Vocabulary follows docs/GLOSSARY.md and reuses the ru catalogue
 * (волна, башня, враг, босс, урон, радиус, лом, целостность, указатель, крит, разгон, ветка).
 */
export const help: Catalogue = {
  // Chapter names.
  'help.category.getting-started': 'Начало работы',
  'help.category.mechanics': 'Механика',
  'help.category.enemies': 'Враги',
  'help.category.bosses': 'Боссы',
  'help.category.towers': 'Башни',

  // Table headers (the generated enemy HP table and the tower tier ladder).
  'help.table.tier': 'Уровень',
  'help.table.cost': 'Цена',
  'help.table.wave': 'Волна',
  'help.table.hp': 'HP',
  'help.table.heal': 'Лечение',

  // Page titles that are not a tower or enemy name (those keep towerName() / enemyName()).
  'help.page.getting-started.title': 'Начало работы',
  'help.page.mechanics-pointer.title': 'Лестница указателя',
  'help.page.mechanics-salvage.title': 'Лом и характеристики',
  'help.page.mechanics-walls.title': 'Стены и пути',
  'help.page.mechanics-early-call.title': 'Ранний вызов волн',
  'help.page.mechanics-auto-start.title': 'Автостарт',
  'help.page.mechanics-modifiers.title': 'Модификаторы',
  'help.page.mechanics-endless.title': 'Бесконечный',
  'help.page.mechanics-licences.title': 'Tower licences',
  'help.page.mechanics-maps.title': 'Maps',
  'help.page.mechanics-global-upgrades.title': 'Global upgrades',
  'help.page.mechanics-daily.title': 'Daily challenge',
  'help.page.mechanics-achievements.title': 'Achievements',
  'help.page.mechanics-editor.title': 'The editor',
  'help.page.bosses-in-general.title': 'Боссы',

  // Getting started.
  'help.getting-started.1': 'Забег — это череда волн. Между волнами вы строите; во время волны враги идут по маршруту, а вы кликаете по ним.',
  'help.getting-started.2': 'Фаза строительства: ставьте башни и формируйте лабиринт. Нажмите «Начать волну» (или Enter), когда будете готовы.',
  'help.getting-started.3': 'Волны: враги идут от входа к выходу. Всё, что проходит насквозь, стоит целостности.',
  'help.getting-started.4': 'Integrity: you start with {integrity}. When it reaches zero the run is over.',
  'help.getting-started.5': 'Указатель: кликайте по врагам, чтобы стрелять. Цельтесь в переднюю выемку, чтобы нанести двойной урон.',
  'help.getting-started.6': 'Боевые башни проходят {maxTier} уровней улучшений; стены, Ремонт и Курсор заканчивают раньше — у них свои лестницы.',

  // Mechanics: the pointer ladder.
  'help.mechanics-pointer.1': 'Обычный клик наносит {click} урона; Прицел наносит {reticle} и держит {hold} урона в секунду.',
  'help.mechanics-pointer.2': 'Каждый уровень разгона умножает урон клика на {growth}, вехи: {milestones}, потолок {maxLevel}; новый уровень открывается каждые {divisor} волн.',
  'help.mechanics-pointer.3': 'Клик критует на {crit}× — {base} базовый шанс, +{marked} по отмеченному врагу, +{weak} по слабому месту. Метка добавляет {mark} урона.',
  'help.mechanics-pointer.4': 'Клики игнорируют броню и стачивают щиты, поэтому указатель — ответ врагам, которых не достают ваши башни.',
  'help.mechanics-pointer.5': 'Улучшайте указатель на правой панели во время забега.',

  // Mechanics: salvage and specs.
  'help.mechanics-salvage.1': 'Лом — валюта забега: за убийства платят ломом, а вы тратите его на башни, улучшения и указатель.',
  'help.mechanics-salvage.2': 'Характеристики постоянны. Перезагрузка зачисляет точки восстановления из лома, заработанного за забег, и они переносятся в следующий забег.',
  'help.mechanics-salvage.3': 'Каждая характеристика даёт эффект: CPU {cpu} урона башен, GPU {gpu} урона указателя, RAM +{ram} стартового лома, Disk {disk} стартовой целостности (потолки {caps}).',
  'help.mechanics-salvage.4': 'Повышение характеристики на один уровень стоит {cost0} точек восстановления на уровне 0, {cost1} на уровне 1, {cost2} на уровне 2, {cost3} на уровне 3 — и цена растёт дальше.',
  'help.mechanics-salvage.5': 'Перезагрузка зачисляет {gain20k} точек восстановления при 20 000 заработанного лома и {gain60k} при 60 000.',

  // Mechanics: walls and pathing.
  'help.mechanics-walls.1': 'Стены перекрывают маршрут, поэтому враги обходят их. Длиннее маршрут — больше времени под вашими башнями.',
  'help.mechanics-walls.2': 'Поле не даст поставить стену (или башню), которая перекроет маршрут и не оставит пути к выходу.',
  'help.mechanics-walls.3': 'Некоторые враги не замечают стен: летуны пролетают прямо над ними, а проломщики прогрызают их.',

  // Mechanics: calling waves early.
  'help.mechanics-early-call.1': 'Следующую волну можно вызвать, пока ещё идёт текущая. Чем раньше вызовете, тем больше бонус лома.',
  'help.mechanics-early-call.2': 'A full-early call pays {bonus} salvage at wave 2, decaying toward a floor of {floor} the later you wait.',
  'help.mechanics-early-call.3': 'Две волны могут идти одновременно, поэтому ранний вызов — это риск ради награды.',

  // Mechanics: auto-start.
  'help.mechanics-auto-start.1': 'Включите «Авто», и следующая волна начнётся через 1,5 с после очистки поля.',
  'help.mechanics-auto-start.2': 'Он ждёт, пока башня ремонтируется, и затем запускает волну.',

  // Mechanics: modifiers.
  'help.mechanics-modifiers.1': 'Ближе к концу забега волны несут модификаторы, меняющие правила.',
  'help.mechanics-modifiers.2': '- Без строительства — поле заморожено: нельзя ставить, улучшать, продавать, чинить или перенацеливать.',
  'help.mechanics-modifiers.3': '- Туман — радиус башен уменьшен.',
  'help.mechanics-modifiers.4': '- Ускорение — враги движутся быстрее.',
  'help.mechanics-modifiers.5': '- Затемнение — ваш счётчик лома скрыт.',
  'help.mechanics-modifiers.6': '- Натиск — враги появляются плотнее.',

  // Mechanics: endless.
  'help.mechanics-endless.1': 'After wave {final} you can choose Endless and keep going.',
  'help.mechanics-endless.2': 'Бесконечные волны становятся всё сложнее. Финальной волны нет.',
  'help.mechanics-licences.1': 'Eight permanent unlocks, one per tower that normally arrives later in a run, bought with Restore Points in the Restore window.',
  'help.mechanics-licences.2': 'A licence puts that tower in the build palette from wave 1 of every later run. Owned once, it stays owned.',
  'help.mechanics-licences.3': 'Each is priced by how late the tower normally arrives, from {low} to {high} Restore Points; the price is on the row.',
  'help.mechanics-licences.4': 'A Daily run inherits your licences, like the rest of the Restore tree.',
  'help.mechanics-maps.1': '{maps} maps ship with the game, from wide-open fields to gated corridors.',
  'help.mechanics-maps.2': 'Play opens the map gallery, one card per map; choose one to start it.',
  'help.mechanics-maps.3': 'When the cards do not fit, the gallery scrolls. The last map you chose is remembered and selected next time.',
  'help.mechanics-global-upgrades.1': 'Global upgrades live in the right-hand panel and are bought with salvage during a run.',
  'help.mechanics-global-upgrades.2': 'Each is bought once and lasts for the rest of that run only.',
  'help.mechanics-global-upgrades.3': 'A new run or a reboot clears them — nothing carries over.',
  'help.mechanics-daily.1': 'One seeded run per local day: the date is the seed, so everyone playing on the same date gets the same board.',
  'help.mechanics-daily.2': 'You get one attempt, and it runs {waves} waves.',
  'help.mechanics-daily.3': 'The result is recorded in your run history, but it is not a scored record — a daily never counts as a win or a loss.',
  'help.mechanics-achievements.1': 'There are {count} achievements, kept on your profile: once earned, they stay earned.',
  'help.mechanics-achievements.2': 'They unlock as their conditions are met. The Achievements window lists them, and a locked one says what it needs.',
  'help.mechanics-achievements.3': 'Shadow achievements stay hidden until they are earned.',
  'help.mechanics-editor.1': 'The editor lets you draw a map: paint walls and shutters, and place the start and exit.',
  'help.mechanics-editor.2': 'Test it inside the editor, then play it — or copy its code to share.',
  'help.mechanics-editor.3': 'A map must leave a route from start to exit, or the editor refuses to play it.',

  // Enemies: the generated stats line (body line 1) and the answer paragraph (body line 2).
  'help.enemy-grunt.1': '{hp} HP · {speed} клеток/с.',
  'help.enemy-grunt.2': 'Базовый рядовой враг и эталон, с которым сравнивают всё остальное. Его убивает что угодно — это враг, на котором вы строите и стреляете, пока изучаете поле.',
  'help.enemy-runner.1': '{hp} HP · {speed} клеток/с.',
  'help.enemy-runner.2': 'Быстрый и маленький, поэтому башни делают по нему меньше выстрелов, а разлёт обычно промахивается. Кликайте по нему или поставьте Тазер на угол, который он должен обогнуть.',
  'help.enemy-shielded.1': '{hp} HP · {speed} клеток/с · {armour} брони · {shield} щита.',
  'help.enemy-shielded.2': 'Его щит поглощает весь урон башен, пока указатель его не пробьёт. Сбейте щит кликами, а затем пусть башни добьют врага.',
  'help.enemy-flyer.1': '{hp} HP · {speed} клеток/с.',
  'help.enemy-flyer.2': 'Летит прямо над лабиринтом, поэтому стены его не замедляют. Останавливает его только стена «Сетка»; ответ — башня AA.',
  'help.enemy-armoured.1': '{hp} HP · {speed} клеток/с · {armour} брони.',
  'help.enemy-armoured.2': 'Его броня поглощает урон башен (вычитание фиксированного числа, не ниже 1). Тазер игнорирует броню, и ваши клики тоже.',
  'help.enemy-saboteur.1': '{hp} HP · {speed} клеток/с.',
  'help.enemy-saboteur.2': 'Быстрый враг со средним здоровьем. Относитесь к нему как к более крепкому Бегуну и кликайте, пока он не пересёк поле.',
  'help.enemy-breacher.1': '{hp} HP · {speed} клеток/с · грызёт стены.',
  'help.enemy-breacher.2': 'Идёт к вашим стенам и прогрызает их, а его маленькая турель стреляет по ближайшей башне. Пока он грызёт, стена обезоруживает его; убейте его, пока стена не пала.',
  'help.enemy-popup.1': '{hp} HP · {speed} клеток/с · окно, а не утечка.',
  'help.enemy-popup.2': 'Идущее окно, которое укрывает всех врагов под собой от ваших башен. Кликните по его крестику, чтобы закрыть его, — это единственный способ.',

  // Bosses in general.
  'help.bosses-in-general.1': 'Босс — более крупная и злая версия обычного врага. Он заявляет о себе полосой с именем вверху поля.',
  'help.bosses-in-general.2': 'Боссы медленны и живучи, утечка от них стоит больше целостности, и они платят гораздо больше лома, чем враг, на котором основаны.',
  'help.bosses-in-general.3': 'Надёжный ответ — указатель: клики игнорируют броню и щиты, а босс достаточно медлителен, чтобы кликать много раз.',

  // Boss pages: stats line (1), gimmick (2), answer (3).
  'help.boss-grunt-boss.1': '{hp} HP · {speed} клеток/с · {integrity} целостности при утечке.',
  'help.boss-grunt-boss.2': 'Стена очков здоровья — эталон, с которым сравнивают всех остальных боссов. У него нет трюков; его просто долго сбивать.',
  'help.boss-grunt-boss.3': 'Сосредоточьте огонь указателя и держите его в радиусе башен как можно дольше.',
  'help.boss-runner-boss.1': '{hp} HP · {speed} клеток/с · {integrity} целостности при утечке.',
  'help.boss-runner-boss.2': 'Anything near it keeps pace: enemies within {radius} tiles move at its speed or their own, whichever is faster.',
  'help.boss-runner-boss.3': 'Убейте его пораньше, пока он не погнал волну через ваше поле.',
  'help.boss-shielded-boss.1': '{hp} HP · {speed} клеток/с · {integrity} целостности при утечке.',
  'help.boss-shielded-boss.2': 'Три слоя щита, по одному снимаются за попадание указателя. Башни не могут его ранить, пока не снят последний слой.',
  'help.boss-shielded-boss.3': 'Кликайте по нему, чтобы снять слои, затем пусть башни добьют его.',
  'help.boss-flyer-boss.1': '{hp} HP · {speed} клеток/с · {integrity} целостности при утечке.',
  'help.boss-flyer-boss.2': 'Hatches flyers as it flies — {brood} every {interval} s, and {death} more when it dies.',
  'help.boss-flyer-boss.3': 'Башни AA — против выводка, а самого носителя сбивайте кликами, пока он не достиг выхода.',
  'help.boss-armoured-boss.1': '{hp} HP · {speed} клеток/с · {integrity} целостности при утечке.',
  'help.boss-armoured-boss.2': 'Plated and slow to chill: extra armour reduction, and slows only work {resist} as well on it.',
  'help.boss-armoured-boss.3': 'Надёжный урон — башни, игнорирующие броню, и ваш указатель.',
  'help.boss-saboteur-boss.1': '{hp} HP · {speed} клеток/с · {integrity} целостности при утечке.',
  'help.boss-saboteur-boss.2': 'Shorts out towers as it passes: any tower within {radius} tiles goes offline for {duration} s, then returns on its own.',
  'help.boss-saboteur-boss.3': 'Разнесите башни или убейте его, пока он не добрался до линии обороны.',
  'help.boss-breacher-boss.1': '{hp} HP · {speed} клеток/с · {integrity} целостности при утечке.',
  'help.boss-breacher-boss.2': 'Прогрызает ваши башни: грызёт стены, выводит из строя другие башни и несёт на себе турель.',
  'help.boss-breacher-boss.3': 'Лабиринт из стен замедляет его на одну клетку за раз; держите башню Ремонта за линией обороны.',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-gun.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-gun.3': '- **{name}** — {cost}: больше радиус и сильнее удары.',
  'help.tower-gun.4': '- **{name}** — {cost}: стреляет вдвое быстрее.',
  'help.tower-gun.5': 'Дешёвая основа против одиночных целей. Ставьте на длинный прямой участок маршрута, чтобы он стрелял как можно дольше.',

  'help.tower-cannon.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-cannon.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-cannon.3': '- **{name}** — {cost}: больший разлёт.',
  'help.tower-cannon.4': '- **{name}** — {cost}: ставит мину каждые {interval} с, взводится за {arm} с, до {cap} живых мин, {damage} урона в радиусе взрыва {blast}, исчезает через {expire} с.',
  'help.tower-cannon.5': 'Медленный тяжёлый стрелок с разлётом. Лучше всего там, где лабиринт разворачивается, чтобы разлёт накрывал скопление врагов.',

  'help.tower-taser.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-taser.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-taser.3': '- **{name}** — {cost}: chains to {chain} targets.',
  'help.tower-taser.4': '- **{name}** — {cost}: дополнительный урон по щитам.',
  'help.tower-taser.5': 'Маленький радиус и очень высокая скорострельность, плюс игнорирует броню. Ставьте на внутреннюю сторону крутого поворота, чтобы наказывать живучих врагов вблизи.',

  'help.tower-frost.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-frost.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-frost.3': '- **{name}** — {cost}: более сильное замедление.',
  'help.tower-frost.4': '- **{name}** — {cost}: без замедления, настоящий урон.',
  'help.tower-frost.5': 'Slows whatever it hits to {slow} speed for {duration} s. Put it in front of your damage so enemies spend longer in range.',

  'help.tower-laser.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-laser.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-laser.3': '- **{name}** — {cost}: пробивает глубже, больше урона.',
  'help.tower-laser.4': '- **{name}** — {cost}: делится на три луча.',
  'help.tower-laser.5': 'Пробивает прямую линию врагов. Направьте его вдоль коридора, который вы намеренно оставили открытым.',

  'help.tower-aa.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-aa.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-aa.3': '- **{name}** — {cost}: снаряды дают разлёт и бьют и по земле.',
  'help.tower-aa.4': '- **{name}** — {cost}: {salvo} самонаводящихся ракет за залп, каждая — {pct} от попадания.',
  'help.tower-aa.5': 'The dedicated anti-air tower. It only shoots flyers, hits them for {mult}× damage, and holds fire on ground-only waves.',

  'help.tower-beacon.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-beacon.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-beacon.3': '- **{name}** — {cost}: +{aura} урона башням в радиусе.',
  'help.tower-beacon.4': '- **{name}** — {cost}: +{aura} урона башням, +{pointerDamage} урона указателя, +{pointerRange} радиуса указателя.',
  'help.tower-beacon.5': 'Усиливает урон каждой башни в своём радиусе. Ставьте над плотным скоплением.',

  'help.tower-repair.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-repair.2': 'Лечит повреждённые башни в своём радиусе. Держите рядом со скоплением, которое хотите сохранить.',

  'help.tower-wall.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-wall.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-wall.3': '- **{name}** — {cost}: {hp} HP.',
  'help.tower-wall.4': '- **{name}** — {cost}: {hp} HP, блокирует летунов.',
  'help.tower-wall.5': '- **{name}** — {cost}: {hp} HP, затвор, который вы открываете и закрываете.',
  'help.tower-wall.6': 'Перекрывает маршрут и имеет очки здоровья. Используйте стены, чтобы заставить врагов идти по более длинному лабиринту.',

  'help.tower-cursor.1': 'Цена {cost} · открывается на волне {unlock}.',
  'help.tower-cursor.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-cursor.3': '- **{name}** — {cost}: {rate} кликов/с, радиус {radius} клеток.',
  'help.tower-cursor.4': '- **{name}** — {cost}: {rate} кликов/с, радиус {radius} клеток.',
  'help.tower-cursor.5': '- **{name}** — {cost}: чинит башни ниже {pct}, когда его радиус чист.',
  'help.tower-cursor.6': 'A second cursor that clicks enemies for {pct} of your click damage. Feed it by upgrading the pointer.',

  // Synergies (always available; docs/SYNERGIES.md §6).
  'help.synergy.title': 'Синергии',
  'help.synergy.1': 'Two adjacent towers of the right kinds link into a synergy. Adjacent means side by side — north, south, east or west, never diagonal. A chevroned line points from the tower that lends to the tower that receives.',
  'help.synergy.2': '**Синхронный огонь** — соседние башни ПВО стреляют как одна: более быстрая ведёт, остальные стреляют вместе с ней. Обычная ПВО стреляет каждые {interval} тиков.',
  'help.synergy.3': 'Ведомая башня удерживает выстрел, пока её ведущая не выстрелит в этот тик. Она ждёт ведущую не более {window} тиков и никогда больше {cap} тиков всего.',
  'help.synergy.4': 'Синхронный выстрел ровно так же силён, как несинхронный — без бонуса к урону или скорострельности — он просто прилетает вместе с остальными.',
};
