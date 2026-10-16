/* Extra configurable relic effects and UI refinements. Loaded after the main game scripts. */
(() => {
  const owned = id => !!run?.relics?.some(relic => relic.id === id);
  const css = document.createElement('style');
  css.textContent = `
    #metaShop .forge-icon{border-radius:50%!important}
    #gameScreen .arena-shield-bar{position:absolute;z-index:16;left:50%;top:calc(112% + 8px);transform:translateX(-50%);width:165%;height:4px;border-radius:99px;background:#26323a;border:1px solid #60777e;overflow:hidden;pointer-events:none}
    #gameScreen .arena-shield-bar span{display:block;height:100%;background:linear-gradient(90deg,#4a9eb8,#9ceaff)}
    #gameScreen .arena-actor.player .hero-held-weapon{right:-82%!important;bottom:22%!important}
    #gameScreen .arena-actor.player .hero-held-weapon .game-icon-image{width:31px;height:31px}
    #gameScreen .arena-actor.player .hero-held-weapon{transform:rotate(145deg)!important}
    #gameScreen .arena-actor.player .hero-held-weapon.is-staff{transform:rotate(60deg)!important}
    #gameScreen .arena-actor.player .hero-held-weapon.is-gunlance{transform:rotate(325deg)!important}
    #gameScreen .arena-actor.player .hero-held-weapon.is-bow{transform:rotate(55deg)!important}
  `;
  document.head.appendChild(css);

  const priorAddLog = addLog;
  addLog = function (message) {
    const text = String(message ?? '');
    if (/^自然恢復：/.test(text) || /^空揮！/.test(text) || /^你向當前方向衝刺：/.test(text) || /^衝刺無敵生效，/.test(text) || /^你以衝刺避開/.test(text)) return;
    if (/^(?:你以.+攻擊|你對.+造成)\s*\S/.test(text)) return;
    if (/^(?:[^，。]+(?:發動(?:斬擊|啃咬|衝撞／啃咬)|反擊，造成|的遠程投射物命中你|的攻擊使你流血)|魔王「.+?」命中你|夢境君王的.+?命中你|旅人聖所的補給箱突然爆炸！你受到)/.test(text)) return;
    return priorAddLog(message);
  };

  const priorMakeRoom = makeRoom;
  makeRoom = function (...args) {
    const result = priorMakeRoom(...args);
    if (run?.roomType === 'rest') run.merchantUsed = false;
    return result;
  };

  const priorRenderArena = renderArena;
  renderArena = function (...args) {
    const result = priorRenderArena(...args);
    if (!run) return result;
    for (const e of aliveEnemies()) {
      const actor = $('arenaActor-' + String(e.uid || '').replace(/[^a-zA-Z0-9_-]/g, '_'));
      if (!actor) continue;
      if (e.boss) {
        let bar = actor.querySelector('.arena-shield-bar');
        if (Number(e.shieldHp) > 0) {
          if (!bar) { bar = document.createElement('div'); bar.className = 'arena-shield-bar'; bar.innerHTML = '<span></span>'; actor.querySelector('.arena-hp')?.insertAdjacentElement('afterend', bar); }
          const ratio = Math.max(0, Math.min(1, Number(e.shieldHp) / Math.max(1, Number(e.shieldMaxHp) || Number(e.maxHp) || 1)));
          bar.firstElementChild.style.width = `${ratio * 100}%`;
          bar.title = `護盾 ${Math.ceil(e.shieldHp)} / ${Math.ceil(e.shieldMaxHp || e.maxHp)}`;
        } else bar?.remove();
      }
    }
    return result;
  };

  const priorEnemyDamage = applyEnemyDamageToPlayer;
  applyEnemyDamageToPlayer = function (enemy, now, projectileHit = false) {
    const before = Number(run?.hp) || 0;
    const dealt = priorEnemyDamage(enemy, now, projectileHit);
    if (!run || dealt <= 0) return dealt;
    const source = enemy?.owner || enemy;
    if (owned('zarian-void-ward') && source) {
      source._relicSlowUntil = now + (Number(run.bossAttackerSlowDurationMs) || 3000);
      source._relicSlowMultiplier = Number(run.bossAttackerSlowMultiplier) || .5;
    }
    if (owned('dream-bubble-phantom') && before / Math.max(1, run.maxHp) > (Number(run.dreamBubbleThreshold) || .5) && run.hp / Math.max(1, run.maxHp) <= (Number(run.dreamBubbleThreshold) || .5)) {
      run.dreamBubbleUntil = now + (Number(run.dreamBubbleDurationMs) || 2000);
      addLog('「泡沫幻影」綻放：移動速度暫時提高 100%。');
    }
    return dealt;
  };

  const priorMoveActor = moveActor;
  moveActor = function (actor, dx, dy, ...args) {
    if (run && actor === run.player && Date.now() < (run.dreamBubbleUntil || 0)) {
      const multiplier = Number(run.dreamBubbleSpeedMultiplier) || 2;
      dx *= multiplier; dy *= multiplier;
    }
    return priorMoveActor(actor, dx, dy, ...args);
  };

  const priorMoveEnemies = moveEnemies;
  moveEnemies = function (dt, now) {
    const slowed = [];
    if (run) for (const enemy of run.enemies || []) if (enemy._relicSlowUntil > now && Number.isFinite(enemy.speed)) {
      slowed.push([enemy, enemy.speed]); enemy.speed *= Number(enemy._relicSlowMultiplier) || .5;
    }
    try { return priorMoveEnemies(dt, now); }
    finally { for (const [enemy, speed] of slowed) enemy.speed = speed; }
  };

  const priorWeaponHit = applyWeaponHit;
  let cleaveBusy = false;
  applyWeaponHit = function (target, damage, weapon, now) {
    const before = Number(target?.hp) || 0;
    const landed = priorWeaponHit(target, damage, weapon, now);
    if (!run || !landed || !target) return landed;
    const actual = Math.max(0, before - (Number(target.hp) || 0));
    if (actual > 0 && (Number(run.bossLifestealPercent) || 0) > 0) {
      const healed = Math.min(run.maxHp - run.hp, actual * run.bossLifestealPercent);
      if (healed > 0) { run.hp += healed; floatDamage(run.player, healed, true); }
    }
    if (!cleaveBusy && actual > 0 && (Number(run.bossCleavePercent) || 0) > 0) {
      const radius = (Number(WORLD.cell) || 100) * (Number(run.bossCleaveRadiusCells) || 1.5);
      const splash = Math.max(1, Math.round((Number(run.atk) || 1) * run.bossCleavePercent));
      cleaveBusy = true;
      try {
        for (const other of aliveEnemies()) if (other !== target && Math.hypot(other.x - target.x, other.y - target.y) <= radius) {
          const oldHp = Number(other.hp) || 0;
          const result = priorWeaponHit(other, splash, weapon, now);
          const dealt = result ? Math.max(0, oldHp - (Number(other.hp) || 0)) : 0;
          if (dealt > 0 && (Number(run.bossLifestealPercent) || 0) > 0) {
            const healed = Math.min(run.maxHp - run.hp, dealt * run.bossLifestealPercent);
            if (healed > 0) { run.hp += healed; floatDamage(run.player, healed, true); }
          }
        }
      } finally { cleaveBusy = false; }
    }
    if (actual > 0) render();
    return landed;
  };
})();
