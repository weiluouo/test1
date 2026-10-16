/* Expedition length extension and three authored boss encounters. */
(() => {
  const modes = [
    { name: '旅人', desc: '標準敵人強度 ×1.0 · 10 層', hp: 1, atk: 1, reward: 1, floors: 10 },
    { name: '冒險者', desc: '敵人生命與攻擊 ×1.5 · 15 層', hp: 1.5, atk: 1.5, reward: 1.7, floors: 15 },
    { name: '苦行者', desc: '敵人生命與攻擊 ×2.0 · 20 層', hp: 2, atk: 2, reward: 2.2, floors: 20 },
    { name: '夢魘', desc: '敵人生命與攻擊 ×4.0 · 30 層', hp: 4, atk: 4, reward: 3, floors: 30 },
    { name: '無盡', desc: '敵人隨樓層持續變強 · 每 10 層迎戰隨機 BOSS', hp: 2.2, atk: 1.7, reward: 1.8, floors: Infinity, endless: true }
  ];
  DIFFS.splice(0, DIFFS.length, ...modes);
  const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
  const roster = () => [...BOSS_DATA.bosses, { id: 'dreamKing', ...BOSS_DATA.dreamKing }];
  const bossSpec = id => roster().find(spec => spec.id === id);
  const skillSpec = (id, skillId) => bossSpec(id)?.skills?.find(skill => skill.id === skillId) || {};
  const skillName = (id, skillId) => bossSpec(id)?.skills?.find(skill => skill.id === skillId)?.name || skillId;
  const roomCatalog = {
    combat: { name: '交鋒之室', desc: '道路被夢境魔物封鎖。清除敵人後可繼續前進。' },
    treasure: { name: '遺寶之室', desc: '古代行旅者留下了補給與寶藏。' },
    rest: { name: '旅人聖所', desc: '調查星芒火盆可恢復狀態。' },
    elite: { name: '精英守衛室', desc: '精英守衛更強，但會提供額外律質。' }
  };
  const oldRenderMeta = renderMeta;
  renderMeta = function () {
    oldRenderMeta();
    const best = $('metaBest');
    if (best) best.textContent = `${Number(meta.best) || 0} 層`;
    $('difficultyList').innerHTML = DIFFS.map((d, i) => `<button class="diff ${difficulty === i ? 'active' : ''}" data-diff="${i}"><strong>${roman[i]}　${d.name}</strong><small>${d.desc}</small></button>`).join('');
  };

  const bossFloor = floor => floor > 0 && floor % 10 === 0;
  const modeFloorCount = () => DIFFS[difficulty]?.floors || 10;
  const pickBoss = floor => roster()[Math.floor(Math.random() * roster().length)];
  const worldPoint = (x, y) => ({ x: x * WORLD.cell + WORLD.cell / 2, y: y * WORLD.cell + WORLD.cell / 2 });
  const isCustomBoss = e => !!e?.customBoss;
  const addBossMarker = (cls, x, y, radius, text = '') => {
    const el = addArenaNode($('map'), cls, text);
    el.style.left = `${x / WORLD.width * 100}%`;
    el.style.top = `${y / WORLD.height * 100}%`;
    if (radius) {
      el.style.width = `${radius * 2 / WORLD.width * 100}%`;
      el.style.height = `${radius * 2 / WORLD.height * 100}%`;
    }
    return el;
  };
  const damagePlayer = (boss, multiplier, label) => {
    if (Date.now() < (run.invulnerableUntil || 0)) { addLog(`你以衝刺避開「${label}」。`); return 0; }
    const oldAtk = boss.atk;
    boss.atk = Math.max(1, Math.round((Number(boss.atk) || 1) * multiplier));
    const dealt = applyEnemyDamageToPlayer(boss, Date.now(), false);
    boss.atk = oldAtk;
    return dealt;
  };
  const clearBossEffects = () => {
    (run?.bossEffects || []).forEach(x => x.el?.remove());
    if (run) run.bossEffects = [];
    $('bossWarningLane')?.style && ($('bossWarningLane').style.display = 'none');
  };
  const newProjectile = (owner, angle, speed, icon, options = {}) => {
    const p = { uid: `proj-${++uidSequence}`, x: owner.x, y: owner.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, icon, owner,
      radius: options.radius || 9, createdAt: Date.now(), lifetimeMs: options.lifetimeMs || 5000,
      dead: false, bullCharge: !!options.bullCharge };
    p.el = addArenaNode($('map'), `enemy-projectile-node${options.bullCharge ? ' boss-charge-bull' : ''}`, icon);
    positionNode(p.el, p);
    run.projectiles.push(p);
    return p;
  };
  const getBoss = () => aliveEnemies().find(isCustomBoss);
  const bossLocation = () => {
    const p = worldPoint(4, 3);
    run.map[3][4] = 'floor';
    return p;
  };
  const createBoss = floor => {
    const spec = pickBoss(floor), p = bossLocation();
    if (spec.id === 'dreamKing') {
      const cfg = BOSS_DATA.dreamKing, hp = Math.round((Number(cfg.baseHp) || 84) * (1 + floor * .035) * (Number(run.diff.hp) || 1));
      const boss = { id: 'dream-king', name: cfg.name || '夢境君王', icon: cfg.icon || '👹', x: p.x, y: p.y, hp, maxHp: hp,
        atk: Math.round((Number(cfg.baseAtk) || 7) * (Number(run.diff.atk) || 1) * (1 + floor * .025)), boss: true, dead: false,
        phase: 0, radius: 31, classType: 'boss', mode: 'melee', speed: Number(cfg.speed) || 136, damageMultiplier: 1,
        attackRange: 82, attackCooldown: 1250, windupMs: 620, aggro: true, aggroRange: 9999,
        nextAttackAt: Date.now() + 1300, nextSkillAt: Date.now() + (Number(cfg.skillIntervalMs) || 3000), shieldHp: 0,
        uid: `f${floor}-boss-dreamKing-${++uidSequence}` };
      run.enemies = [boss]; run.chests = []; run.searchPoint = null; run.roomSearched = true; run.roomType = 'boss';
      run.bossEffects = []; run.activeBossSpec = spec; run.bossStatus = `${boss.name}現身。`;
      $('roomTitle').textContent = `第 ${floor} 層：${boss.name}`; $('roomDesc').textContent = '擊敗首領後，出口才會開啟。留意技能警示並把握迴避時機。'; $('roomBadge').textContent = '首領戰';
      addLog(`第 ${floor} 層首領戰：「${boss.name}」！`); return;
    }
    const scale = Number(run.diff.hp) || 1;
    const hp = Math.round(Number(spec.baseHp || 220) * (1 + floor * .035) * scale);
    const boss = { customBoss: true, bossId: spec.id, name: spec.name, icon: spec.icon, x: p.x, y: p.y,
      hp, maxHp: hp, atk: Math.round(Number(spec.baseAtk || 8) * (Number(run.diff.atk) || 1) * (1 + floor * .025)),
      boss: true, dead: false, phase: 1, radius: 31, classType: 'boss', mode: 'melee', speed: Number(spec.speed) || 104,
      damageMultiplier: 1, attackRange: Number(spec.attackRange) || 77, attackCooldown: Number(spec.attackCooldownMs) || 1400, windupMs: Number(spec.windupMs) || 560,
      aggro: true, aggroRange: 9999, keepDistance: 190, nextAttackAt: Date.now() + 1300,
      nextSkillAt: Date.now() + 3500, nextScaleAt: Date.now() + 800,
      nextHealAt: Date.now() + 1000, skillStep: 0, shieldHp: 0, goldUntil: 0,
      uid: `f${floor}-boss-${spec.id}-${++uidSequence}` };
    if (spec.id === 'zarian') { boss.mode = 'ranged'; boss.classType = 'ranged'; boss.speed = Number(spec.phase1.speed) || 70; boss.attackRange = 0; boss.nextAttackAt = Infinity; }
    run.enemies = [boss];
    run.chests = [];
    run.searchPoint = null;
    run.roomSearched = true;
    run.roomType = 'boss';
    run.bossEffects = [];
    run.activeBossSpec = spec;
    run.bossStatus = `${spec.name}現身。`;
    $('roomTitle').textContent = `第 ${floor} 層：${spec.name}`;
    $('roomDesc').textContent = '擊敗首領後，出口才會開啟。留意技能警示並把握迴避時機。';
    $('roomBadge').textContent = '首領戰';
    addLog(`第 ${floor} 層首領戰：「${spec.name}」！`);
  };

  const oldMakeRoom = makeRoom;
  makeRoom = function () {
    if (run) {
      run.maxFloors = modeFloorCount();
      run.isEndless = !!DIFFS[difficulty]?.endless;
      if (run.isEndless) {
        const base = DIFFS[difficulty];
        const growth = Math.max(0, (run.floor - 1) * .045);
        run.diff = { ...base, hp: base.hp * (1 + growth), atk: base.atk * (1 + growth * .58), reward: base.reward * (1 + growth * .18) };
      }
    }
    oldMakeRoom();
    if (!run) return;
    run.maxFloors = modeFloorCount();
    run.isEndless = !!DIFFS[difficulty]?.endless;
    if (bossFloor(run.floor)) { createBoss(run.floor); return; }
    if (run.floor > 10 && run.roomType === 'boss') {
      const roomRoll = Math.random();
      run.roomType = roomRoll < .48 ? 'combat' : roomRoll < .72 ? 'treasure' : roomRoll < .86 ? 'rest' : 'elite';
      const info = roomCatalog[run.roomType] || roomCatalog.combat;
      $('roomTitle').textContent = `第 ${run.floor} 層：${names[run.floor - 1] || '夢境深處'}`;
      $('roomDesc').textContent = info.desc;
      $('roomBadge').textContent = info.name;
      if (run.roomType === 'rest') { run.enemies = []; run.chests = []; run.searchPoint = worldPoint(4, 3); run.roomSearched = false; }
      if (run.roomType === 'elite') {
        const e = aliveEnemies()[0];
        if (e) { e.elite = true; e.name = `精英・${e.name}`; e.maxHp = Math.round(e.maxHp * 1.65); e.hp = e.maxHp; e.atk = Math.round(e.atk * 1.2); }
      }
    }
  };

  const oldAdvance = advanceToNextFloor;
  advanceToNextFloor = function () {
    if (!run || run.done) return;
    const next = run.floor + 1;
    if (!run.isEndless && next > run.maxFloors) { finish(true); return; }
    clearBossEffects();
    oldAdvance();
    if (run && !run.done) {
      run.maxFloors = modeFloorCount();
      if (run.isEndless && next % 10 !== 0) {
        const base = DIFFS[difficulty], growth = Math.max(0, (next - 1) * .045);
        run.diff = { ...base, hp: base.hp * (1 + growth), atk: base.atk * (1 + growth * .58), reward: base.reward * (1 + growth * .18) };
      }
    }
  };
  const oldInteractions = processRunInteractions;
  processRunInteractions = function (now) {
    if (!run || run.done) return;
    pickupGroundLoot(now);
    if (run.loot?.length && dist(run.player, run.exit) < 39 && aliveEnemies().length === 0 && !run.lootExitWarned) { addLog('道路已經開啟；請先走近並拾取地上的所有戰利品。'); run.lootExitWarned = true; }
    if (dist(run.player, run.exit) < 39 && aliveEnemies().length === 0 && (run.loot || []).length) return;
    for (const c of run.chests || []) if (!c.open && dist(c, run.player) < 39) openChest(c);
    if (run.searchPoint && !run.roomSearched && dist(run.searchPoint, run.player) < 39) explore();
    if (dist(run.player, run.exit) >= 39 || run.exitHandled) return;
    if (aliveEnemies().length) {
      if (!run.exitWarningAt || now - run.exitWarningAt > 2500) { addLog('出口仍被敵人封鎖，先擊敗剩餘怪物。'); run.exitWarningAt = now; }
      return;
    }
    run.exitHandled = true;
    if (!run.isEndless && run.floor >= run.maxFloors) { finish(true); return; }
    if (run.floor % 2 === 1) showExpeditionScenario(() => advanceToNextFloor());
    else advanceToNextFloor();
  };

  const createFireCircle = (boss, x, y, radius, label, landsAt, multiplier) => {
    const el = addBossMarker('boss-fire-warning', x, y, radius, '');
    run.bossEffects.push({ type: 'fire', el, x, y, radius, landsAt, multiplier, label, boss });
  };
  const castLineTelegraph = (boss, duration, halfWidth, multiplier, label) => {
    const dx = run.player.x - boss.x, dy = run.player.y - boss.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const center = horizontal ? run.player.y : run.player.x;
    const lane = $('bossWarningLane');
    lane.style.display = 'block';
    if (horizontal) { lane.style.left = '0'; lane.style.top = `${center / WORLD.height * 100}%`; lane.style.width = '100%'; lane.style.height = `${halfWidth * 2 / WORLD.height * 100}%`; lane.style.transform = 'translateY(-50%)'; }
    else { lane.style.left = `${center / WORLD.width * 100}%`; lane.style.top = '0'; lane.style.width = `${halfWidth * 2 / WORLD.width * 100}%`; lane.style.height = '100%'; lane.style.transform = 'translateX(-50%)'; }
    run.bossEffects.push({ type: 'line', el: lane, horizontal, center, direction: horizontal ? Math.sign(dx) || 1 : Math.sign(dy) || 1, halfWidth, multiplier, label, landsAt: Date.now() + duration, boss });
  };
  const summonMud = (boss, count = 2) => {
    const cfg = MONSTER_CONFIG.summons?.zarianBlackMud || {};
    for (let i = 0; i < count; i++) {
      const p = worldPoint(i ? 6 : 2, i ? 2 : 4), hp = Math.max(1, Math.round(boss.maxHp * (Number(cfg.hpRatio) || .12)));
      run.enemies.push({ ...cfg, id: cfg.id || 'zarian-black-mud', name: cfg.name || '亞空黑泥', icon: cfg.icon || '🖤', x: p.x, y: p.y, hp, maxHp: hp,
        atk: Math.max(1, Math.round(boss.atk * (Number(cfg.attackRatio) || .38))), boss: false, dead: false, summoned: true, aggro: true,
        classType: cfg.classType || 'ranged', speed: Number(cfg.speed) || 0, attackRange: Number(cfg.attackRange) || 620, keepDistance: Number(cfg.keepDistance) || 220, attackCooldown: Number(cfg.attackCooldownMs) || 1800,
        projectileSpeed: Number(cfg.projectileSpeed) || 225, projectileIcon: cfg.projectileIcon || '●', projectileLifetimeMs: Number(cfg.projectileLifetimeMs) || 5000, radius: Number(cfg.radius) || 20,
        homeX: p.x, homeY: p.y, leashRange: 9999, uid: `mud-${++uidSequence}`, nextAttackAt: Date.now() + 900 });
    }
    addLog(`「${skillName('zarian', 'voidMire')}」：兩隻黑泥現身，正向你射出黑色液滴。`);
  };
  const summonBull = (boss, angle) => newProjectile(boss, angle, 320, '🐂', { radius: 30, lifetimeMs: 5000, bullCharge: true });
  const updateBossEffectTimers = now => {
    const effects = run.bossEffects || [];
    run.bossEffects = effects.filter(effect => {
      if (now < effect.landsAt) return true;
      effect.el?.remove();
      if (effect.type === 'fire') {
        if (dist({ x: effect.x, y: effect.y }, run.player) <= effect.radius + WORLD.playerRadius) damagePlayer(effect.boss, effect.multiplier, effect.label);
      } else if (effect.type === 'line') {
        const along = effect.horizontal ? Math.abs(run.player.y - effect.center) : Math.abs(run.player.x - effect.center);
        const within = effect.horizontal ? (run.player.x - effect.boss.x) * effect.direction >= 0 : (run.player.y - effect.boss.y) * effect.direction >= 0;
        if (along <= effect.halfWidth && within) {
          const d = dist(effect.boss, run.player), falloff = Math.max(.25, 1 - d / (WORLD.width * 1.35));
          damagePlayer(effect.boss, effect.multiplier * falloff, effect.label);
        }
      }
      return false;
    });
    if (!(run.bossEffects || []).some(x => x.type === 'line')) $('bossWarningLane').style.display = 'none';
  };
  const castCustomSkill = (boss, now) => {
    const id = boss.bossId, step = boss.skillStep++;
    if (id === 'zarian' && boss.phase === 1) {
      if (step % 3 === 0) {
        for (let i = 0; i < (Number(skillSpec('zarian', 'fireRain').circleCount) || 25); i++) {
          const x = WORLD.cell + Math.random() * (WORLD.width - 2 * WORLD.cell), y = WORLD.cell + Math.random() * (WORLD.height - 2 * WORLD.cell);
          const cfg = skillSpec('zarian', 'fireRain');
          if (run.map[Math.floor(y / WORLD.cell)]?.[Math.floor(x / WORLD.cell)] !== 'wall') createFireCircle(boss, x, y, Number(cfg.radius) || 34, skillName('zarian', 'fireRain'), now + (Number(cfg.warningMs) || 1000), Number(cfg.damageMultiplier) || 1.05);
        }
        addLog(`「${skillName('zarian', 'fireRain')}」：地面出現火圈，1 秒後火球落下！`);
      } else if (step % 3 === 1) {
        const cfg = skillSpec('zarian', 'dragonMight');
        run.playerSnaredUntil = now + (Number(cfg.durationMs) || 2000); run.playerSnaredMultiplier = Number(cfg.slowMultiplier) || .25; run.bossStatus = '龍威禁錮：移動速度降低 75%，持續 2 秒。';
        addLog(`「${skillName('zarian', 'dragonMight')}」：沉重龍威禁錮你的步伐。`);
      } else {
        const cfg = MONSTER_CONFIG.summons?.zarianCrystal || skillSpec('zarian', 'alienCrystal');
        const p = worldPoint(2 + Math.floor(Math.random() * 5), 1 + Math.floor(Math.random() * 5)), hp = Math.round(boss.maxHp * (Number(cfg.hpRatio) || .12));
        const crystal = { ...cfg, name: cfg.name || '異星水晶', icon: cfg.icon || '💎', x: p.x, y: p.y, hp, maxHp: hp, atk: 0, boss: false, summoned: true,
          bossCrystal: true, dead: false, radius: Number(cfg.radius) || 21, classType: cfg.classType || 'support', speed: Number(cfg.speed) || 0, uid: `crystal-${++uidSequence}` };
        run.enemies.push(crystal); addLog(`「${skillName('zarian', 'alienCrystal')}」：水晶開始為札里安緩慢治療；摧毀水晶可阻止回血。`);
      }
    } else if (id === 'zarian') {
      if (step % 3 === 0) summonMud(boss, Number(skillSpec('zarian', 'voidMire').summonCount) || 2);
      else if (step % 3 === 1) {
        const angle = Math.atan2(run.player.y - boss.y, run.player.x - boss.x), spread = Math.PI / 3;
        for (let i = -2; i <= 2; i++) {
          const a = angle + spread * i / 4;
          const cfg = skillSpec('zarian', 'flameBreath'), reach = Number(cfg.reach) || 110, radius = Number(cfg.radius) || 63;
          const p = addBossMarker('boss-flame-cone', boss.x + Math.cos(a) * reach, boss.y + Math.sin(a) * reach, 40, '🔥');
          run.bossEffects.push({ type: 'fire', el: p, x: boss.x + Math.cos(a) * reach, y: boss.y + Math.sin(a) * reach, radius, landsAt: now + 350, multiplier: Number(cfg.damageMultiplier) || .48, label: skillName('zarian', 'flameBreath'), boss });
        }
        addLog(`「${skillName('zarian', 'flameBreath')}」：札里安朝前方扇形吐火！`);
      } else {
        boss.shieldMaxHp = boss.shieldHp = Math.round(boss.maxHp * (Number(skillSpec('zarian', 'outerTech').shieldRatio) || .2)); boss.nextHealAt = now + 1000;
        addLog(`「${skillName('zarian', 'outerTech')}」：札里安啟動護盾；護盾未被擊破時會持續恢復生命。`);
      }
    } else if (id === 'prince') {
      if (step % 3 === 0) {
        boss.goldUntil = now + (Number(skillSpec('prince', 'goldenGrace').durationMs) || 2000); document.body.classList.add('boss-gold-scene');
        addLog(`「${skillName('prince', 'goldenGrace')}」：黃金神光降臨；王子造成的傷害會等量轉為生命。`);
      } else if (step % 3 === 1) {
        boss.damageMultiplier += Number(skillSpec('prince', 'stackingMight').attackMultiplierAdd) || .1; boss.armorStack = (boss.armorStack || 0) + (Number(skillSpec('prince', 'stackingMight').armorAdd) || 3);
        addLog(`「${skillName('prince', 'stackingMight')}」：攻擊加成累積至 ${Math.round((boss.damageMultiplier - 1) * 100)}%，防禦 +${boss.armorStack}。`);
      } else {
        boss.shieldMaxHp = boss.shieldHp = Math.round(boss.maxHp * (Number(skillSpec('prince', 'serpentShield').shieldRatio) || .75)); boss.shieldUntil = now + (Number(skillSpec('prince', 'serpentShield').durationMs) || 5000); boss.bossFrozen = true;
        addLog(`「${skillName('prince', 'serpentShield')}」：王子靜止並獲得護盾；時間內未打破將直接擊殺玩家！`);
      }
    } else if (id === 'trefasha') {
      const second = boss.phase === 2;
      if ((!second && step % 3 === 0) || (second && step % 3 === 0)) {
        const cfg = skillSpec('trefasha', second ? 'thunderCleave' : 'axeCleave');
        castLineTelegraph(boss, Number(cfg.chargeMs) || (second ? 1000 : 2000), WORLD.cell * (Number(cfg.widthCells) || (second ? 2.5 : 2)), Number(cfg.damageMultiplier) || (second ? 2.25 : 1.55), skillName('trefasha', second ? 'thunderCleave' : 'axeCleave'));
        addLog(`「${skillName('trefasha', second ? 'thunderCleave' : 'axeCleave')}」：首領開始蓄力，紅線範圍內威力會隨距離衰減。`);
      } else if (step % 3 === 1) {
        const a = Math.atan2(run.player.y - boss.y, run.player.x - boss.x);
        const count = Number(skillSpec('trefasha', second ? 'heavenBull' : 'bullCall').summonCount) || (second ? 2 : 1);
        for (let i = 0; i < count; i++) summonBull(boss, a + (i ? (Math.random() < .5 ? -.13 : .13) : 0));
        addLog(`「${skillName('trefasha', second ? 'heavenBull' : 'bullCall')}」：巨牛沿直線衝鋒，撞上牆壁後消失。`);
      } else {
        const cfg = skillSpec('trefasha', second ? 'fallenKingdom' : 'wrathKing');
        boss.damageMultiplier = Number(cfg.attackMultiplier) || (second ? 1.5 : 1.3); boss.enrageUntil = now + (Number(cfg.durationMs) || 3000);
        if (second) boss.damageTakenMultiplier = Number(cfg.damageTakenMultiplier) || 1.2;
        addLog(`「${skillName('trefasha', second ? 'fallenKingdom' : 'wrathKing')}」：首領進入短暫狂暴狀態。`);
      }
    }
    boss.nextSkillAt = now + (Number(bossSpec(id)?.skillIntervalMs) || 5500);
  };

  const oldUpdateBoss = updateBoss;
  updateBoss = function (now) {
    const boss = getBoss();
    if (!boss) { oldUpdateBoss(now); document.body.classList.remove('boss-gold-scene'); return; }
    updateBossEffectTimers(now);
    if (boss.phaseTransitionAt) {
      if (now < boss.phaseTransitionAt) { boss.frameGrey = true; run.bossStatus = '札里安第一階段已擊敗；第二階段將在 3 秒後復甦。'; return; }
      const second = bossSpec('zarian').phase2;
      boss.phaseTransitionAt = 0; boss.frameGrey = false; boss.phase = 2; boss.hp = boss.maxHp;
      boss.icon = bossSpec('zarian').icon; boss.mode = 'melee'; boss.classType = 'boss'; boss.speed = Number(second.speed) || 205; boss.attackRange = Number(second.attackRange) || 82; boss.attackCooldown = Number(second.attackCooldownMs) || 1350; boss.windupMs = Number(second.windupMs) || 440; boss.keepDistance = 0;
      boss.atk = Math.max(1, Math.round(boss.atk * (Number(second.attackMultiplier) || .8))); boss.nextSkillAt = now + (Number(bossSpec('zarian').skillIntervalMs) || 3000); boss.skillStep = 0;
      addLog('漆黑的札里安復甦並轉為赤紅！第二階段：高速近戰。');
    }
    if (boss.bossId === 'trefasha' && boss.phase === 1 && boss.hp <= boss.maxHp * (Number(bossSpec('trefasha').phaseThreshold) || .5)) {
      boss.phase = 2; boss.speed *= Number(bossSpec('trefasha').phase2SpeedMultiplier) || 1.5; boss.skillStep = 0; boss.nextSkillAt = now + 1800;
      addLog('末代特雷法沙王跨越半數生命：第二階段速度提升 50%，攻勢更猛烈！');
    }
    if (boss.goldUntil && now >= boss.goldUntil) { boss.goldUntil = 0; document.body.classList.remove('boss-gold-scene'); }
    if (boss.enrageUntil && now >= boss.enrageUntil) { boss.enrageUntil = 0; boss.damageMultiplier = 1; boss.damageTakenMultiplier = 1; }
    if (boss.bossId === 'prince' && boss.bossFrozen && boss.shieldUntil && now >= boss.shieldUntil) {
      boss.bossFrozen = false; boss.shieldUntil = 0;
      if (boss.shieldHp > 0) { boss.hp = 0; addLog('「那伽那伽密」護盾未能及時打破，玩家被神足王子的力量擊殺！'); finish(false); return; }
      addLog('神足王子的護盾被擊破，禁錮解除！');
    }
    if (boss.shieldHp > 0 && boss.nextHealAt <= now) {
      boss.nextHealAt = now + 1000;
      const crystals = aliveEnemies().filter(e => e.bossCrystal);
      const healRatio = boss.bossId === 'zarian' && boss.phase === 1 ? Number(skillSpec('zarian', 'alienCrystal').healPerSecondRatio) || .006 : Number(skillSpec('zarian', 'outerTech').healPerSecondRatio) || .004;
      const heal = boss.bossId === 'zarian' && boss.phase === 1 ? crystals.length * Math.max(1, Math.round(boss.maxHp * healRatio)) : boss.bossId === 'zarian' ? Math.max(1, Math.round(boss.maxHp * healRatio)) : 0;
      if (heal > 0) { boss.hp = Math.min(boss.maxHp, boss.hp + heal); floatDamage(boss, heal, true); }
    } else if (boss.bossId === 'zarian' && boss.phase === 1 && boss.nextHealAt <= now) {
      const n = aliveEnemies().filter(e => e.bossCrystal).length;
      if (n) boss.hp = Math.min(boss.maxHp, boss.hp + n * Math.max(1, Math.round(boss.maxHp * (Number(skillSpec('zarian', 'alienCrystal').healPerSecondRatio) || .006))));
      boss.nextHealAt = now + 1000;
    }
    if (boss.bossId === 'zarian' && boss.phase === 1 && now >= boss.nextScaleAt) {
      const ranged = bossSpec('zarian').phase1;
      boss.nextScaleAt = now + (Number(ranged.rangedAttackIntervalMs) || 800);
      newProjectile(boss, Math.atan2(run.player.y - boss.y, run.player.x - boss.x), Number(ranged.projectileSpeed) || 390, ranged.projectileIcon || '◆', { radius: 8, lifetimeMs: Number(ranged.projectileLifetimeMs) || 4000 });
    }
    if (now >= boss.nextSkillAt && !boss.phaseTransitionAt) castCustomSkill(boss, now);
    const activeSkills = bossSpec(boss.bossId)?.skills || [];
    run.bossStatus = boss.phaseTransitionAt ? '第一階段已潰敗，等待札里安復甦。' : `技能「${activeSkills[Math.max(0, (boss.skillStep - 1) % activeSkills.length)]?.name || '蓄勢'}」準備中。`;
  };

  const oldApplyWeaponHit = applyWeaponHit;
  applyWeaponHit = function (e, dmg, w, now) {
    if (isCustomBoss(e) && e.phaseTransitionAt) { addLog('札里安的圖框轉為灰色，等待第二階段復甦。'); return false; }
    if (isCustomBoss(e) && e.shieldHp > 0) {
      const absorbed = Math.min(e.shieldHp, dmg); e.shieldHp -= absorbed; dmg -= absorbed;
      floatDamage(e, absorbed, true);
      if (e.bossId === 'prince' && e.shieldHp <= 0) { e.bossFrozen = false; e.shieldUntil = 0; addLog('那伽那伽密護盾破裂，神足王子解除靜止。'); }
      if (e.shieldHp > 0 || dmg <= 0) { render(); return true; }
    }
    if (isCustomBoss(e) && e.bossId === 'prince' && e.armorStack > 0) dmg = Math.max(1, dmg - e.armorStack);
    if (isCustomBoss(e) && e.bossId === 'trefasha' && e.damageTakenMultiplier > 1) dmg = Math.max(1, Math.round(dmg * e.damageTakenMultiplier));
    return oldApplyWeaponHit(e, dmg, w, now);
  };
  const oldHandleDefeat = handleEnemyDefeat;
  handleEnemyDefeat = function (e) {
    if (e?.summoned) { e.hp = 0; e.dead = true; if (e.supporter) restoreSupportDebuff(e); render(); return true; }
    if (isCustomBoss(e) && e.bossId === 'zarian' && e.phase === 1 && !e.phaseTransitionAt) {
      e.hp = 1; e.frameGrey = true; e.phaseTransitionAt = Date.now() + 3000; e.shieldHp = 0;
      e.attackWindupUntil = 0; e.warningEl?.remove(); clearBossEffects();
      addLog('漆黑的札里安第一階段倒下，圖框灰化；3 秒後將以赤紅姿態復甦。'); render(); return true;
    }
    if (isCustomBoss(e)) {
      const relic = RELICS.find(item => item.bossRelicFor === e.bossId);
      run.bossRelicsClaimed ||= [];
      if (relic && !run.bossRelicsClaimed.includes(relic.id) && !(run.relics || []).some(item => item.id === relic.id) && Math.random() < .75) { run.bossRelicsClaimed.push(relic.id); createGroundLoot('relic', e.x, e.y, { relic }); addLog(`首領專屬遺物「${relic.name}」落在地上。`); }
      e.boss = false;
      const result = oldHandleDefeat(e);
      e.boss = true;
      clearBossEffects();
      if (run && !run.done) {
        if (!run.isEndless && run.floor >= run.maxFloors) finish(true);
        else if (run.isEndless) showModal(`<div class="eyebrow">ENDLESS FLOOR ${run.floor}</div><h2>${escapeHtmlText(e.name)}已被擊敗</h2><p class="intro">你已通過第 ${run.floor} 層的無盡首領戰。要繼續深入，還是結束本次遠征？</p><div class="actions"><button class="primary" id="endlessContinue">繼續深入</button><button id="endlessExit">結束遠征</button></div>`), $('endlessContinue').onclick = () => { closeModal(); advanceToNextFloor(); }, $('endlessExit').onclick = () => finish(true);
      }
      return result;
    }
    if (e?.boss && run?.activeBossSpec?.id === 'dreamKing') {
      const relic = RELICS.find(item => item.bossRelicFor === 'dreamKing');
      run.bossRelicsClaimed ||= [];
      if (relic && !run.bossRelicsClaimed.includes(relic.id) && !(run.relics || []).some(item => item.id === relic.id) && Math.random() < .75) { run.bossRelicsClaimed.push(relic.id); createGroundLoot('relic', e.x, e.y, { relic }); addLog(`首領專屬遺物「${relic.name}」落在地上。`); }
    }
    return oldHandleDefeat(e);
  };

  const oldApplyEnemyDamage = applyEnemyDamageToPlayer;
  applyEnemyDamageToPlayer = function (e, now, projectileHit = false) {
    const dealt = oldApplyEnemyDamage(e, now, projectileHit);
    const boss = isCustomBoss(e) ? e : getBoss();
    if (boss && boss.bossId === 'prince' && now < (boss.goldUntil || 0) && dealt > 0) {
      boss.hp = Math.min(boss.maxHp, boss.hp + dealt); floatDamage(boss, dealt, true);
    }
    return dealt;
  };
  const oldMoveEnemies = moveEnemies;
  moveEnemies = function (dt, now) {
    if (!run) return oldMoveEnemies(dt, now);
    const frozen = run.enemies.filter(e => e.bossCrystal || isCustomBoss(e) && (e.bossFrozen || e.phaseTransitionAt));
    if (frozen.length) run.enemies = run.enemies.filter(e => !frozen.includes(e));
    oldMoveEnemies(dt, now);
    if (frozen.length) run.enemies.push(...frozen);
  };
  const oldRealtimeUpdate = realtimeUpdate;
  realtimeUpdate = function (...args) {
    if (run && run.playerSnaredUntil > Date.now()) {
      const previous = run.supportSpeedMultiplier;
      run.supportSpeedMultiplier = Math.min(Number(previous) || 1, Number(run.playerSnaredMultiplier) || .25);
      try { return oldRealtimeUpdate(...args); }
      finally { run.supportSpeedMultiplier = previous || 1; }
    }
    return oldRealtimeUpdate(...args);
  };

  const oldRenderArena = renderArena;
  renderArena = function (...args) {
    const value = oldRenderArena(...args);
    if (!run) return value;
    for (const e of run.enemies || []) if (isCustomBoss(e)) {
      const actor = $('arenaActor-' + String(e.uid).replace(/[^a-zA-Z0-9_-]/g, '_'));
      if (!actor) continue;
      actor.classList.toggle('boss-black-stage', e.bossId === 'zarian' && e.phase === 1);
      actor.classList.toggle('boss-red-stage', e.bossId === 'zarian' && e.phase === 2 || e.bossId === 'trefasha' && e.enrageUntil > Date.now());
      actor.classList.toggle('boss-grey', !!e.frameGrey);
      actor.classList.toggle('boss-shielded', e.shieldHp > 0);
      let shield = actor.querySelector('.arena-shield-bar');
      if (e.shieldHp > 0) { if (!shield) { shield = document.createElement('div'); shield.className = 'arena-shield-bar'; shield.innerHTML = '<span></span>'; actor.querySelector('.arena-hp')?.insertAdjacentElement('afterend', shield); } shield.firstElementChild.style.width = `${Math.max(0, Math.min(100, e.shieldHp / Math.max(1, e.shieldMaxHp || e.maxHp) * 100))}%`; }
      else shield?.remove();
      actor.title = `${e.name}｜${e.phase} 階段｜HP ${Math.ceil(e.hp)}/${e.maxHp}${e.shieldHp ? `｜護盾 ${Math.ceil(e.shieldHp)}` : ''}`;
    }
    return value;
  };
  const oldRender = render;
  render = function (...args) {
    const result = oldRender(...args);
    if (!run) return result;
    const total = run.isEndless ? '∞' : run.maxFloors;
    if ($('floorText')) $('floorText').textContent = `${run.floor} / ${total}`;
    if ($('floorBar')) $('floorBar').style.width = run.isEndless ? `${Math.min(100, run.floor % 10 * 10)}%` : `${Math.min(100, run.floor / run.maxFloors * 100)}%`;
    if ($('roomBadge')) $('roomBadge').textContent = bossFloor(run.floor)
      ? `第 ${run.floor} 層 · BOSS`
      : `${run.floor} / ${total} 層 · ${(roomCatalog[run.roomType] || roomCatalog.combat).name}`;
    const boss = getBoss(), info = $('bossInfo');
    if (boss && info) { info.classList.remove('hidden'); info.textContent = `${boss.name}・第 ${boss.phase} 階段｜${run.bossStatus || '首領正在蓄勢。'}${boss.shieldHp ? `｜護盾 ${Math.ceil(boss.shieldHp)}` : ''}`; }
    document.body.classList.toggle('boss-gold-scene', !!boss && boss.goldUntil > Date.now());
    return result;
  };

  const oldFinish = finish;
  finish = function (win) {
    if (!run || run.done) return oldFinish(win);
    const max = run.isEndless ? '無盡' : run.maxFloors;
    const originalShowModal = showModal;
    showModal = function (html) { originalShowModal(html.replaceAll('/ 10', `/ ${max}`).replaceAll('穿越十層夢幻境', `通過 ${run.floor} 層夢幻境`)); };
    oldFinish(win);
    showModal = originalShowModal;
  };

  const style = document.createElement('style');
  style.textContent = `
    .difficulty{grid-template-columns:repeat(auto-fit,minmax(125px,1fr))}
    .boss-fire-warning{position:absolute;z-index:9;transform:translate(-50%,-50%);border:2px solid #d33b2e;border-radius:50%;background:#ed503b38;box-shadow:0 0 0 5px #d5423030;pointer-events:none;animation:bossFirePulse .25s infinite alternate}
    .boss-flame-cone{position:absolute;z-index:9;transform:translate(-50%,-50%);font-size:34px;pointer-events:none;filter:drop-shadow(0 0 9px #e45a25)}
    .boss-charge-bull{font-size:52px!important;width:8%!important;min-width:42px;filter:drop-shadow(0 0 8px #a52b22)!important}
    .boss-red-stage .arena-sprite{filter:sepia(1) saturate(6) hue-rotate(320deg) brightness(.82)!important}
    .boss-black-stage .arena-sprite{filter:grayscale(1) brightness(.35)!important}
    .boss-grey .arena-sprite{filter:grayscale(1) brightness(.52)!important;opacity:.65}
    .boss-shielded .arena-sprite{filter:drop-shadow(0 0 12px #5d9de8)!important}
    .boss-gold-scene #gameScreen{filter:sepia(.65) saturate(1.45)}
    @keyframes bossFirePulse{from{opacity:.48;transform:translate(-50%,-50%) scale(.88)}to{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}
  `;
  document.head.appendChild(style);
  renderMeta();
})();
