# Translation glossary

The vocabulary every locale uses, so the HUD, the tooltips and the manual agree with each other.
Status: **draft, pending native review**. Rows marked `verified` have a source I could check; the rest
are standard renderings that a native speaker should confirm before a locale is released unflagged.

## The policy this encodes

Your point, and it is the right one: jargon is not always translated. Three behaviours, chosen per
term rather than per language.

- **Chrome is translated.** Windows terminology exists in every one of these languages because Microsoft
  shipped it. A player who knows their own OS recognises "Справка", "Paramètres", "帮助". Copying
  Microsoft's word costs nothing and reads native.
- **Game slang is transliterated in Russian and Ukrainian.** босс, крит, апгрейд are what Russian players
  actually say and read; a literal "главный противник" reads like a manual for a different game. The
  rule: chrome translates, game nouns transliterate.
- **Technical abbreviations stay.** HP and DPS do not translate into any of these languages. French is
  the one exception worth noting: PV (points de vie) is standard in French game UIs, so `HP` becomes
  `PV` there and nowhere else.
- **Chinese translates the concept, keeps the abbreviation.** 波次 and 防御塔 are native; HP stays Latin.

| Concept | es | fr | zh-Hans | ru | uk | he | Policy |
|---|---|---|---|---|---|---|---|
| Wave | oleada | vague | 波次 | волна | хвиля | גל | trans |
| Tower | torre | tour | 防御塔 | башня | вежа | מגדל | trans |
| Enemy | enemigo | ennemi | 敌人 | враг | ворог | אויב | trans |
| Boss | jefe | boss | 首领 | босс | бос | בוס | ru/uk translit, fr keeps 'boss' |
| Damage | daño | dégâts | 伤害 | урон | шкода | נזק | trans |
| Range | alcance | portée | 射程 | радиус | радіус | טווח | trans |
| Fire rate | cadencia | cadence | 射速 | скорострельность | швидкострільність | קצב ירי | trans |
| Hit points | HP | PV | 生命值 (HP) | HP | HP | HP | kept as HP except fr (PV) |
| Upgrade | mejorar | améliorer | 升级 | улучшить | покращити | שדרוג | trans; ru/uk game slang 'апгрейд' avoided in UI |
| Branch | rama | branche | 分支 | ветка | гілка | ענף | trans |
| Salvage | chatarra | ferraille | 废料 | лом | брухт | גרוטאות | trans |
| Integrity | integridad | intégrité | 完整度 | целостность | цілісність | שלמות | trans |
| Pointer | puntero | pointeur | 指针 | указатель | вказівник | סמן | trans; zh cursor is 光标 |
| Click | clic | clic | 点击 | клик | клік | לחיצה | trans |
| Wall | muro | mur | 墙 | стена | стіна | חומה | trans |
| Repair | reparación | réparation | 修理 | ремонт | ремонт | תיקון | trans |
| Flying enemy | volador | volant | 飞行敌人 | летун | літун | מעופף | trans |
| Shielded | blindado | blindé | 护盾 | под щитом | під щитом | עם מגן | trans |
| Achievement | logro | succès | 成就 | достижение | досягнення | הישג | trans |
| Daily challenge | desafío diario | défi du jour | 每日挑战 | ежедневный вызов | щоденний виклик | אתגר יומי | trans |
| Map editor | editor de mapas | éditeur de cartes | 地图编辑器 | редактор карт | редактор карт | עורך מפות | trans |
| Save | guardar | enregistrer | 保存 | сохранить | зберегти | שמור | trans (verb form, as in menu items) |
| Restore | restaurar | restaurer | 恢复 | восстановить | відновити | שחזר | trans; he verified 'שחזור מערכת' = System Restore |
| Settings | configuración | paramètres | 设置 | параметры | параметри | הגדרות | trans |
| Help | ayuda | aide | 帮助 | справка | довідка | עזרה | trans |
| Contents | contenido | sommaire | 目录 | содержание | зміст | תוכן | trans |
| Index | índice | index | 索引 | указатель | покажчик | אינדקס | trans |
| Search | buscar | rechercher | 搜索 | поиск | пошук | חיפוש | trans |
| Overclock | overclock | overclock | 超频 | разгон | розгін | המהרה | kept in es/fr; trans in zh/ru/uk/he |
| Critical hit | crítico | coup critique | 暴击 | крит | крит | פגיעה קריטית | ru/uk game slang translit |

## Confidence notes

- `Restore` in Hebrew is `verified` — Hebrew Windows documentation uses "שחזור מערכת" for System Restore.
- `Integrity` in Chinese is `verified` as 完整性 (Microsoft's Win32 integrity documentation).
- Russian and Ukrainian `Upgrade`: the UI verb is улучшить / покращити. The transliteration апгрейд exists
  but reads as gamer slang and should not be used for a button.
- French `boss` is kept in game contexts and translated as "boss" in manuals too; do not write "patron".

## Rules

- Do not translate `Pointer Defense`, `DPS`, `HP` (except fr: `PV`), or the Windows product names the
  chrome imitates.
- Numbers, `$` and units are formatted by `Intl`, never translated or reordered. Hebrew keeps digits in
  a left-to-right run inside right-to-left text.
- Chinese needs no spaces around numbers; French needs a non-breaking space before `:` `;` `?` `!`.

## Locale-specific traps

- **Hebrew `Cursor` vs `Pointer`.** Both are `סמן` in ordinary Hebrew, which makes the Cursor tower and
  the pointer panel read as the same thing. The pointer keeps `סמן`; the Cursor tower is `מצביע`
  ("pointer"), which is distinct and still reads as a device. A native reviewer may prefer a different
  split — flag it, don't silently collapse them again.
