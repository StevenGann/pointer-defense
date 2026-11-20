import type { Catalogue } from '../index.ts';

/**
 * The Hebrew Help-page prose — a machine draft, pending native review.
 *
 * Key-for-key with src/i18n/en/help.ts (docs/HELP-PROSE.md). Key names and {placeholders} are
 * byte-identical to the English catalogue; only the prose is translated. Tower and enemy names,
 * tier labels, branch letters and id-like tokens (HP, DPS, CPU, GPU, RAM, Disk, AA) stay
 * untranslated. Vocabulary follows docs/GLOSSARY.md and src/i18n/he/index.ts.
 */
export const help: Catalogue = {
  // Chapter names.
  'help.category.getting-started': 'תחילת הדרך',
  'help.category.mechanics': 'מכניקה',
  'help.category.enemies': 'אויבים',
  'help.category.bosses': 'בוסים',
  'help.category.towers': 'מגדלים',

  // Table headers (the generated enemy HP table and the tower tier ladder).
  'help.table.tier': 'דרגה',
  'help.table.cost': 'עלות',
  'help.table.wave': 'גל',
  'help.table.hp': 'HP',
  'help.table.heal': 'ריפוי',

  // Page titles that are not a tower or enemy name (those keep towerName() / enemyName()).
  'help.page.getting-started.title': 'תחילת הדרך',
  'help.page.mechanics-pointer.title': 'סולם הסמן',
  'help.page.mechanics-salvage.title': 'גרוטאות ומפרטים',
  'help.page.mechanics-walls.title': 'חומות וניתוב',
  'help.page.mechanics-early-call.title': 'קריאה מוקדמת של גלים',
  'help.page.mechanics-auto-start.title': 'התחלה אוטומטית',
  'help.page.mechanics-modifiers.title': 'שינויים',
  'help.page.mechanics-endless.title': 'אינסופי',
  'help.page.bosses-in-general.title': 'בוסים',

  // Getting started.
  'help.getting-started.1': 'ריצה היא סדרה של גלים. בין הגלים אתה בונה; במהלך גל האויבים צועדים במסלול ואתה לוחץ עליהם.',
  'help.getting-started.2': 'שלב הבנייה: הצב מגדלים ועצב את המבוך. לחץ על התחל גל (או Enter) כשתהיה מוכן.',
  'help.getting-started.3': 'גלים: אויבים חוצים מהכניסה ליציאה. כל מה שעובר גובה שלמות.',
  'help.getting-started.4': 'שלמות: אתה מתחיל עם 20. כשהיא מגיעה לאפס הריצה נגמרת.',
  'help.getting-started.5': 'הסמן: לחץ על אויבים כדי לירות בהם. כוון אל החריץ המוביל כדי להסב נזק כפול.',
  'help.getting-started.6': 'מגדלי קרב משתדרגים דרך {maxTier} דרגות; חומות, מתקן והמצביע נעצרים מוקדם יותר בסולמות שלהם.',

  // Mechanics: the pointer ladder.
  'help.mechanics-pointer.1': 'לחיצה פשוטה מסבה {click} נזק; הכוונת מסבה {reticle} ומחזיקה {hold} נזק לשנייה.',
  'help.mechanics-pointer.2': 'דרגות המהרה מכפילות את נזק הלחיצה ב-{growth} כל אחת, {milestones}, עם תקרה של {maxLevel}; אחת נפתחת כל {divisor} גלים.',
  'help.mechanics-pointer.3': 'לחיצה מבצעת קריט של {crit}× — {base} בסיס, +{marked} על אויב מסומן, +{weak} על נקודת התורפה. הסימון מוסיף {mark} נזק.',
  'help.mechanics-pointer.4': 'לחיצות מתעלמות משריון ושוחקות מגנים, כך שהסמן הוא התשובה לאויבים שהמגדלים שלך אינם יכולים לגעת בהם.',
  'help.mechanics-pointer.5': 'שדרג את הסמן מהחלונית הימנית במהלך ריצה.',

  // Mechanics: salvage and specs.
  'help.mechanics-salvage.1': 'גרוטאות הן המטבע של הריצה: חיסולים משלמים אותן, ואתה מוציא אותן על מגדלים, שדרוגים והסמן.',
  'help.mechanics-salvage.2': 'מפרטים הם קבועים. הפעלה מחדש צוברת נקודות שחזור מסך הגרוטאות של הריצה, והן עוברות לריצה הבאה.',
  'help.mechanics-salvage.3': 'לכל מפרט יש אפקט: CPU נזק מגדלים {cpu}, GPU נזק סמן {gpu}, RAM +{ram} גרוטאות פתיחה, Disk שלמות פתיחה {disk} (תקרות {caps}).',
  'help.mechanics-salvage.4': 'דרגת מפרט עולה {cost0} נקודות שחזור בדרגה 0, {cost1} בדרגה 1, {cost2} בדרגה 2, {cost3} בדרגה 3, וממשיכה לטפס.',
  'help.mechanics-salvage.5': 'הפעלה מחדש צוברת {gain20k} נקודות שחזור ב-20,000 גרוטאות לכל החיים ו-{gain60k} ב-60,000.',

  // Mechanics: walls and pathing.
  'help.mechanics-walls.1': 'חומות חוסמות את המסלול, כך שאויבים הולכים סביבן. מסלול ארוך יותר פירושו יותר זמן מתחת למגדלים שלך.',
  'help.mechanics-walls.2': 'הלוח דוחה חומה (או מגדל) שתחסום את המסלול ולא תשאיר נתיב אל היציאה.',
  'help.mechanics-walls.3': 'יש אויבים שמתעלמים מחומות: מעופפים טסים ישר מעליהן, ופורצים מכרסמים דרכן.',

  // Mechanics: calling waves early.
  'help.mechanics-early-call.1': 'אתה יכול לקרוא לגל הבא בזמן שגל עדיין רץ. ככל שתקרא מוקדם יותר, כך בונוס הגרוטאות גדול יותר.',
  'help.mechanics-early-call.2': 'קריאה מוקדמת מלאה משלמת {bonus} גרוטאות בגל 2, ומתדרדרת לעבר רצפה של 5 ככל שתחכה יותר.',
  'help.mechanics-early-call.3': 'שני גלים יכולים לרוץ בבת אחת, כך שקריאה מוקדמת היא סיכון תמורת תמורה.',

  // Mechanics: auto-start.
  'help.mechanics-auto-start.1': 'הפעל אוטומטי והגל הבא יתחיל 1.5 שניות אחרי שהלוח מתפנה.',
  'help.mechanics-auto-start.2': 'הוא ממתין בזמן שמגדל נמצא בתיקון, ואז יורה.',

  // Mechanics: modifiers.
  'help.mechanics-modifiers.1': 'משלב מאוחר יותר בריצה, גלים נושאים שינויים שמשנים את הכללים.',
  'help.mechanics-modifiers.2': '- ללא בנייה — הלוח קפוא: אין הצבה, שדרוג, מכירה, תיקון או כיוון מחדש.',
  'help.mechanics-modifiers.3': '- ערפל — טווח המגדל מצטמצם.',
  'help.mechanics-modifiers.4': '- הרצה מהירה — אויבים נעים מהר יותר.',
  'help.mechanics-modifiers.5': '- החשכה — תצוגת הגרוטאות שלך מוסתרת.',
  'help.mechanics-modifiers.6': '- הסתערות — הזימונים מגיעים קרוב יותר זה לזה.',

  // Mechanics: endless.
  'help.mechanics-endless.1': 'אחרי הגל המאה אתה יכול לבחור אינסופי ולהמשיך הלאה.',
  'help.mechanics-endless.2': 'גלים אינסופיים ממשיכים להיות קשים יותר. אין גל אחרון.',

  // Enemies: the generated stats line (body line 1) and the answer paragraph (body line 2).
  'help.enemy-grunt.1': '{hp} HP · {speed} משבצות/שנייה.',
  'help.enemy-grunt.2': 'החייל הבסיסי, היחידה שכל השאר נמדדים מולה. הכול הורג אותו — זה האויב שאתה בונה ויורה עליו בזמן שלומדים את הלוח.',
  'help.enemy-runner.1': '{hp} HP · {speed} משבצות/שנייה.',
  'help.enemy-runner.2': 'מהיר וקטן, כך שמגדלים מספיקים לירות בו פחות, ופגיעות אזוריות בדרך כלל מחטיאות. לחץ עליו, או הצמד טייזר לפינה שהוא חייב לעקוף.',
  'help.enemy-shielded.1': '{hp} HP · {speed} משבצות/שנייה · {armour} שריון · {shield} מגן.',
  'help.enemy-shielded.2': 'המגן שלו סופג את כל נזק המגדלים עד שהסמן שובר אותו. הורד את המגן בלחיצה, ואז תן למגדלים שלך לסיים אותו.',
  'help.enemy-flyer.1': '{hp} HP · {speed} משבצות/שנייה.',
  'help.enemy-flyer.2': 'טס ישר מעל המבוך, כך שחומות אינן מאטות אותו. רק חומת רשת עוצרת אותו; מגדל ה-AA הוא התשובה.',
  'help.enemy-armoured.1': '{hp} HP · {speed} משבצות/שנייה · {armour} שריון.',
  'help.enemy-armoured.2': 'השריון שלו סופג נזק מגדלים (הפחתה קבועה, עם רצפה של 1). טייזר מתעלם משריון, וגם הלחיצות שלך מתעלמות ממנו.',
  'help.enemy-saboteur.1': '{hp} HP · {speed} משבצות/שנייה.',
  'help.enemy-saboteur.2': 'אויב מהיר עם בריאות בינונית. התייחס אליו כאל רץ קשוח יותר ולחץ עליו לפני שהוא חוצה את הלוח.',
  'help.enemy-breacher.1': '{hp} HP · {speed} משבצות/שנייה · מכרסם חומות.',
  'help.enemy-breacher.2': 'פונה אל החומות שלך ומכרסם דרכן, בזמן שצריח קטן יורה על המגדל הקרוב ביותר. חומה מנטרלת אותו בזמן שהוא מכרסם; הרוג אותו לפני שהחומה נופלת.',
  'help.enemy-popup.1': '{hp} HP · {speed} משבצות/שנייה · חלון, לא דליפה.',
  'help.enemy-popup.2': 'חלון מהלך שמגן על כל אויב שמתחתיו מפני המגדלים שלך. לחץ על תיבת הסגירה שלו כדי להסירו — זו הדרך היחידה.',

  // Bosses in general.
  'help.bosses-in-general.1': 'בוס הוא גרסה גדולה ומרושעת יותר של אויב רגיל. הוא מכריז על עצמו בפס שם לרוחב החלק העליון של המגרש.',
  'help.bosses-in-general.2': 'בוסים הם איטיים וקשוחים, דולפים ביותר שלמות, ומשלמים הרבה יותר גרוטאות מהאויב שעליו הם מבוססים.',
  'help.bosses-in-general.3': 'הסמן הוא התשובה האמינה: לחיצות מתעלמות משריון וממגנים, ובוס הוא איטי מספיק כדי ללחוץ עליו פעמים רבות.',

  // Boss pages: stats line (1), gimmick (2), answer (3).
  'help.boss-grunt-boss.1': '{hp} HP · {speed} משבצות/שנייה · {integrity} שלמות אם הוא דולף.',
  'help.boss-grunt-boss.2': 'חומה של נקודות חיים — קו הבסיס שכל בוס אחר נמדד מולו. אין לו תכסיס; פשוט לוקח זמן רב להוריד אותו.',
  'help.boss-grunt-boss.3': 'רכז אש עם הסמן ושמור אותו בתוך טווח המגדלים שלך כמה שיותר זמן.',
  'help.boss-runner-boss.1': '{hp} HP · {speed} משבצות/שנייה · {integrity} שלמות אם הוא דולף.',
  'help.boss-runner-boss.2': 'כל מה שקרוב אליו עומד בקצב: אויבים בטווח 3 משבצות נעים במהירות שלו או במהירות שלהם — הגבוהה מביניהן.',
  'help.boss-runner-boss.3': 'הרוג אותו מוקדם, לפני שהוא מוביל גל לרוחב הלוח שלך.',
  'help.boss-shielded-boss.1': '{hp} HP · {speed} משבצות/שנייה · {integrity} שלמות אם הוא דולף.',
  'help.boss-shielded-boss.2': 'שלוש שכבות של מיגון, אחת מוסרת בכל פגיעת סמן. מגדלים אינם יכולים לפגוע בו עד שהשכבה האחרונה נעלמת.',
  'help.boss-shielded-boss.3': 'לחץ עליו כדי להסיר את השכבות, ואז תן למגדלים שלך לסיים אותו.',
  'help.boss-flyer-boss.1': '{hp} HP · {speed} משבצות/שנייה · {integrity} שלמות אם הוא דולף.',
  'help.boss-flyer-boss.2': 'מדגיר מעופפים תוך כדי תעופה — שלושה כל 4 שניות, ושישה נוספים כשהוא מת.',
  'help.boss-flyer-boss.3': 'מגדלי AA לצאצאים, ולחץ על הנושאת עצמה עד שתיפול לפני שהיא מגיעה ליציאה.',
  'help.boss-armoured-boss.1': '{hp} HP · {speed} משבצות/שנייה · {integrity} שלמות אם הוא דולף.',
  'help.boss-armoured-boss.2': 'משוריין ואיטי להתקרר: הפחתת שריון נוספת, והאטות פועלות עליו רק בחצי מעוצמתן.',
  'help.boss-armoured-boss.3': 'מגדלים שמתעלמים משריון והסמן שלך הם הנזק האמין.',
  'help.boss-saboteur-boss.1': '{hp} HP · {speed} משבצות/שנייה · {integrity} שלמות אם הוא דולף.',
  'help.boss-saboteur-boss.2': 'מקצר מגדלים כשהוא חולף: כל מגדל בטווח 2.5 משבצות יורד מהרשת ל-3 שניות, ואז חוזר מעצמו.',
  'help.boss-saboteur-boss.3': 'פזר את המגדלים שלך, או הרוג אותו לפני שהוא מגיע לקו.',
  'help.boss-breacher-boss.1': '{hp} HP · {speed} משבצות/שנייה · {integrity} שלמות אם הוא דולף.',
  'help.boss-breacher-boss.2': 'אוכל דרך המגדלים שלך: הוא מכרסם חומות ומוריד מגדלים אחרים מהרשת, ומרכיב צריח.',
  'help.boss-breacher-boss.3': 'מבוך חומות מאט אותו משבצת אחר משבצת; שמור מגדל מתקן מאחורי הקו.',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-gun.2': 'בחר ענף בדרגה 3.',
  'help.tower-gun.3': '- **{name}** — {cost}: טווח ארוך יותר, פגיעות חזקות יותר.',
  'help.tower-gun.4': '- **{name}** — {cost}: יורה פי שניים מהר.',
  'help.tower-gun.5': 'עמוד השדרה הזול החד-מטרתי. שים אותו על קטע מסלול ארוך כך שיירה במשך הזמן הרב ביותר.',

  'help.tower-cannon.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-cannon.2': 'בחר ענף בדרגה 3.',
  'help.tower-cannon.3': '- **{name}** — {cost}: התזה גדולה יותר.',
  'help.tower-cannon.4': '- **{name}** — {cost}: מניח מוקש כל {interval} שניות, מתחמש תוך {arm} שניות, תקרה של {cap} פעילים, {damage} נזק בפיצוץ של {blast} משבצות, פוקע תוך {expire} שניות.',
  'help.tower-cannon.5': 'פוגע איטי וכבד עם התזה. הכי טוב במקום שבו המבוך חוזר על עקבותיו, כך שההתזה תופסת צבר.',

  'help.tower-taser.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-taser.2': 'בחר ענף בדרגה 3.',
  'help.tower-taser.3': '- **{name}** — {cost}: משתרשר ל-3 מטרות.',
  'help.tower-taser.4': '- **{name}** — {cost}: נזק נוסף למגנים.',
  'help.tower-taser.5': 'טווח קצר ומהיר מאוד, והוא מתעלם משריון. הצב אותו בחלק הפנימי של פניית פרסה כדי להעניש אויבים קשוחים מקרוב.',

  'help.tower-frost.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-frost.2': 'בחר ענף בדרגה 3.',
  'help.tower-frost.3': '- **{name}** — {cost}: האטה חזקה יותר.',
  'help.tower-frost.4': '- **{name}** — {cost}: ללא האטה, נזק אמיתי.',
  'help.tower-frost.5': 'מאט את כל מה שהוא פוגע בו ל-30% מהירות למשך 3 שניות. שים אותו לפני הנזק שלך כך שאויבים יבלו יותר זמן בטווח.',

  'help.tower-laser.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-laser.2': 'בחר ענף בדרגה 3.',
  'help.tower-laser.3': '- **{name}** — {cost}: חודר עמוק יותר, יותר נזק.',
  'help.tower-laser.4': '- **{name}** — {cost}: מתפצל לשלוש קרניים.',
  'help.tower-laser.5': 'חודר קו ישר של אויבים. כוון אותו במורד מסדרון שהשארת פתוח במכוון.',

  'help.tower-aa.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-aa.2': 'בחר ענף בדרגה 3.',
  'help.tower-aa.3': '- **{name}** — {cost}: פגזים מתפוצצים ופוגעים גם בקרקע.',
  'help.tower-aa.4': '- **{name}** — {cost}: {salvo} טילים מתבייתים לכל מטח, כל אחד {pct} מפגיעה.',
  'help.tower-aa.5': 'המגדל הייעודי נגד מטוסים. הוא יורה רק במעופפים, פוגע בהם בנזק כפול, ונמנע מירי בגלים קרקעיים בלבד.',

  'help.tower-beacon.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-beacon.2': 'בחר ענף בדרגה 3.',
  'help.tower-beacon.3': '- **{name}** — {cost}: +{aura} נזק למגדלים ברדיוס.',
  'help.tower-beacon.4': '- **{name}** — {cost}: +{aura} נזק למגדלים, +{pointerDamage} נזק סמן, +{pointerRange} טווח סמן.',
  'help.tower-beacon.5': 'מחזק את הנזק של כל מגדל ברדיוס שלו. הצב אותו מעל צבר צפוף.',

  'help.tower-repair.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-repair.2': 'מרפא מגדלים פגומים ברדיוס שלו. שמור אותו ליד צבר שאתה רוצה שישרוד.',

  'help.tower-wall.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-wall.2': 'בחר ענף בדרגה 3.',
  'help.tower-wall.3': '- **{name}** — {cost}: {hp} HP.',
  'help.tower-wall.4': '- **{name}** — {cost}: {hp} HP, חוסם מעופפים.',
  'help.tower-wall.5': '- **{name}** — {cost}: {hp} HP, שער שאתה פותח וסוגר.',
  'help.tower-wall.6': 'חוסם את המסלול ויש לו נקודות חיים. השתמש בחומות כדי לגרום לאויבים ללכת במבוך ארוך יותר.',

  'help.tower-cursor.1': 'עלות {cost} · נפתח בגל {unlock}.',
  'help.tower-cursor.2': 'בחר ענף בדרגה 3.',
  'help.tower-cursor.3': '- **{name}** — {cost}: {rate} לחיצות/שנייה, רדיוס {radius} משבצות.',
  'help.tower-cursor.4': '- **{name}** — {cost}: {rate} לחיצות/שנייה, רדיוס {radius} משבצות.',
  'help.tower-cursor.5': '- **{name}** — {cost}: מתקן מגדלים מתחת ל-{pct} כשהרדיוס שלו פנוי.',
  'help.tower-cursor.6': 'מצביע שני שלוחץ על אויבים בחצי מנזק הלחיצה שלך. הזן אותו על ידי שדרוג הסמן.',

  // Synergies (always available; docs/SYNERGIES.md §6).
  'help.synergy.title': 'סינרגיות',
  'help.synergy.1': 'שני מגדלים סמוכים מהסוגים הנכונים מתחברים לסינרגיה. סמוך פירושו צמודים — צפון, דרום, מזרח או מערב, לעולם לא באלכסון.',
  'help.synergy.2': '**אש מסונכרנת** — מגדלי נ"מ סמוכים יורים כאחד: המהיר מוביל והאחרים יורים איתו. נ"מ רגיל יורה כל {interval} תיקים.',
  'help.synergy.3': 'עוקב מחזיק את הירייה שלו עד שהמוביל יורה באותו תיק. הוא ממתין למוביל לכל היותר {window} תיקים, ולעולם לא יותר מ-{cap} תיקים בסך הכול.',
  'help.synergy.4': 'ירייה מסונכרנת חזקה בדיוק כמו ירייה לא מסונכרנת — בלי בונוס נזק או קצב — היא פשוט נוחתת עם השאר.',
};
