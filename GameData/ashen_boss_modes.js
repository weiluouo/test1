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
      dead: false, bullCharge: !!options.bullCharge, goldenCharge: !!options.goldenCharge };
    p.el = addArenaNode($('map'), `enemy-projectile-node${options.bullCharge ? ` boss-charge-bull${options.goldenCharge ? ' boss-charge-gold' : ''}` : ''}`, icon);
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
    run.endlessBossChoiceShown = false;
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
    if (run.isEndless && bossFloor(run.floor)) {
      if (!run.endlessBossChoiceShown) {
        run.endlessBossChoiceShown = true;
        showModal(`<div class="eyebrow">ENDLESS FLOOR ${run.floor}</div><h2>首領戰利品已收集</h2><p class="intro">你已走到出口。要繼續深入，還是結束本次遠征？</p><div class="actions"><button class="primary" id="endlessContinue">繼續深入</button><button id="endlessExit">結束遠征</button></div>`);
        $('endlessContinue').onclick = () => { closeModal(); advanceToNextFloor(); };
        $('endlessExit').onclick = () => finish(true);
      }
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
  const findOpenSummonPoint = (preferred, radius = WORLD.enemyRadius, minBossDistance = 72) => {
    const candidates = [];
    for (let y = 1; y < 6; y++) for (let x = 1; x < 8; x++) {
      if (run.map[y]?.[x] !== 'floor') continue;
      const p = worldPoint(x, y);
      if (!canOccupy(p.x, p.y, radius, 'enemy')) continue;
      if (dist(p, getBoss() || preferred) < minBossDistance) continue;
      if (run.enemies.some(e => !e.dead && e.hp > 0 && dist(p, e) < radius + (Number(e.radius) || WORLD.enemyRadius) + 8)) continue;
      candidates.push(p);
    }
    candidates.sort((a, b) => dist(a, preferred) - dist(b, preferred));
    if (!candidates.length) return null;
    const near = candidates.filter(p => dist(p, preferred) <= dist(candidates[0], preferred) + WORLD.cell * 1.1);
    return near[Math.floor(Math.random() * near.length)] || candidates[0];
  };
  const castLineTelegraph = (boss, duration, halfWidth, multiplier, label) => {
    const dx = run.player.x - boss.x, dy = run.player.y - boss.y;
    const lengthToPlayer = Math.hypot(dx, dy) || 1, ux = dx / lengthToPlayer, uy = dy / lengthToPlayer;
    const minX = 0, maxX = WORLD.width, minY = 0, maxY = WORLD.height;
    const tx = ux > 0 ? (maxX - boss.x) / ux : ux < 0 ? (minX - boss.x) / ux : Infinity;
    const ty = uy > 0 ? (maxY - boss.y) / uy : uy < 0 ? (minY - boss.y) / uy : Infinity;
    const length = Math.max(0, Math.min(tx, ty));
    // Draw directly in WORLD coordinates: rotated percentage-sized divs distort
    // against the map's 9:7 aspect ratio and can appear to stop near the player.
    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    frame.setAttribute('class', 'boss-range-frame boss-line-any');
    $('map').appendChild(frame);
    frame.setAttribute('viewBox', `0 0 ${WORLD.width} ${WORLD.height}`);
    frame.setAttribute('preserveAspectRatio', 'none');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:hidden;z-index:8;pointer-events:none;';
    const nx = -uy, ny = ux, ex = boss.x + ux * length, ey = boss.y + uy * length;
    const uid = `boss-ray-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    frame.innerHTML = `<defs><linearGradient id="${uid}" gradientUnits="userSpaceOnUse" x1="${boss.x + nx * halfWidth}" y1="${boss.y + ny * halfWidth}" x2="${boss.x - nx * halfWidth}" y2="${boss.y - ny * halfWidth}"><stop offset="0" stop-color="#ff4931" stop-opacity="0"/><stop offset=".2" stop-color="#ff4931" stop-opacity=".2"/><stop offset=".5" stop-color="#f04438" stop-opacity=".62"/><stop offset=".8" stop-color="#ff4931" stop-opacity=".2"/><stop offset="1" stop-color="#ff4931" stop-opacity="0"/></linearGradient></defs><line x1="${boss.x}" y1="${boss.y}" x2="${ex}" y2="${ey}" stroke="url(#${uid})" stroke-width="${halfWidth * 2}" stroke-linecap="butt"/><line x1="${boss.x}" y1="${boss.y}" x2="${ex}" y2="${ey}" stroke="#ffe5a9" stroke-width="2" stroke-dasharray="10 8"/><circle cx="${boss.x}" cy="${boss.y}" r="8" fill="#ff4931" stroke="#fff1bb" stroke-width="3"/>`;
    run.bossEffects.push({ type: 'line', el: frame, ux, uy, length, halfWidth, multiplier, label, landsAt: Date.now() + duration, boss });
  };
  const createLineAftermath = (effect, cls, durationMs) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', cls);
    $('map').appendChild(el);
    el.setAttribute('viewBox', `0 0 ${WORLD.width} ${WORLD.height}`);
    el.setAttribute('preserveAspectRatio', 'none');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:absolute;inset:0;width:100%;height:100%;overflow:hidden;z-index:${cls === 'boss-thunder-strike' ? 11 : 10};pointer-events:none;`;
    const { boss, ux, uy, length, halfWidth } = effect;
    const nx = -uy, ny = ux, ex = boss.x + ux * length, ey = boss.y + uy * length;
    const points = `${boss.x + nx * halfWidth},${boss.y + ny * halfWidth} ${ex + nx * halfWidth},${ey + ny * halfWidth} ${ex - nx * halfWidth},${ey - ny * halfWidth} ${boss.x - nx * halfWidth},${boss.y - ny * halfWidth}`;
    const count = Math.max(4, Math.ceil(length / 85));
    const path = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, offset = i === 0 || i === count ? 0 : (i % 2 ? 5 : -5);
      path.push(`${(boss.x + ux * length * t + nx * offset).toFixed(1)},${(boss.y + uy * length * t + ny * offset).toFixed(1)}`);
    }
    const fill = cls === 'boss-thunder-strike' ? '#72dfff' : '#a34830';
    const opacity = cls === 'boss-thunder-strike' ? '.36' : '.32';
    const uid = `${cls}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const glow = cls === 'boss-thunder-strike' ? `<filter id="${uid}-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : '';
    const filter = cls === 'boss-thunder-strike' ? ` filter="url(#${uid}-glow)"` : '';
    el.innerHTML = `<defs><linearGradient id="${uid}-along" gradientUnits="userSpaceOnUse" x1="${boss.x}" y1="${boss.y}" x2="${ex}" y2="${ey}"><stop offset="0" stop-color="${fill}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${fill}" stop-opacity="${opacity}"/></linearGradient>${glow}</defs><polygon points="${points}" fill="url(#${uid}-along)"/><line x1="${boss.x}" y1="${boss.y}" x2="${ex}" y2="${ey}" stroke="${cls === 'boss-thunder-strike' ? '#c6f6ff' : '#f0bc67'}" stroke-width="2" stroke-dasharray="9 7" opacity=".9"/><polyline points="${path.join(' ')}" fill="none" stroke="${cls === 'boss-thunder-strike' ? '#e8fcff' : '#3a2119'}" stroke-width="${cls === 'boss-thunder-strike' ? 6 : 12}" stroke-linecap="round" stroke-linejoin="round"${filter}/>${cls === 'boss-ground-crack' ? `<polyline points="${path.join(' ')}" fill="none" stroke="#f0bc67" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`;
    setTimeout(() => el.remove(), durationMs);
  };
  const summonMud = (boss, count = 2) => {
    const cfg = MONSTER_CONFIG.summons?.zarianBlackMud || {};
    for (let i = 0; i < count; i++) {
      const preferred = worldPoint(i ? 6 : 2, i ? 2 : 4), p = findOpenSummonPoint(preferred, Number(cfg.radius) || 20);
      if (!p) { addLog('亞空黑泥召喚失敗：周圍沒有可用的空地。'); continue; }
      const hp = Math.max(1, Math.round(boss.maxHp * (Number(cfg.hpRatio) || .12)));
      run.enemies.push({ ...cfg, id: cfg.id || 'zarian-black-mud', name: cfg.name || '亞空黑泥', icon: cfg.icon || '🖤', x: p.x, y: p.y, hp, maxHp: hp,
        atk: Math.max(1, Math.round(boss.atk * (Number(cfg.attackRatio) || .38))), boss: false, dead: false, summoned: true, aggro: true,
        classType: cfg.classType || 'ranged', speed: Number(cfg.speed) || 0, attackRange: Number(cfg.attackRange) || 620, keepDistance: Number(cfg.keepDistance) || 220, attackCooldown: Number(cfg.attackCooldownMs) || 1800,
        projectileSpeed: Number(cfg.projectileSpeed) || 225, projectileIcon: cfg.projectileIcon || '●', projectileLifetimeMs: Number(cfg.projectileLifetimeMs) || 5000, radius: Number(cfg.radius) || 20,
        homeX: p.x, homeY: p.y, leashRange: 9999, uid: `mud-${++uidSequence}`, nextAttackAt: Date.now() + 900 });
    }
    addLog(`「${skillName('zarian', 'voidMire')}」：黑泥現身，正向你射出黑色液滴。`);
  };
  const summonBull = (boss, angle, golden = false) => newProjectile(boss, angle, 707.2, '🐂', { radius: 63, lifetimeMs: 5000, bullCharge: true, goldenCharge: golden });
  const updateBossEffectTimers = now => {
    const effects = run.bossEffects || [];
    run.bossEffects = effects.filter(effect => {
      if (now < effect.landsAt) return true;
      effect.el?.remove();
      if (effect.type === 'fire') {
        if (effect.label.includes('淵火如雨')) {
          const pillar = addBossMarker('boss-fire-pillar', effect.x, effect.y, effect.radius * .78, '🔥');
          setTimeout(() => pillar.remove(), 760);
        }
        if (dist({ x: effect.x, y: effect.y }, run.player) <= effect.radius + WORLD.playerRadius) damagePlayer(effect.boss, effect.multiplier, effect.label);
      } else if (effect.type === 'line') {
        const dx = run.player.x - effect.boss.x, dy = run.player.y - effect.boss.y;
        const along = dx * effect.ux + dy * effect.uy;
        const across = Math.abs(dx * effect.uy - dy * effect.ux);
        if (along >= 0 && along <= effect.length && across <= effect.halfWidth) {
          const d = dist(effect.boss, run.player), falloff = Math.max(.25, 1 - d / (WORLD.width * 1.35));
          damagePlayer(effect.boss, effect.multiplier * falloff, effect.label);
        }
        if (effect.label.includes('雷霆')) createLineAftermath(effect, 'boss-thunder-strike', 480);
        else createLineAftermath(effect, 'boss-ground-crack', 2000);
      }
      return false;
    });
    if (!(run.bossEffects || []).some(x => x.type === 'line')) { const lane = $('bossWarningLane'); if (lane) lane.style.display = 'none'; }
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
        const preferred = worldPoint(2 + Math.floor(Math.random() * 5), 1 + Math.floor(Math.random() * 5));
        const p = findOpenSummonPoint(preferred, Number(cfg.radius) || 21);
        if (!p) { addLog('異星水晶召喚失敗：周圍沒有可用的空地。'); boss.nextSkillAt = now + (Number(bossSpec(id)?.skillIntervalMs) || 5500); return; }
        const hp = Math.round(boss.maxHp * (Number(cfg.hpRatio) || .12));
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
        addLog(`「${skillName('prince', 'serpentShield')}」：王子靜止並獲得護盾；時間內未打破將使你的生命降至 1 點！`);
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
        summonBull(boss, a, second);
        boss.bullChargeQueue = count > 1 ? { remaining: count - 1, angle: a + (Math.random() < .5 ? -.13 : .13), golden: second } : null;
        addLog(`「${skillName('trefasha', second ? 'heavenBull' : 'bullCall')}」：巨牛沿直線衝破障礙，衝至地圖邊界後消失。`);
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
      boss.icon = bossSpec('zarian').icon; boss.mode = 'melee'; boss.classType = 'boss'; boss.attackType = 'melee'; boss.projectileSpeed = 0; boss.keepDistance = 0; boss.rangedMoveTarget = null; boss.attackRange = Number(second.attackRange) || 82; boss.speed = Number(second.speed) || 205; boss.attackCooldown = Number(second.attackCooldownMs) || 1350; boss.windupMs = Number(second.windupMs) || 440; boss.nextAttackAt = now + 250; boss.attackWindupUntil = 0;
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
      if (boss.shieldHp > 0) { run.hp = 1; boss.shieldHp = 0; addLog('「那伽那伽密」護盾未能及時打破，玩家生命被削減至 1 點！護盾消散。'); render(); }
      else addLog('神足王子的護盾被擊破，禁錮解除！');
    }
    if (boss.bullChargeQueue?.remaining > 0 && !(run.projectiles || []).some(p => p.bullCharge && !p.dead)) {
      const queue = boss.bullChargeQueue;
      summonBull(boss, queue.angle, queue.golden);
      queue.remaining--;
      if (!queue.remaining) boss.bullChargeQueue = null;
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
    const activeSkills = (bossSpec(boss.bossId)?.skills || []).filter(skill => !skill.phase || skill.phase === boss.phase);
    run.bossStatus = now < (run.playerSnaredUntil || 0)
      ? `龍威禁錮：移動速度降低 75%，剩餘 ${((run.playerSnaredUntil - now) / 1000).toFixed(1)} 秒。`
      : boss.phaseTransitionAt ? '第一階段已潰敗，等待札里安復甦。' : `技能「${activeSkills[Math.max(0, (boss.skillStep - 1) % Math.max(1, activeSkills.length))]?.name || '蓄勢'}」準備中。`;
  };

  const oldApplyWeaponHit = applyWeaponHit;
  applyWeaponHit = function (e, dmg, w, now) {
    if (isCustomBoss(e) && e.phaseTransitionAt) { addLog('札里安的圖框轉為灰色，等待第二階段復甦。'); return false; }
    if (isCustomBoss(e) && e.shieldHp > 0) {
      const absorbed = Math.min(e.shieldHp, dmg); e.shieldHp -= absorbed; dmg -= absorbed;
      floatDamage(e, absorbed, true);
      if (e.bossId === 'prince' && e.shieldHp <= 0) { e.shieldHp = 0; e.bossFrozen = false; e.shieldUntil = 0; addLog('那伽那伽密護盾破裂，神足王子解除靜止。'); }
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
      run.bossDefeated = true; run.bossStatus = `${e.name}已倒下；收集戰利品後前往出口完成遠征。`;
      clearBossEffects();
      return result;
    }
    if (e?.boss && run?.activeBossSpec?.id === 'dreamKing') {
      const relic = RELICS.find(item => item.bossRelicFor === 'dreamKing');
      run.bossRelicsClaimed ||= [];
      if (relic && !run.bossRelicsClaimed.includes(relic.id) && !(run.relics || []).some(item => item.id === relic.id) && Math.random() < .75) { run.bossRelicsClaimed.push(relic.id); createGroundLoot('relic', e.x, e.y, { relic }); addLog(`首領專屬遺物「${relic.name}」落在地上。`); }
      e.boss = false;
      const result = oldHandleDefeat(e);
      e.boss = true;
      run.bossDefeated = true; run.bossStatus = `${e.name}已倒下；收集戰利品後前往出口完成遠征。`;
      clearBossEffects();
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
    .boss-range-frame{position:absolute;z-index:8;box-sizing:border-box;border:0;pointer-events:none;animation:bossRangePulse .35s infinite alternate}
    .boss-line-any{background:linear-gradient(to bottom,transparent 0%,#ff49312a 16%,#f0443866 50%,#ff49312a 84%,transparent 100%)}
    .boss-line-any::before{content:"";position:absolute;left:0;right:0;top:50%;border-top:2px dashed #ffe5a9;filter:drop-shadow(0 0 4px #ff4931)}
    .boss-line-any::after{content:"";position:absolute;left:0;top:50%;width:12px;height:12px;border:2px solid #fff1bb;border-radius:50%;background:#ff4931;box-shadow:0 0 10px 4px #ff4931;transform:translate(-50%,-50%)}
    .boss-fire-pillar{position:absolute;z-index:12;display:grid;place-items:center;transform:translate(-50%,-50%);font-size:42px;background:linear-gradient(to top,#a91d16dd 0%,#ff6722a8 42%,#ffdb5c22 100%);clip-path:polygon(38% 100%,20% 67%,34% 74%,17% 41%,40% 55%,34% 15%,52% 0,68% 39%,78% 20%,80% 62%,98% 48%,73% 100%);filter:drop-shadow(0 0 12px #ff4b1d);animation:firePillarFall .72s ease-out both;pointer-events:none}
    .boss-ground-crack{position:absolute;z-index:10;overflow:hidden;pointer-events:none;opacity:.92;filter:drop-shadow(0 0 4px #e7a747);animation:groundCrackFade 2s ease-out both}
    .boss-thunder-strike{position:absolute;z-index:11;pointer-events:none;filter:drop-shadow(0 0 7px #54dcff);animation:thunderStrike .46s steps(2,end) both}
    @keyframes firePillarFall{0%{opacity:.2;transform:translate(-50%,-50%) scaleY(.08)}28%{opacity:1;transform:translate(-50%,-50%) scaleY(1.22)}100%{opacity:.2;transform:translate(-50%,-50%) scaleY(.8)}}
    @keyframes groundCrackFade{0%{opacity:1}75%{opacity:.9}100%{opacity:0}}
    @keyframes thunderStrike{0%{opacity:0;filter:brightness(1)}22%{opacity:1;filter:brightness(2.6)}100%{opacity:0;filter:brightness(1)}}
    .boss-flame-cone{position:absolute;z-index:9;transform:translate(-50%,-50%);font-size:34px;pointer-events:none;filter:drop-shadow(0 0 9px #e45a25)}
    .boss-charge-bull{font-size:109px!important;width:16.8%!important;min-width:88px;line-height:1!important;filter:drop-shadow(0 0 12px #a52b22)!important}
    .boss-charge-gold{filter:sepia(1) saturate(6) hue-rotate(350deg) brightness(1.12) drop-shadow(0 0 16px #ffd43b)!important}
    .boss-red-stage .arena-sprite{filter:sepia(1) saturate(6) hue-rotate(320deg) brightness(.82)!important}
    .boss-black-stage .arena-sprite{filter:grayscale(1) brightness(.35)!important}
    .boss-grey .arena-sprite{filter:grayscale(1) brightness(.52)!important;opacity:.65}
    .boss-shielded .arena-sprite{filter:drop-shadow(0 0 12px #5d9de8)!important}
    .boss-gold-scene #gameScreen{filter:sepia(.65) saturate(1.45)}
    @keyframes bossFirePulse{from{opacity:.48;transform:translate(-50%,-50%) scale(.88)}to{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}
    @keyframes bossRangePulse{from{opacity:.58}to{opacity:1}}
  `;
  document.head.appendChild(style);
  renderMeta();
})();
