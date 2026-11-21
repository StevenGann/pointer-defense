import type { Catalogue } from '../index.ts';

/**
 * Ukrainian Help-page prose (docs/HELP-PROSE.md).
 *
 * Machine draft — needs native review before the locale ships unflagged. Vocabulary reuses the main
 * Ukrainian catalogue (src/i18n/uk/index.ts): вежа, хвиля, брухт, цілісність, вказівник, крит,
 * розгін, гілка. Numbers travel as {placeholders}; HP, DPS, CPU/GPU/RAM/Disk, tier labels (T1…T12)
 * and branch letters stay untranslated.
 */
export const help: Catalogue = {
  // Chapter names.
  'help.category.getting-started': 'Початок',
  'help.category.mechanics': 'Механіка',
  'help.category.enemies': 'Вороги',
  'help.category.bosses': 'Боси',
  'help.category.towers': 'Вежі',

  // Table headers (the generated enemy HP table and the tower tier ladder).
  'help.table.tier': 'Рівень',
  'help.table.cost': 'Вартість',
  'help.table.wave': 'Хвиля',
  'help.table.hp': 'HP',
  'help.table.heal': 'Лікування',

  // Page titles that are not a tower or enemy name (those keep towerName() / enemyName()).
  'help.page.getting-started.title': 'Початок роботи',
  'help.page.mechanics-pointer.title': 'Драбина вказівника',
  'help.page.mechanics-salvage.title': 'Брухт і характеристики',
  'help.page.mechanics-walls.title': 'Стіни та маршрути',
  'help.page.mechanics-early-call.title': 'Достроковий виклик хвиль',
  'help.page.mechanics-auto-start.title': 'Автостарт',
  'help.page.mechanics-modifiers.title': 'Модифікатори',
  'help.page.mechanics-endless.title': 'Безкінечний',
  'help.page.mechanics-licences.title': 'Tower licences',
  'help.page.mechanics-maps.title': 'Maps',
  'help.page.mechanics-global-upgrades.title': 'Global upgrades',
  'help.page.mechanics-daily.title': 'Daily challenge',
  'help.page.mechanics-achievements.title': 'Achievements',
  'help.page.mechanics-editor.title': 'The editor',
  'help.page.bosses-in-general.title': 'Боси',

  // Getting started.
  'help.getting-started.1': 'Забіг — це послідовність хвиль. Між хвилями ви будуєте; під час хвилі вороги йдуть маршрутом, і ви клацаєте по них.',
  'help.getting-started.2': 'Фаза будівництва: ставте вежі й формуйте лабіринт. Натисніть «Почати хвилю» (або Enter), коли будете готові.',
  'help.getting-started.3': 'Хвилі: вороги йдуть від входу до виходу. Усе, що пройшло наскрізь, коштує цілісності.',
  'help.getting-started.4': 'Integrity: you start with {integrity}. When it reaches zero the run is over.',
  'help.getting-started.5': 'Вказівник: клацайте по ворогах, щоб стріляти. Цільтеся у передню виїмку, щоб завдати подвійної шкоди.',
  'help.getting-started.6': 'Бойові вежі покращуються через {maxTier} рівнів; стіни, Ремонт і Курсор зупиняються раніше на власних драбинах.',

  // Mechanics: the pointer ladder.
  'help.mechanics-pointer.1': 'Голий клік завдає {click} шкоди; Приціл завдає {reticle} і тримає {hold} шкоди за секунду.',
  'help.mechanics-pointer.2': 'Рівні розгону множать шкоду кліку на {growth} кожен, {milestones}, зі стелею {maxLevel}; один відкривається кожні {divisor} хвиль.',
  'help.mechanics-pointer.3': 'Клік критує за {crit}× — {base} базовий, +{marked} по позначеному ворогу, +{weak} по слабкому місцю. Мітка додає {mark} шкоди.',
  'help.mechanics-pointer.4': 'Кліки ігнорують броню і зношують щити, тож вказівник — відповідь на ворогів, яких ваші вежі не можуть зачепити.',
  'help.mechanics-pointer.5': 'Покращуйте вказівник з правої панелі під час забігу.',

  // Mechanics: salvage and specs.
  'help.mechanics-salvage.1': 'Брухт — це валюта забігу: вбивства платять його, а ви витрачаєте його на вежі, покращення та вказівник.',
  'help.mechanics-salvage.2': 'Характеристики постійні. Перезапуск перетворює брухт, зароблений за життя забігу, на точки відновлення, і вони переходять у наступний забіг.',
  'help.mechanics-salvage.3': 'Кожна характеристика має свій ефект: CPU — {cpu} шкоди веж, GPU — {gpu} шкоди вказівника, RAM — +{ram} стартового брухту, Disk — {disk} стартової цілісності (стелі {caps}).',
  'help.mechanics-salvage.4': 'Рівень характеристики коштує {cost0} точок відновлення на рівні 0, {cost1} на рівні 1, {cost2} на рівні 2, {cost3} на рівні 3 — і далі зростає.',
  'help.mechanics-salvage.5': 'Перезапуск дає {gain20k} точок відновлення за 20 000 брухту за життя забігу і {gain60k} за 60 000.',

  // Mechanics: walls and pathing.
  'help.mechanics-walls.1': 'Стіни блокують маршрут, тож вороги обходять їх. Довший маршрут означає більше часу під вашими вежами.',
  'help.mechanics-walls.2': 'Поле відхиляє стіну (чи вежу), яка перекрила б маршрут і не лишила б шляху до виходу.',
  'help.mechanics-walls.3': 'Деякі вороги ігнорують стіни: літуни пролітають просто над ними, а проривачі прогризають їх наскрізь.',

  // Mechanics: calling waves early.
  'help.mechanics-early-call.1': 'Ви можете викликати наступну хвилю, поки ще триває поточна. Що раніше викличете, то більший бонус брухту.',
  'help.mechanics-early-call.2': 'A full-early call pays {bonus} salvage at wave 2, decaying toward a floor of {floor} the later you wait.',
  'help.mechanics-early-call.3': 'Дві хвилі можуть тривати одночасно, тож достроковий виклик — це ризик заради винагороди.',

  // Mechanics: auto-start.
  'help.mechanics-auto-start.1': 'Увімкніть «Авто», і наступна хвиля почнеться через 1,5 с після очищення поля.',
  'help.mechanics-auto-start.2': 'Воно чекає, поки вежа ремонтується, а тоді запускає.',

  // Mechanics: modifiers.
  'help.mechanics-modifiers.1': 'Пізніше в забігу хвилі несуть модифікатори, які змінюють правила.',
  'help.mechanics-modifiers.2': '- Без будівництва — поле заморожене: не можна ставити, покращувати, продавати, ремонтувати чи перенацілювати.',
  'help.mechanics-modifiers.3': '- Туман — радіус веж зменшено.',
  'help.mechanics-modifiers.4': '- Прискорення — вороги рухаються швидше.',
  'help.mechanics-modifiers.5': '- Затемнення — показник брухту приховано.',
  'help.mechanics-modifiers.6': '- Натиск — вороги з’являються щільніше.',

  // Mechanics: endless.
  'help.mechanics-endless.1': 'After wave {final} you can choose Endless and keep going.',
  'help.mechanics-endless.2': 'Безкінечні хвилі стають усе важчими. Останньої хвилі немає.',
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
  'help.enemy-grunt.1': '{hp} HP · {speed} клітинок/с.',
  'help.enemy-grunt.2': 'Найпростіший моб і мірило, з яким порівнюють усе інше. Його вбиває будь-що — це ворог, проти якого ви будуєте та якого розстрілюєте, поки вивчаєте поле.',
  'help.enemy-runner.1': '{hp} HP · {speed} клітинок/с.',
  'help.enemy-runner.2': 'Швидкий і малий, тож вежі роблять по ньому менше пострілів, а площа зазвичай промахується. Клацайте по ньому або поставте Тазер на розі, який він мусить обігнути.',
  'help.enemy-shielded.1': '{hp} HP · {speed} клітинок/с · {armour} броні · {shield} щита.',
  'help.enemy-shielded.2': 'Його щит поглинає всю шкоду веж, поки вказівник не проб’є його. Зніміть щит кліками, а тоді дайте вежам добити.',
  'help.enemy-flyer.1': '{hp} HP · {speed} клітинок/с.',
  'help.enemy-flyer.2': 'Летить просто над лабіринтом, тож стіни його не сповільнюють. Зупиняє його лише стіна «Сітка»; відповідь — вежа AA.',
  'help.enemy-armoured.1': '{hp} HP · {speed} клітинок/с · {armour} броні.',
  'help.enemy-armoured.2': 'Його броня поглинає шкоду веж (плоске віднімання, мінімум 1). Тазер ігнорує броню, і ваші кліки також її ігнорують.',
  'help.enemy-saboteur.1': '{hp} HP · {speed} клітинок/с.',
  'help.enemy-saboteur.2': 'Швидкий ворог із помірним здоров’ям. Ставтеся до нього як до міцнішого Бігуна і клацайте по ньому, поки він не перетнув поле.',
  'help.enemy-breacher.1': '{hp} HP · {speed} клітинок/с · гризе стіни.',
  'help.enemy-breacher.2': 'Прямує до ваших стін і прогризає їх, поки мала турель стріляє по найближчій вежі. Стіна знешкоджує його, поки він гризе; убийте його, перш ніж стіна впаде.',
  'help.enemy-popup.1': '{hp} HP · {speed} клітинок/с · вікно, а не прорив.',
  'help.enemy-popup.2': 'Ходяче вікно, яке захищає від ваших веж кожного ворога під ним. Клацніть його кнопку закриття, щоб прибрати його — це єдиний спосіб.',

  // Bosses in general.
  'help.bosses-in-general.1': 'Бос — це більша й зліша версія звичайного ворога. Він заявляє про себе смугою з ім’ям угорі поля.',
  'help.bosses-in-general.2': 'Боси повільні та жилаві, прорив коштує більше цілісності, а платять вони набагато більше брухту, ніж ворог, на якому засновані.',
  'help.bosses-in-general.3': 'Вказівник — надійна відповідь: кліки ігнорують броню та щити, а бос достатньо повільний, щоб клацати багато разів.',

  // Boss pages: stats line (1), gimmick (2), answer (3).
  'help.boss-grunt-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-grunt-boss.2': 'Стіна HP — еталон, з яким порівнюють кожного іншого боса. У нього немає трюку; його просто довго збивати.',
  'help.boss-grunt-boss.3': 'Зосередьте вогонь вказівника і тримайте його в радіусі ваших веж якомога довше.',
  'help.boss-runner-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-runner-boss.2': 'Anything near it keeps pace: enemies within {radius} tiles move at its speed or their own, whichever is faster.',
  'help.boss-runner-boss.3': 'Убийте його рано, поки він не прогнав хвилю через ваше поле.',
  'help.boss-shielded-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-shielded-boss.2': 'Три шари щита, по одному знімається за кожне влучання вказівника. Вежі не можуть зашкодити йому, поки не зникне останній шар.',
  'help.boss-shielded-boss.3': 'Клацайте по ньому, щоб зняти шари, а тоді дайте вежам добити.',
  'help.boss-flyer-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-flyer-boss.2': 'Hatches flyers as it flies — {brood} every {interval} s, and {death} more when it dies.',
  'help.boss-flyer-boss.3': 'Вежі AA — для рою, а самого носія збивайте кліками, поки він не дістався виходу.',
  'help.boss-armoured-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-armoured-boss.2': 'Plated and slow to chill: extra armour reduction, and slows only work {resist} as well on it.',
  'help.boss-armoured-boss.3': 'Вежі, що ігнорують броню, і ваш вказівник — це надійна шкода.',
  'help.boss-saboteur-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-saboteur-boss.2': 'Shorts out towers as it passes: any tower within {radius} tiles goes offline for {duration} s, then returns on its own.',
  'help.boss-saboteur-boss.3': 'Розосередьте вежі або вбийте його, поки він не дістався лінії.',
  'help.boss-breacher-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-breacher-boss.2': 'Прогризає ваші вежі: гризе стіни, виводить інші вежі офлайн і ставить турель.',
  'help.boss-breacher-boss.3': 'Лабіринт зі стін сповільнює його клітинку за клітинкою; тримайте вежу Ремонту за лінією.',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-gun.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-gun.3': '- **{name}** — {cost}: довша досяжність, сильніші влучання.',
  'help.tower-gun.4': '- **{name}** — {cost}: стріляє вдвічі швидше.',
  'help.tower-gun.5': 'Дешева основа проти одиночних цілей. Ставте її на довгу ділянку маршруту, щоб вона стріляла якомога довше.',

  'help.tower-cannon.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-cannon.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-cannon.3': '- **{name}** — {cost}: більша площа ураження.',
  'help.tower-cannon.4': '- **{name}** — {cost}: ставить міну кожні {interval} с, зводиться за {arm} с, до {cap} активних, {damage} шкоди з вибухом {blast}, зникає через {expire} с.',
  'help.tower-cannon.5': 'Повільний важкий удар із площею ураження. Найкраще там, де лабіринт повертає назад, щоб площа накривала скупчення.',

  'help.tower-taser.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-taser.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-taser.3': '- **{name}** — {cost}: chains to {chain} targets.',
  'help.tower-taser.4': '- **{name}** — {cost}: додаткова шкода щитам.',
  'help.tower-taser.5': 'Малий радіус і дуже швидкий, і він ігнорує броню. Ставте його з внутрішнього боку шпильки, щоб карати міцних ворогів зблизька.',

  'help.tower-frost.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-frost.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-frost.3': '- **{name}** — {cost}: сильніше сповільнення.',
  'help.tower-frost.4': '- **{name}** — {cost}: без сповільнення, справжня шкода.',
  'help.tower-frost.5': 'Slows whatever it hits to {slow} speed for {duration} s. Put it in front of your damage so enemies spend longer in range.',

  'help.tower-laser.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-laser.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-laser.3': '- **{name}** — {cost}: пробиває глибше, більше шкоди.',
  'help.tower-laser.4': '- **{name}** — {cost}: розщеплюється на три промені.',
  'help.tower-laser.5': 'Пробиває пряму лінію ворогів. Наводьте його на коридор, який ви навмисно лишили відкритим.',

  'help.tower-aa.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-aa.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-aa.3': '- **{name}** — {cost}: снаряди вибухають і зачіпають землю теж.',
  'help.tower-aa.4': '- **{name}** — {cost}: {salvo} самонавідних ракет за залп, кожна {pct} влучання.',
  'help.tower-aa.5': 'The dedicated anti-air tower. It only shoots flyers, hits them for {mult}× damage, and holds fire on ground-only waves.',

  'help.tower-beacon.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-beacon.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-beacon.3': '- **{name}** — {cost}: +{aura} шкоди вежам у радіусі.',
  'help.tower-beacon.4': '- **{name}** — {cost}: +{aura} шкоди вежам, +{pointerDamage} шкоди вказівника, +{pointerRange} досяжності вказівника.',
  'help.tower-beacon.5': 'Підсилює шкоду кожної вежі в радіусі. Ставте його над щільним скупченням.',

  'help.tower-repair.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-repair.2': 'Лікує пошкоджені вежі в радіусі. Тримайте його біля скупчення, яке хочете зберегти.',

  'help.tower-wall.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-wall.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-wall.3': '- **{name}** — {cost}: {hp} HP.',
  'help.tower-wall.4': '- **{name}** — {cost}: {hp} HP, блокує літунів.',
  'help.tower-wall.5': '- **{name}** — {cost}: {hp} HP, ворота, які ви відчиняєте й зачиняєте.',
  'help.tower-wall.6': 'Блокує маршрут і має HP. Використовуйте стіни, щоб змусити ворогів іти довшим лабіринтом.',

  'help.tower-cursor.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-cursor.2': 'Choose a branch at tier {branchTier}.',
  'help.tower-cursor.3': '- **{name}** — {cost}: {rate} кліків/с, радіус {radius} клітинок.',
  'help.tower-cursor.4': '- **{name}** — {cost}: {rate} кліків/с, радіус {radius} клітинок.',
  'help.tower-cursor.5': '- **{name}** — {cost}: ремонтує вежі нижче {pct}, коли його радіус вільний.',
  'help.tower-cursor.6': 'A second cursor that clicks enemies for {pct} of your click damage. Feed it by upgrading the pointer.',

  // Synergies (always available; docs/SYNERGIES.md §6).
  'help.synergy.title': 'Синергії',
  'help.synergy.1': 'Two adjacent towers of the right kinds link into a synergy. Adjacent means side by side — north, south, east or west, never diagonal. A chevroned line points from the tower that lends to the tower that receives.',
  'help.synergy.2': '**Синхронний вогонь** — сусідні вежі ППО стріляють як одна: швидша веде, решта стріляють разом із нею. Звичайна ППО стріляє кожні {interval} тіків.',
  'help.synergy.3': 'Ведена вежа утримує постріл, поки її ведуча не вистрілить у цей тік. Вона чекає ведучу не більше {window} тіків і ніколи понад {cap} тіків загалом.',
  'help.synergy.4': 'Синхронний постріл такий самий сильний, як і несинхронний — без бонусу до шкоди чи темпу — він просто прилітає разом із рештою.',
};
