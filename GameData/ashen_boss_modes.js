/* Expedition length extension and three authored boss encounters. */
(() => {
  const modes = [
    { name: '旅人', desc: '標準敵人強度 ×1.0 · 10 層', hp: 1, atk: 1, reward: 1, floors: 10 },
    { name: '冒險者', desc: '敵人生命與攻擊 ×1.5 · 20 層', hp: 1.5, atk: 1.5, reward: 1.7, floors: 20 },
    { name: '苦行者', desc: '敵人生命與攻擊 ×2.0 · 30 層', hp: 2, atk: 2, reward: 2.2, floors: 30 },
    { name: '夢魘', desc: '敵人生命與攻擊 ×4.0 · 40 層', hp: 4, atk: 4, reward: 3, floors: 40 },
    { name: '無盡', desc: '敵人隨樓層持續變強 · 每 10 層迎戰隨機 BOSS', hp: 2.2, atk: 1.7, reward: 1.8, floors: Infinity, endless: true }
  ];
  DIFFS.splice(0, DIFFS.length, ...modes);
  const roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
  const roster = [
    { id: 'zarian', name: '漆黑的札里安', icon: '🦖' },
    { id: 'prince', name: '大褐黃神足王子', icon: '🐉' },
    { id: 'trefasha', name: '末代特雷法沙王', icon: '🐂' }
  ];
  const oldRenderMeta = renderMeta;
  renderMeta = function () {
    oldRenderMeta();
    const best = $('metaBest');
    if (best) best.textContent = `${Number(meta.best) || 0} 層`;
    $('difficultyList').innerHTML = DIFFS.map((d, i) => `<button class="diff ${difficulty === i ? 'active' : ''}" data-diff="${i}"><strong>${roman[i]}　${d.name}</strong><small>${d.desc}</small></button>`).join('');
  };

  const bossFloor = floor => floor > 0 && floor % 10 === 0;
  const modeFloorCount = () => DIFFS[difficulty]?.floors || 10;
  const pickBoss = floor => DIFFS[difficulty]?.endless
    ? roster[Math.floor(Math.random() * roster.length)]
    : roster[(Math.floor(floor / 10) - 1) % roster.length];
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
    const scale = Number(run.diff.hp) || 1;
    const hp = Math.round((spec.id === 'zarian' ? 220 : spec.id === 'prince' ? 300 : 260) * (1 + floor * .035) * scale);
    const boss = { customBoss: true, bossId: spec.id, name: spec.name, icon: spec.icon, x: p.x, y: p.y,
      hp, maxHp: hp, atk: Math.round((spec.id === 'prince' ? 7 : 8) * (Number(run.diff.atk) || 1) * (1 + floor * .025)),
      boss: true, dead: false, phase: 1, radius: 31, classType: 'boss', mode: 'melee', speed: 104,
      damageMultiplier: 1, attackRange: 77, attackCooldown: 1400, windupMs: 560,
      aggro: true, aggroRange: 9999, keepDistance: 190, nextAttackAt: Date.now() + 1300,
      nextSkillAt: Date.now() + 3500, nextScaleAt: Date.now() + 800,
      nextHealAt: Date.now() + 1000, skillStep: 0, shieldHp: 0, goldUntil: 0,
      uid: `f${floor}-boss-${spec.id}-${++uidSequence}` };
    if (spec.id === 'zarian') { boss.mode = 'ranged'; boss.classType = 'ranged'; boss.speed = 70; boss.attackRange = 0; boss.nextAttackAt = Infinity; }
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
      const info = roomInfo[run.roomType] || roomInfo.combat;
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

  const bossNames = {
    zarian: ['淵火成雨', '龍威似海', '異星水晶', '亞空污穢', '淵火灼地', '外域科技'],
    prince: ['南摩三滿多', '毋陀南．婆日拉', '那伽那伽密'],
    trefasha: ['斧劈', '公牛喚來', '暴怒之王', '雷霆的拉布列斯', '天星的金牛', '亡國之恨']
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
  const summonMud = boss => {
    for (let i = 0; i < 2; i++) {
      const p = worldPoint(i ? 6 : 2, i ? 2 : 4), hp = Math.max(1, Math.round(boss.maxHp * .12));
      run.enemies.push({ id: 'boss-mud', name: '亞空黑泥', icon: '🖤', x: p.x, y: p.y, hp, maxHp: hp,
        atk: Math.max(1, Math.round(boss.atk * .38)), boss: false, dead: false, summoned: true, aggro: true,
        classType: 'ranged', speed: 0, attackRange: 620, keepDistance: 220, attackCooldown: 1800,
        projectileSpeed: 225, projectileIcon: '●', projectileLifetimeMs: 5000, radius: 20,
        homeX: p.x, homeY: p.y, leashRange: 9999, uid: `mud-${++uidSequence}`, nextAttackAt: Date.now() + 900 });
    }
    addLog('「亞空污穢」：兩隻黑泥現身，正向你射出黑色液滴。');
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
        for (let i = 0; i < 25; i++) {
          const x = WORLD.cell + Math.random() * (WORLD.width - 2 * WORLD.cell), y = WORLD.cell + Math.random() * (WORLD.height - 2 * WORLD.cell);
          if (run.map[Math.floor(y / WORLD.cell)]?.[Math.floor(x / WORLD.cell)] !== 'wall') createFireCircle(boss, x, y, 34, bossNames.zarian[0], now + 1000, 1.05);
        }
        addLog('「淵火成雨」：地面出現火圈，1 秒後火球落下！');
      } else if (step % 3 === 1) {
        run.playerSnaredUntil = now + 2000; run.bossStatus = '龍威禁錮：移動速度降低 75%，持續 2 秒。';
        addLog('「龍威似海」：沉重龍威禁錮你的步伐，持續 2 秒。');
      } else {
        const p = worldPoint(2 + Math.floor(Math.random() * 5), 1 + Math.floor(Math.random() * 5)), hp = Math.round(boss.maxHp * .12);
        const crystal = { name: '異星水晶', icon: '💎', x: p.x, y: p.y, hp, maxHp: hp, atk: 0, boss: false,
          bossCrystal: true, dead: false, radius: 21, classType: 'support', speed: 0, uid: `crystal-${++uidSequence}` };
        run.enemies.push(crystal); addLog('「異星水晶」：水晶開始為札里安緩慢治療；摧毀水晶可阻止回血。');
      }
    } else if (id === 'zarian') {
      if (step % 3 === 0) summonMud(boss);
      else if (step % 3 === 1) {
        const angle = Math.atan2(run.player.y - boss.y, run.player.x - boss.x), spread = Math.PI / 3;
        for (let i = -2; i <= 2; i++) {
          const a = angle + spread * i / 4;
          const p = addBossMarker('boss-flame-cone', boss.x + Math.cos(a) * 110, boss.y + Math.sin(a) * 110, 40, '🔥');
          run.bossEffects.push({ type: 'fire', el: p, x: boss.x + Math.cos(a) * 110, y: boss.y + Math.sin(a) * 110, radius: 63, landsAt: now + 350, multiplier: .48, label: bossNames.zarian[4], boss });
        }
        addLog('「淵火灼地」：札里安朝前方扇形吐火！');
      } else {
        boss.shieldHp = Math.round(boss.maxHp * .2); boss.nextHealAt = now + 1000;
        addLog('「外域科技」：札里安啟動護盾；護盾未被擊破時會持續恢復生命。');
      }
    } else if (id === 'prince') {
      if (step % 3 === 0) {
        boss.goldUntil = now + 2000; document.body.classList.add('boss-gold-scene');
        addLog('「南摩三滿多」：黃金神光降臨 2 秒；王子造成的傷害會等量轉為生命。');
      } else if (step % 3 === 1) {
        boss.damageMultiplier += .1; boss.armorStack = (boss.armorStack || 0) + 3;
        addLog(`「毋陀南．婆日拉」：攻擊加成累積至 ${Math.round((boss.damageMultiplier - 1) * 100)}%，防禦 +${boss.armorStack}。`);
      } else {
        boss.shieldHp = Math.round(boss.maxHp * .75); boss.shieldUntil = now + 5000; boss.bossFrozen = true;
        addLog('「那伽那伽密」：王子靜止並獲得 75% 最大生命值護盾；5 秒內未打破將直接擊殺玩家！');
      }
    } else if (id === 'trefasha') {
      const second = boss.phase === 2;
      if ((!second && step % 3 === 0) || (second && step % 3 === 0)) {
        castLineTelegraph(boss, second ? 1000 : 2000, WORLD.cell * (second ? 2.5 : 2), second ? 2.25 : 1.55, second ? bossNames.trefasha[3] : bossNames.trefasha[0]);
        addLog(second ? '「雷霆的拉布列斯」：雷霆重擊蓄力 1 秒，立即離開寬闊紅線！' : '「斧劈」：斧刃蓄力 2 秒；紅線範圍內威力會隨距離衰減。');
      } else if (step % 3 === 1) {
        const a = Math.atan2(run.player.y - boss.y, run.player.x - boss.x);
        summonBull(boss, a);
        if (second) summonBull(boss, a + (Math.random() < .5 ? -.13 : .13));
        addLog(second ? '「天星的金牛」：兩頭巨牛接連衝向你！撞上牆壁後會消失。' : '「公牛喚來」：巨牛沿直線衝鋒，撞上牆壁後消失。');
      } else {
        boss.damageMultiplier = second ? 1.5 : 1.3; boss.enrageUntil = now + 3000;
        if (second) boss.damageTakenMultiplier = 1.2;
        addLog(second ? '「亡國之恨」：攻擊 +50%、受傷 +20%，持續 3 秒。' : '「暴怒之王」：攻擊提升 30%，持續 3 秒。');
      }
    }
    boss.nextSkillAt = now + 5500;
  };

  const oldUpdateBoss = updateBoss;
  updateBoss = function (now) {
    const boss = getBoss();
    if (!boss) { oldUpdateBoss(now); document.body.classList.remove('boss-gold-scene'); return; }
    updateBossEffectTimers(now);
    if (boss.phaseTransitionAt) {
      if (now < boss.phaseTransitionAt) { boss.frameGrey = true; run.bossStatus = '札里安第一階段已擊敗；第二階段將在 3 秒後復甦。'; return; }
      boss.phaseTransitionAt = 0; boss.frameGrey = false; boss.phase = 2; boss.hp = boss.maxHp;
      boss.icon = '🦖'; boss.mode = 'melee'; boss.classType = 'boss'; boss.speed = 205; boss.attackRange = 82; boss.attackCooldown = 1350; boss.windupMs = 440; boss.keepDistance = 0;
      boss.atk = Math.max(1, Math.round(boss.atk * .8)); boss.nextSkillAt = now + 3000; boss.skillStep = 0;
      addLog('漆黑的札里安復甦並轉為赤紅！第二階段：高速近戰。');
    }
    if (boss.bossId === 'trefasha' && boss.phase === 1 && boss.hp <= boss.maxHp * .5) {
      boss.phase = 2; boss.speed *= 1.5; boss.skillStep = 0; boss.nextSkillAt = now + 1800;
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
      const heal = boss.bossId === 'zarian' && boss.phase === 1 ? crystals.length * Math.max(1, Math.round(boss.maxHp * .006)) : boss.bossId === 'zarian' ? Math.max(1, Math.round(boss.maxHp * .004)) : 0;
      if (heal > 0) { boss.hp = Math.min(boss.maxHp, boss.hp + heal); floatDamage(boss, heal, true); }
    } else if (boss.bossId === 'zarian' && boss.phase === 1 && boss.nextHealAt <= now) {
      const n = aliveEnemies().filter(e => e.bossCrystal).length;
      if (n) boss.hp = Math.min(boss.maxHp, boss.hp + n * Math.max(1, Math.round(boss.maxHp * .006)));
      boss.nextHealAt = now + 1000;
    }
    if (boss.bossId === 'zarian' && boss.phase === 1 && now >= boss.nextScaleAt) {
      boss.nextScaleAt = now + 800;
      newProjectile(boss, Math.atan2(run.player.y - boss.y, run.player.x - boss.x), 390, '◆', { radius: 8, lifetimeMs: 4000 });
    }
    if (now >= boss.nextSkillAt && !boss.phaseTransitionAt) castCustomSkill(boss, now);
    run.bossStatus = boss.phaseTransitionAt ? '第一階段已潰敗，等待札里安復甦。' : `技能「${bossNames[boss.bossId]?.[Math.max(0, (boss.skillStep - 1) % bossNames[boss.bossId].length)] || '蓄勢'}」準備中。`;
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
    if (isCustomBoss(e) && e.bossId === 'zarian' && e.phase === 1 && !e.phaseTransitionAt) {
      e.hp = 1; e.frameGrey = true; e.phaseTransitionAt = Date.now() + 3000; e.shieldHp = 0;
      e.attackWindupUntil = 0; e.warningEl?.remove(); clearBossEffects();
      addLog('漆黑的札里安第一階段倒下，圖框灰化；3 秒後將以赤紅姿態復甦。'); render(); return true;
    }
    if (isCustomBoss(e)) {
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
      run.supportSpeedMultiplier = Math.min(Number(previous) || 1, .25);
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
      : `${run.floor} / ${total} 層 · ${(roomInfo[run.roomType] || roomInfo.combat).name}`;
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
