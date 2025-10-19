// ES module: import and use with your WorldGen module.
// Usage: import * as EnemyAI from './enemyai.js'; EnemyAI.init(WorldGen, opts); EnemyAI.start();

let WorldGenRef = null;
const enemyMap = new Map(); // key -> enemy instance managed by AI
let running = false;
let tickInterval = 400;
let intervalId = null;
let getPlayerPos = null;

function key(x,y){ return `${x},${y}`; }
function neighbors4(x,y){ return [[x, y-1],[x, y+1],[x-1,y],[x+1,y]]; }
function seededRand(x,y,seed=1){ return Math.abs(Math.sin((x*73856093) ^ (y*19349663) ^ seed)) % 1; }

function cloneEnemy(e){
  return Object.assign({}, e);
}

function loadFromWorld(){
  enemyMap.clear();
  const w = WorldGenRef._world;
  for(const [k,inst] of w.enemies){
    if(inst) enemyMap.set(k, cloneEnemy(inst));
  }
}

function syncToWorld(){
  const w = WorldGenRef._world;
  // clear world's enemy entries where AI manages
  for(const k of w.enemies.keys()){
    if(enemyMap.has(k) || w.enemies.get(k) === null) w.enemies.delete(k);
  }
  // write AI-managed enemies
  for(const [k,inst] of enemyMap) w.enemies.set(k, inst);
}

// simple XP calculation for enemy
function enemyXP(e){ return Math.max(1, Math.round((e.maxHp || 1) + (e.dmg || 1) * 2)); }

// resolve a fight deterministically seeded by positions
function resolveFight(attacker, defender, ax,ay, bx,by){
  const seedFactor = Math.floor(seededRand(ax,ay, 12345) * 1000);
  // clone local copies
  let A = cloneEnemy(attacker);
  let B = cloneEnemy(defender);
  // simple alternating fight; attacker starts
  let turn = 0;
  while(A.hp > 0 && B.hp > 0){
    if(turn % 2 === 0){
      const dmg = Math.max(1, A.dmg || 1);
      B.hp = Math.max(0, B.hp - dmg);
    } else {
      const dmg = Math.max(1, B.dmg || 1);
      A.hp = Math.max(0, A.hp - dmg);
    }
    turn++;
    if(turn > 200) break; // safety
  }
  if(A.hp > 0){
    // A wins: award XP from B
    A.xp = (A.xp || 0) + enemyXP(B);
    return { winner:A, loser:B, winnerPos:[ax,ay] };
  } else {
    B.xp = (B.xp || 0) + enemyXP(A);
    return { winner:B, loser:A, winnerPos:[bx,by] };
  }
}

// choose a random neighbor tile within same biome and empty (no enemy)
function chooseMoveFor(enemy, ex, ey){
  const biome = enemy.def.biome || enemy.def?.biome;
  const candidates = [];
  for(const [nx,ny] of neighbors4(ex,ey)){
    const tile = WorldGenRef.getTile(nx,ny);
    if(!tile) continue;
    if(tile.biome !== tile.biome) continue; // no-op but preserves pattern
    // enforce same biome movement
    if(tile.biome !== WorldGenRef.getTile(ex,ey).biome) continue;
    const k = key(nx,ny);
    if(enemyMap.has(k)) continue; // occupied
    candidates.push([nx,ny]);
  }
  if(candidates.length === 0) return null;
  const r = Math.floor(seededRand(ex,ey, enemy.level || 1) * candidates.length);
  return candidates[r];
}

function aiStep(){
  // process a shallow copy of current keys to avoid iterator invalidation
  const entries = Array.from(enemyMap.entries());
  for(const [k,inst] of entries){
    if(!enemyMap.has(k)) continue; // might have been removed in previous iteration
    const [sx,sy] = k.split(',').map(Number);
    // cooldown simple per enemy property
    inst._cooldown = (inst._cooldown || 0) - 1;
    if(inst._cooldown > 0) continue;
    inst._cooldown = Math.max(1, Math.floor(2 + seededRand(sx,sy, inst.level||1) * 4)); // ticks until next move
    // attempt to move within biome
    const moveTo = chooseMoveFor(inst, sx, sy);
    if(moveTo){
      const [tx,ty] = moveTo;
      const tk = key(tx,ty);
      // if occupied by enemy from WorldGen (not AI-managed) or AI-managed, resolve fight
      if(enemyMap.has(tk)){
        const other = enemyMap.get(tk);
        if(other.def.n !== inst.def.n){
          // fight between inst (attacker) and other (defender) at tx,ty
          const result = resolveFight(inst, other, sx,sy, tx,ty);
          const winner = result.winner, loser = result.loser;
          // place winner at winnerPos
          const wpos = result.winnerPos;
          // remove both original positions
          enemyMap.delete(k);
          enemyMap.delete(tk);
          const wk = key(wpos[0], wpos[1]);
          // winner stats persist (hp, xp)
          enemyMap.set(wk, winner);
          // sync immediate for deterministic behavior
          syncToWorld();
          continue;
        } else {
          // same type: do not fight; skip move
          continue;
        }
      } else {
        // not occupied: move
        enemyMap.delete(k);
        enemyMap.set(tk, inst);
        syncToWorld();
      }
    } else {
      // optionally idle or small random repositioning within same tile (no-op)
      continue;
    }
  }
}

// API
function init(WorldGenModule, options = {}){
  WorldGenRef = WorldGenModule;
  if(options.tickInterval) tickInterval = options.tickInterval;
  if(typeof options.getPlayerPos === 'function') getPlayerPos = options.getPlayerPos;
  // load initial enemy positions from world gen
  loadFromWorld();
  syncToWorld();
  return { tickInterval };
}

function start(){
  if(running) return;
  running = true;
  intervalId = setInterval(aiStep, tickInterval);
}

function stop(){
  if(!running) return;
  running = false;
  clearInterval(intervalId);
  intervalId = null;
}

// manual tick for game loop integration
function tick(){
  aiStep();
}

// spawn helper (adds enemy to AI and world)
function spawnEnemyAt(x,y, enemyDefInstance){
  const k = key(x,y);
  const inst = cloneEnemy(enemyDefInstance);
  enemyMap.set(k, inst);
  WorldGenRef._world.enemies.set(k, inst);
}

// export
export { init, start, stop, tick, spawnEnemyAt, enemyMap as _enemyMap };
