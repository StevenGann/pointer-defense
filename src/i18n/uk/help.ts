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
  'help.page.bosses-in-general.title': 'Боси',

  // Getting started.
  'help.getting-started.1': 'Забіг — це послідовність хвиль. Між хвилями ви будуєте; під час хвилі вороги йдуть маршрутом, і ви клацаєте по них.',
  'help.getting-started.2': 'Фаза будівництва: ставте вежі й формуйте лабіринт. Натисніть «Почати хвилю» (або Enter), коли будете готові.',
  'help.getting-started.3': 'Хвилі: вороги йдуть від входу до виходу. Усе, що пройшло наскрізь, коштує цілісності.',
  'help.getting-started.4': 'Цілісність: ви починаєте з 20. Коли вона сягне нуля, забіг завершується.',
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
  'help.mechanics-early-call.2': 'Повністю достроковий виклик дає {bonus} брухту на хвилі 2, спадаючи до межі 5, що пізніше ви чекаєте.',
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
  'help.mechanics-endless.1': 'Після сотої хвилі ви можете обрати «Безкінечний» і продовжити.',
  'help.mechanics-endless.2': 'Безкінечні хвилі стають усе важчими. Останньої хвилі немає.',

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
  'help.boss-runner-boss.2': 'Усе поруч із ним тримає темп: вороги в межах 3 клітинок рухаються з його швидкістю чи власною — що швидше.',
  'help.boss-runner-boss.3': 'Убийте його рано, поки він не прогнав хвилю через ваше поле.',
  'help.boss-shielded-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-shielded-boss.2': 'Три шари щита, по одному знімається за кожне влучання вказівника. Вежі не можуть зашкодити йому, поки не зникне останній шар.',
  'help.boss-shielded-boss.3': 'Клацайте по ньому, щоб зняти шари, а тоді дайте вежам добити.',
  'help.boss-flyer-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-flyer-boss.2': 'Випускає літунів у польоті — трьох кожні 4 с і ще шістьох, коли гине.',
  'help.boss-flyer-boss.3': 'Вежі AA — для рою, а самого носія збивайте кліками, поки він не дістався виходу.',
  'help.boss-armoured-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-armoured-boss.2': 'Броньований і повільно охолоджується: додаткове зниження броні, а сповільнення діє на нього лише наполовину.',
  'help.boss-armoured-boss.3': 'Вежі, що ігнорують броню, і ваш вказівник — це надійна шкода.',
  'help.boss-saboteur-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-saboteur-boss.2': 'Виводить вежі з ладу, проходячи повз: будь-яка вежа в межах 2,5 клітинки йде офлайн на 3 с, а тоді повертається сама.',
  'help.boss-saboteur-boss.3': 'Розосередьте вежі або вбийте його, поки він не дістався лінії.',
  'help.boss-breacher-boss.1': '{hp} HP · {speed} клітинок/с · {integrity} цілісності за прорив.',
  'help.boss-breacher-boss.2': 'Прогризає ваші вежі: гризе стіни, виводить інші вежі офлайн і ставить турель.',
  'help.boss-breacher-boss.3': 'Лабіринт зі стін сповільнює його клітинку за клітинкою; тримайте вежу Ремонту за лінією.',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-gun.2': 'Оберіть гілку на рівні 3.',
  'help.tower-gun.3': '- **{name}** — {cost}: довша досяжність, сильніші влучання.',
  'help.tower-gun.4': '- **{name}** — {cost}: стріляє вдвічі швидше.',
  'help.tower-gun.5': 'Дешева основа проти одиночних цілей. Ставте її на довгу ділянку маршруту, щоб вона стріляла якомога довше.',

  'help.tower-cannon.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-cannon.2': 'Оберіть гілку на рівні 3.',
  'help.tower-cannon.3': '- **{name}** — {cost}: більша площа ураження.',
  'help.tower-cannon.4': '- **{name}** — {cost}: ставить міну кожні {interval} с, зводиться за {arm} с, до {cap} активних, {damage} шкоди з вибухом {blast}, зникає через {expire} с.',
  'help.tower-cannon.5': 'Повільний важкий удар із площею ураження. Найкраще там, де лабіринт повертає назад, щоб площа накривала скупчення.',

  'help.tower-taser.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-taser.2': 'Оберіть гілку на рівні 3.',
  'help.tower-taser.3': '- **{name}** — {cost}: б’є ланцюгом по 3 цілях.',
  'help.tower-taser.4': '- **{name}** — {cost}: додаткова шкода щитам.',
  'help.tower-taser.5': 'Малий радіус і дуже швидкий, і він ігнорує броню. Ставте його з внутрішнього боку шпильки, щоб карати міцних ворогів зблизька.',

  'help.tower-frost.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-frost.2': 'Оберіть гілку на рівні 3.',
  'help.tower-frost.3': '- **{name}** — {cost}: сильніше сповільнення.',
  'help.tower-frost.4': '- **{name}** — {cost}: без сповільнення, справжня шкода.',
  'help.tower-frost.5': 'Сповільнює все, у що влучає, до 30% швидкості на 3 с. Ставте його перед вашими вежами шкоди, щоб вороги довше лишалися в радіусі.',

  'help.tower-laser.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-laser.2': 'Оберіть гілку на рівні 3.',
  'help.tower-laser.3': '- **{name}** — {cost}: пробиває глибше, більше шкоди.',
  'help.tower-laser.4': '- **{name}** — {cost}: розщеплюється на три промені.',
  'help.tower-laser.5': 'Пробиває пряму лінію ворогів. Наводьте його на коридор, який ви навмисно лишили відкритим.',

  'help.tower-aa.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-aa.2': 'Оберіть гілку на рівні 3.',
  'help.tower-aa.3': '- **{name}** — {cost}: снаряди вибухають і зачіпають землю теж.',
  'help.tower-aa.4': '- **{name}** — {cost}: {salvo} самонавідних ракет за залп, кожна {pct} влучання.',
  'help.tower-aa.5': 'Спеціалізована протиповітряна вежа. Вона стріляє лише по літунах, б’є їх подвійною шкодою й не стріляє на хвилях лише з наземними.',

  'help.tower-beacon.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-beacon.2': 'Оберіть гілку на рівні 3.',
  'help.tower-beacon.3': '- **{name}** — {cost}: +{aura} шкоди вежам у радіусі.',
  'help.tower-beacon.4': '- **{name}** — {cost}: +{aura} шкоди вежам, +{pointerDamage} шкоди вказівника, +{pointerRange} досяжності вказівника.',
  'help.tower-beacon.5': 'Підсилює шкоду кожної вежі в радіусі. Ставте його над щільним скупченням.',

  'help.tower-repair.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-repair.2': 'Лікує пошкоджені вежі в радіусі. Тримайте його біля скупчення, яке хочете зберегти.',

  'help.tower-wall.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-wall.2': 'Оберіть гілку на рівні 3.',
  'help.tower-wall.3': '- **{name}** — {cost}: {hp} HP.',
  'help.tower-wall.4': '- **{name}** — {cost}: {hp} HP, блокує літунів.',
  'help.tower-wall.5': '- **{name}** — {cost}: {hp} HP, ворота, які ви відчиняєте й зачиняєте.',
  'help.tower-wall.6': 'Блокує маршрут і має HP. Використовуйте стіни, щоб змусити ворогів іти довшим лабіринтом.',

  'help.tower-cursor.1': 'Вартість {cost} · розблоковується на хвилі {unlock}.',
  'help.tower-cursor.2': 'Оберіть гілку на рівні 3.',
  'help.tower-cursor.3': '- **{name}** — {cost}: {rate} кліків/с, радіус {radius} клітинок.',
  'help.tower-cursor.4': '- **{name}** — {cost}: {rate} кліків/с, радіус {radius} клітинок.',
  'help.tower-cursor.5': '- **{name}** — {cost}: ремонтує вежі нижче {pct}, коли його радіус вільний.',
  'help.tower-cursor.6': 'Другий курсор, що клацає по ворогах за половину вашої шкоди кліком. Живіть його, покращуючи вказівник.',
};
