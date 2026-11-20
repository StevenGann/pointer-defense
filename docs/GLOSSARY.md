# Translation glossary

Every locale uses these terms for these concepts, so the manual, the HUD and the tooltips agree with
each other. Windows' own localised terminology wins wherever it applies — a player who knows their
operating system should recognise the word.

Status: **draft**. These are first-pass renderings and need a native review before any locale ships
unflagged (see `docs/LOCALES.md`).

| Concept | es | fr | zh-Hans | ru | uk | he |
|---|---|---|---|---|---|---|
| Wave | oleada | vague | 波次 | волна | хвиля | גל |
| Tower | torre | tour | 塔 | башня | вежа | מגדל |
| Enemy | enemigo | ennemi | 敌人 | враг | ворог | אויב |
| Boss | jefe | boss | 首领 | босс | бос | בוס |
| Damage | daño | dégâts | 伤害 | урон | шкода | נזק |
| Range | alcance | portée | 射程 | радиус | радіус | טווח |
| Fire rate | cadencia | cadence | 射速 | скорость стрельбы | швидкість вогню | קצב ירי |
| Upgrade | mejorar | améliorer | 升级 | улучшить | покращити | שדרוג |
| Branch | rama | branche | 分支 | ветка | гілка | ענף |
| Salvage | chatarra | ferraille | 废料 | лом | брухт | גרוטאות |
| Integrity | integridad | intégrité | 完整度 | целостность | цілісність | שלמות |
| Pointer | puntero | pointeur | 指针 | указатель | вказівник | סמן |
| Click | clic | clic | 点击 | клик | клік | לחיצה |
| Wall | muro | mur | 墙 | стена | стіна | חומה |
| Repair | reparación | réparation | 修理 | ремонт | ремонт | תיקון |
| Flyer | volador | volant | 飞行敌人 | летун | літун | מעופף |
| Shielded | blindado | blindé | 护盾 | под щитом | під щитом | עם מגן |
| Achievement | logro | succès | 成就 | достижение | досягнення | הישג |
| Daily challenge | desafío diario | défi du jour | 每日挑战 | ежедневный вызов | щоденний виклик | אתגר יומי |
| Map editor | editor de mapas | éditeur de cartes | 地图编辑器 | редактор карт | редактор карт | עורך מפות |
| Save | guardar | enregistrer | 保存 | сохранить | зберегти | שמור |
| Restore (service pack) | restaurar | restaurer | 恢复 | восстановить | відновити | שחזר |
| Settings | configuración | paramètres | 设置 | настройки | налаштування | הגדרות |
| Help | ayuda | aide | 帮助 | справка | довідка | עזרה |
| Contents | contenido | sommaire | 目录 | содержание | зміст | תוכן |
| Index | índice | index | 索引 | указатель | покажчик | אינדקס |
| Search | buscar | rechercher | 搜索 | поиск | пошук | חיפוש |
| Wave clear bonus | bonificación por oleada | prime de vague | 波次奖励 | бонус за волну | бонус за хвилю | בונוס גל |
| Overclock | overclock | overclock | 超频 | разгон | розгін | המהרה |
| Critical hit | crítico | critique | 暴击 | крит | крит | פגיעה קריטית |

Rules:

- Do not translate `Pointer Defense`, `RPM`, `DPS`, or the Windows product names the chrome imitates.
- Keep numbers, `$` and units out of the glossary: they are formatted, not translated.
- Hebrew writes numbers left-to-right inside RTL text; never reorder digits.
- Chinese uses no spaces between words; do not add them around numbers.
