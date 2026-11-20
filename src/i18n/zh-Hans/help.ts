import type { Catalogue } from '../index.ts';

/**
 * Simplified Chinese (zh-Hans) Help-page prose — machine draft, pending native review.
 *
 * Every key here is byte-identical to the English module (src/i18n/en/help.ts); `{placeholders}`
 * are preserved unchanged and may be reordered, never added, dropped or renamed. `Pointer Defense`,
 * `HP`, `DPS`, tier letters and the `CPU`/`GPU`/`RAM`/`Disk` spec names stay in Latin letters.
 * Tower and enemy names come from `names.ts` at render time, not here. Markdown structure (bullets,
 * bold, tables) matches the English source. Follows docs/HELP-PROSE.md and docs/GLOSSARY.md.
 */
export const help: Catalogue = {
  // Chapter names.
  'help.category.getting-started': '入门',
  'help.category.mechanics': '机制',
  'help.category.enemies': '敌人',
  'help.category.bosses': '首领',
  'help.category.towers': '防御塔',

  // Table headers (the generated enemy HP table and the tower tier ladder).
  'help.table.tier': '等级',
  'help.table.cost': '费用',
  'help.table.wave': '波次',
  'help.table.hp': 'HP',
  'help.table.heal': '治疗',

  // Page titles that are not a tower or enemy name (those keep towerName() / enemyName()).
  'help.page.getting-started.title': '入门',
  'help.page.mechanics-pointer.title': '指针阶梯',
  'help.page.mechanics-salvage.title': '废料与规格',
  'help.page.mechanics-walls.title': '墙与寻路',
  'help.page.mechanics-early-call.title': '提前呼叫波次',
  'help.page.mechanics-auto-start.title': '自动开始',
  'help.page.mechanics-modifiers.title': '词缀',
  'help.page.mechanics-endless.title': '无尽',
  'help.page.bosses-in-general.title': '首领',

  // Getting started.
  'help.getting-started.1': '一局游戏由一系列波次组成。波次之间你建造；波次进行时敌人沿路线前进，你点击它们。',
  'help.getting-started.2': '建造阶段：放置防御塔并设计迷宫。准备好后点击“开始波次”（或按回车）。',
  'help.getting-started.3': '波次：敌人从入口移动到出口。任何穿过的敌人都会消耗完整度。',
  'help.getting-started.4': '完整度：你以 20 点开局。当它归零时本局结束。',
  'help.getting-started.5': '指针：点击敌人射击它们。瞄准前方的凹槽以造成双倍伤害。',
  'help.getting-started.6': '战斗防御塔可升级至 {maxTier} 级；墙、修理和光标则在各自的阶梯上更早停止。',

  // Mechanics: the pointer ladder.
  'help.mechanics-pointer.1': '一次点击造成 {click} 伤害；准星造成 {reticle} 伤害，按住时每秒造成 {hold} 伤害。',
  'help.mechanics-pointer.2': '超频等级每级将点击伤害乘以 {growth}，里程碑倍率为 {milestones}，上限 {maxLevel} 级；每 {divisor} 波解锁一级。',
  'help.mechanics-pointer.3': '点击可暴击造成 {crit}× 伤害——基础 {base}，对标记敌人 +{marked}，对弱点 +{weak}。标记额外增加 {mark} 伤害。',
  'help.mechanics-pointer.4': '点击无视护甲并能磨掉护盾，因此对于防御塔无法对付的敌人，指针就是答案。',
  'help.mechanics-pointer.5': '在一局游戏中，从右侧面板升级指针。',

  // Mechanics: salvage and specs.
  'help.mechanics-salvage.1': '废料是本局的货币：击杀获得废料，用它来购买防御塔、升级和指针。',
  'help.mechanics-salvage.2': '规格是永久性的。重启会根据本局的累计废料存入还原点，并带入下一局。',
  'help.mechanics-salvage.3': '每种规格各有效果：CPU {cpu} 防御塔伤害，GPU {gpu} 指针伤害，RAM +{ram} 开局废料，Disk {disk} 开局完整度（上限 {caps}）。',
  'help.mechanics-salvage.4': '规格升级的费用为：0 级 {cost0} 个还原点，1 级 {cost1} 个，2 级 {cost2} 个，3 级 {cost3} 个，之后持续上涨。',
  'help.mechanics-salvage.5': '累计废料达到 20,000 时重启存入 {gain20k} 个还原点，达到 60,000 时存入 {gain60k} 个。',

  // Mechanics: walls and pathing.
  'help.mechanics-walls.1': '墙会阻挡路线，敌人会绕行。路线越长，敌人在你防御塔火力下停留的时间就越长。',
  'help.mechanics-walls.2': '如果放置墙（或防御塔）会封死路线、使出口无法到达，棋盘会拒绝该放置。',
  'help.mechanics-walls.3': '有些敌人无视墙：飞行者直接飞过去，破城者则会啃穿它们。',

  // Mechanics: calling waves early.
  'help.mechanics-early-call.1': '你可以在上一波尚未结束时呼叫下一波。呼叫越早，废料奖励越大。',
  'help.mechanics-early-call.2': '第 2 波完全提前呼叫奖励 {bonus} 废料，等得越久奖励越少，最低 5。',
  'help.mechanics-early-call.3': '可以同时进行两波，因此提前呼叫是用风险换取回报。',

  // Mechanics: auto-start.
  'help.mechanics-auto-start.1': '开启自动后，棋盘清空 1.5 秒后开始下一波。',
  'help.mechanics-auto-start.2': '若有防御塔正在修理，它会等待，修好后再开始。',

  // Mechanics: modifiers.
  'help.mechanics-modifiers.1': '在一局游戏的后期，波次会带有改变规则的词缀。',
  'help.mechanics-modifiers.2': '- 禁止建造——棋盘被冻结：不能放置、升级、出售、修理或重新指定目标。',
  'help.mechanics-modifiers.3': '- 迷雾——防御塔的射程缩短。',
  'help.mechanics-modifiers.4': '- 快进——敌人移动更快。',
  'help.mechanics-modifiers.5': '- 停电——隐藏你的废料读数。',
  'help.mechanics-modifiers.6': '- 突袭——敌人的出生更加密集。',

  // Mechanics: endless.
  'help.mechanics-endless.1': '通过第一百波之后，你可以选择无尽模式继续游玩。',
  'help.mechanics-endless.2': '无尽波次会越来越难。没有最后一波。',

  // Enemies: the generated stats line (body line 1) and the answer paragraph (body line 2).
  'help.enemy-grunt.1': '{hp} HP · {speed} 格/秒。',
  'help.enemy-grunt.2': '最基础的小兵，也是衡量其他所有单位的基准。任何攻击都能击杀它——它是你在熟悉棋盘时建造并射击的敌人。',
  'help.enemy-runner.1': '{hp} HP · {speed} 格/秒。',
  'help.enemy-runner.2': '快速而小巧，防御塔对它开火的机会更少，溅射也常常落空。点击它，或者把电击塔放在它必须绕过的拐角。',
  'help.enemy-shielded.1': '{hp} HP · {speed} 格/秒 · {armour} 护甲 · {shield} 护盾。',
  'help.enemy-shielded.2': '它的护盾会吸收所有防御塔伤害，直到指针将其击破。先用点击打掉护盾，再让防御塔解决它。',
  'help.enemy-flyer.1': '{hp} HP · {speed} 格/秒。',
  'help.enemy-flyer.2': '它会径直飞过迷宫，因此墙无法减速它。只有网墙能挡住它；防空塔才是答案。',
  'help.enemy-armoured.1': '{hp} HP · {speed} 格/秒 · {armour} 护甲。',
  'help.enemy-armoured.2': '它的护甲会抵消防御塔伤害（固定值减免，最低为 1）。电击塔无视护甲，你的点击同样无视护甲。',
  'help.enemy-saboteur.1': '{hp} HP · {speed} 格/秒。',
  'help.enemy-saboteur.2': '一种生命值中等的快速敌人。把它当作更强悍的跑者，在它穿过棋盘之前点击它。',
  'help.enemy-breacher.1': '{hp} HP · {speed} 格/秒 · 啃穿墙。',
  'help.enemy-breacher.2': '它会直奔你的墙并啃穿它们，同时一个小炮塔会射击最近的防御塔。它啃墙时墙会使其缴械；在墙倒塌之前杀掉它。',
  'help.enemy-popup.1': '{hp} HP · {speed} 格/秒 · 一个窗口，不会漏网。',
  'help.enemy-popup.2': '一个会行走的窗口，能掩护其下方的所有敌人不受防御塔攻击。点击它的关闭按钮将其移除——这是唯一的方法。',

  // Bosses in general.
  'help.bosses-in-general.1': '首领是普通敌人的更大、更凶猛的版本。它会在战场顶部用一条名字栏宣告自己的到来。',
  'help.bosses-in-general.2': '首领缓慢而坚韧，漏网时损失更多完整度，但掉落远比其原型敌人更多的废料。',
  'help.bosses-in-general.3': '指针是可靠的对策：点击无视护甲和护盾，而首领足够慢，可以点击很多次。',

  // Boss pages: stats line (1), gimmick (2), answer (3).
  'help.boss-grunt-boss.1': '{hp} HP · {speed} 格/秒 · 漏网时损失 {integrity} 完整度。',
  'help.boss-grunt-boss.2': '一座生命值之墙——衡量其他所有首领的基准。它没有花招，只是需要很长时间才能击倒。',
  'help.boss-grunt-boss.3': '用指针集中火力，并尽可能久地让它停留在防御塔的射程内。',
  'help.boss-runner-boss.1': '{hp} HP · {speed} 格/秒 · 漏网时损失 {integrity} 完整度。',
  'help.boss-runner-boss.2': '它附近的一切都会同步跟进：3 格内的敌人以其速度或自身速度中较快者移动。',
  'help.boss-runner-boss.3': '尽早击杀它，不要等它驱赶一波敌人穿过你的棋盘。',
  'help.boss-shielded-boss.1': '{hp} HP · {speed} 格/秒 · 漏网时损失 {integrity} 完整度。',
  'help.boss-shielded-boss.2': '三层护盾，每次指针命中剥掉一层。在最后一层消失之前，防御塔无法伤害它。',
  'help.boss-shielded-boss.3': '点击它以剥掉护盾层，然后让防御塔解决它。',
  'help.boss-flyer-boss.1': '{hp} HP · {speed} 格/秒 · 漏网时损失 {integrity} 完整度。',
  'help.boss-flyer-boss.2': '飞行时孵化飞行者——每 4 秒三只，死亡时再孵化六只。',
  'help.boss-flyer-boss.3': '用防空塔对付蜂群，并在运载者到达出口之前点击将其击落。',
  'help.boss-armoured-boss.1': '{hp} HP · {speed} 格/秒 · 漏网时损失 {integrity} 完整度。',
  'help.boss-armoured-boss.2': '披甲且难以减速：护甲减免更高，减速对它只有一半效果。',
  'help.boss-armoured-boss.3': '无视护甲的防御塔和你的指针才是可靠的伤害来源。',
  'help.boss-saboteur-boss.1': '{hp} HP · {speed} 格/秒 · 漏网时损失 {integrity} 完整度。',
  'help.boss-saboteur-boss.2': '经过时使防御塔短路：2.5 格内的任何防御塔会离线 3 秒，之后自动恢复。',
  'help.boss-saboteur-boss.3': '分散你的防御塔，或者在它到达防线之前击杀它。',
  'help.boss-breacher-boss.1': '{hp} HP · {speed} 格/秒 · 漏网时损失 {integrity} 完整度。',
  'help.boss-breacher-boss.2': '它会吞噬你的防御塔：啃穿墙、使其他防御塔离线，并架设一个炮塔。',
  'help.boss-breacher-boss.3': '墙迷宫会一次一格地拖慢它；在防线后方放一座修理塔。',

  // Towers: cost line (1), branch note (2), branch bullets (3..5), role (last).
  'help.tower-gun.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-gun.2': '在第 3 级选择分支。',
  'help.tower-gun.3': '- **{name}** — {cost}：射程更远，伤害更高。',
  'help.tower-gun.4': '- **{name}** — {cost}：射速加倍。',
  'help.tower-gun.5': '廉价的单体输出中坚。把它放在一段长直路线上，让它能最长时间地持续射击。',

  'help.tower-cannon.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-cannon.2': '在第 3 级选择分支。',
  'help.tower-cannon.3': '- **{name}** — {cost}：更大的溅射范围。',
  'help.tower-cannon.4': '- **{name}** — {cost}：每 {interval} 秒布下一颗地雷，{arm} 秒后布防，场上最多 {cap} 颗，{damage} 伤害、{blast} 爆炸半径，{expire} 秒后过期。',
  'help.tower-cannon.5': '一座缓慢、重型的溅射塔。最适合放在迷宫折返处，让溅射命中成群的敌人。',

  'help.tower-taser.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-taser.2': '在第 3 级选择分支。',
  'help.tower-taser.3': '- **{name}** — {cost}：连锁 3 个目标。',
  'help.tower-taser.4': '- **{name}** — {cost}：对护盾造成额外伤害。',
  'help.tower-taser.5': '射程短、攻速极快，且无视护甲。把它放在急弯内侧，近距离惩罚坚韧的敌人。',

  'help.tower-frost.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-frost.2': '在第 3 级选择分支。',
  'help.tower-frost.3': '- **{name}** — {cost}：更强的减速。',
  'help.tower-frost.4': '- **{name}** — {cost}：没有减速，但有真实伤害。',
  'help.tower-frost.5': '将被命中的敌人减速至 30% 速度，持续 3 秒。把它放在你的伤害输出之前，让敌人在射程内停留更久。',

  'help.tower-laser.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-laser.2': '在第 3 级选择分支。',
  'help.tower-laser.3': '- **{name}** — {cost}：穿透更深，伤害更高。',
  'help.tower-laser.4': '- **{name}** — {cost}：分裂成三道光束。',
  'help.tower-laser.5': '穿透一条直线上的敌人。让它对准一条你刻意留空的走廊。',

  'help.tower-aa.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-aa.2': '在第 3 级选择分支。',
  'help.tower-aa.3': '- **{name}** — {cost}：炮弹会溅射，并同时攻击地面。',
  'help.tower-aa.4': '- **{name}** — {cost}：每次齐射 {salvo} 枚追踪导弹，每枚造成一次命中的 {pct}。',
  'help.tower-aa.5': '专用的防空塔。它只攻击飞行者，对飞行者造成双倍伤害，并在纯地面波次时停止开火。',

  'help.tower-beacon.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-beacon.2': '在第 3 级选择分支。',
  'help.tower-beacon.3': '- **{name}** — {cost}：范围内防御塔 +{aura} 伤害。',
  'help.tower-beacon.4': '- **{name}** — {cost}：防御塔 +{aura} 伤害，指针 +{pointerDamage} 伤害、+{pointerRange} 射程。',
  'help.tower-beacon.5': '提升其半径内每座防御塔的伤害。把它放在密集的塔群上方。',

  'help.tower-repair.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-repair.2': '治疗其半径内受损的防御塔。把它放在你想保住的塔群附近。',

  'help.tower-wall.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-wall.2': '在第 3 级选择分支。',
  'help.tower-wall.3': '- **{name}** — {cost}：{hp} HP。',
  'help.tower-wall.4': '- **{name}** — {cost}：{hp} HP，阻挡飞行者。',
  'help.tower-wall.5': '- **{name}** — {cost}：{hp} HP，一扇可以开关的闸门。',
  'help.tower-wall.6': '阻挡路线并拥有生命值。用墙让敌人绕行更长的迷宫。',

  'help.tower-cursor.1': '费用 {cost} · 第 {unlock} 波解锁。',
  'help.tower-cursor.2': '在第 3 级选择分支。',
  'help.tower-cursor.3': '- **{name}** — {cost}：{rate} 次/秒，半径 {radius} 格。',
  'help.tower-cursor.4': '- **{name}** — {cost}：{rate} 次/秒，半径 {radius} 格。',
  'help.tower-cursor.5': '- **{name}** — {cost}：半径内无敌人时，修理 HP 低于 {pct} 的防御塔。',
  'help.tower-cursor.6': '第二个光标，以你一半的点击伤害点击敌人。升级指针即可让它更强。',

  // Synergies (always available; docs/SYNERGIES.md §6).
  'help.synergy.title': '协同',
  'help.synergy.1': '相邻的两座合适类型的防御塔会形成协同。相邻指并排——北、南、东或西，绝不沿对角线。',
  'help.synergy.2': '**同步射击** — 相邻的防空塔会一齐开火：较快的那座领射，其余随它开火。普通防空塔每 {interval} 刻开火一次。',
  'help.synergy.3': '跟随者会按住射击，直到领射者在该刻开火。它最多等待领射者 {window} 刻，且总计绝不超过 {cap} 刻。',
  'help.synergy.4': '同步射击与不同步射击的威力完全相同——没有伤害或射速加成——只是与其余射击同时命中。',
};
