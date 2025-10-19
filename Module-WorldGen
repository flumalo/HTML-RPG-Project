<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/></head>
<body>
<script>
/* WorldGen mejorado: biomas extra, cuevas sólo en montañas, spawn anti-cluster determinista */
(function(exports){
  // ---- Perlin compacto ----
  const Perlin = (() => {
    const perm = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    const p = new Uint8Array(512); for(let i=0;i<512;i++) p[i]=perm[i&255];
    const fade = t=> t*t*t*(t*(t*6-15)+10);
    const lerp = (a,b,t)=> a + t*(b-a);
    const grad = (h,x,y)=> { const hh = h & 3; const u = hh<2?x:y; const v = hh<2?y:x; return ((hh&1)?-u:u) + ((hh&2)?-2*v:2*v); };
    return {
      noise2D(x,y){
        const X = Math.floor(x)&255, Y = Math.floor(y)&255;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const bl = p[p[X]+Y], br = p[p[X+1]+Y], tl = p[p[X]+Y+1], tr = p[p[X+1]+Y+1];
        const u = fade(xf), v = fade(yf);
        const x1 = lerp(grad(bl, xf, yf), grad(br, xf-1, yf), u);
        const x2 = lerp(grad(tl, xf, yf-1), grad(tr, xf-1, yf-1), u);
        return (lerp(x1,x2,v) + 1)/2;
      },
      fbm(x,y,oct=4,lac=2,gain=0.5){
        let sum=0,amp=1,freq=1,max=0;
        for(let i=0;i<oct;i++){ sum+= amp*Perlin.noise2D(x*freq,y*freq); max+=amp; amp*=gain; freq*=lac; }
        return sum/max;
      }
    };
  })();

  // ---- util ----
  const seedFromString = s=>{ let h=2166136261>>>0; for(let i=0;i<s.length;i++) h=(h^s.charCodeAt(i))*16777619>>>0; return h; };
  const key = (x,y)=> `${x},${y}`;
  const clamp = (v,min,max)=> Math.max(min,Math.min(max,v));

  // ---- biomas extendidos ----
  const BIOME_COLOR = {
    pradera:'#3BB54A', jungla:'#1c7a3b', desierto:'#d4b96b', pantano:'#2f6b87',
    cuevas:'#6b655f', agua:'#3AA3FF', arena:'#FFC857', bosque:'#1f8b3a', montaña:'#7a6f5a'
  };
  function decideBiome(elev, moist, caveMask){
    if(elev > 0.72) return 'montana';
    if(elev > 0.60 && moist > 0.55) return 'bosque';
    if(caveMask > 0.7 && elev > 0.65) return 'cuevas'; // cuevas only on mountains (elev>0.65)
    if(elev < 0.28) return moist > 0.6 ? 'pantano' : 'agua';
    if(elev < 0.34) return 'arena';
    if(moist > 0.65) return 'jungla';
    if(moist > 0.45) return 'pradera';
    return 'desierto';
  }

  // ---- enemigos (compacto) ----
  const ENEMY_DEFS = [
    {e:'🦊',n:'Zorro',hp:4,d:1,biomes:['pradera','bosque'],w:0.06},
    {e:'🐺',n:'Lobo',hp:6,d:2,biomes:['pradera','bosque'],w:0.04},
    {e:'🐆',n:'Leopardo',hp:5,d:2,biomes:['jungla','bosque'],w:0.03},
    {e:'🐅',n:'Tigre',hp:12,d:4,biomes:['jungla'],w:0.01},
    {e:'🐗',n:'Jabalí',hp:8,d:1,biomes:['pradera','bosque'],w:0.03},
    {e:'🦣',n:'Elefante',hp:28,d:4,biomes:['pradera','jungla'],w:0.004},
    {e:'🐊',n:'Cocodrilo',hp:8,d:4,biomes:['pantano'],w:0.06},
    {e:'🐍',n:'Serpiente',hp:2,d:5,biomes:['cuevas','desierto'],w:0.08},
    {e:'🐉',n:'Dragon',hp:50,d:10,biomes:['cuevas','montana','pradera'],w:0.002},
    {e:'🦂',n:'Escorpión',hp:1,d:3,biomes:['desierto'],w:0.06},
    {e:'💀',n:'Esqueleto',hp:5,d:3,biomes:['cuevas'],w:0.05},
    {e:'🧌',n:'Troll',hp:25,d:6,biomes:['cuevas','montana'],w:0.006},
    {e:'🥷🏻',n:'Guerrero',hp:10,d:4,biomes:['pradera','bosque','montana'],w:0.02},
    {e:'🧙🏻‍♂️',n:'Mago',hp:6,d:6,biomes:['pradera','jungla','montana'],w:0.01}
  ];

  // ---- configuracion y almacenamiento ----
  let cfg = { seed: seedFromString('flu'), worldSize:500, spawnRadiusPriority:2, densityCut:0.5 };
  const world = { cells: new Map(), enemies: new Map(), seed: cfg.seed };

  // ---- prioridad local determinista ----
  // prioridad(x,y) = fbm(...) * 0.8 + pseudoRand(x,y)*0.2
  function priorityAt(x,y){
    const a = Perlin.fbm((x+12.7)/90, (y-9.3)/90, 3,2,0.5);
    const b = Perlin.noise2D((x+3.3)*0.27, (y+5.1)*0.27);
    return clamp(a*0.8 + b*0.2, 0, 1);
  }

  // ---- generar tile determinista ----
  function generateTile(x,y, playerLevel=1){
    const scale = 1/90;
    const elev = Perlin.fbm(x*scale, y*scale, 5,2,0.5);
    const moist = Perlin.fbm((x+400)*scale, (y-300)*scale, 4,2,0.55);
    const caveMask = Perlin.fbm((x-200)*scale, (y+200)*scale, 3,2,0.5);
    const biome = decideBiome(elev, moist, caveMask);
    world.cells.set(key(x,y), {x,y,elev,moist,caveMask,biome});
    // spawn logic: compute raw spawn score and local priority; allow spawn only if priority is local maximum
    const raw = Perlin.noise2D((x+14.2)*0.13, (y-11.8)*0.13);
    const spawnChanceByBiome = {pradera:0.03,jungla:0.04,desierto:0.02,pantano:0.05,cuevas:0.035,agua:0,arena:0.01,bosque:0.035,montana:0.02}[biome] || 0.02;
    if(raw <= spawnChanceByBiome){
      const prio = priorityAt(x,y);
      // check neighborhood priorities deterministically
      let best = prio, bestPos = [x,y];
      const R = cfg.spawnRadiusPriority;
      for(let oy=-R; oy<=R; oy++){
        for(let ox=-R; ox<=R; ox++){
          if(ox===0 && oy===0) continue;
          const nx = x+ox, ny = y+oy;
          const np = priorityAt(nx,ny);
          if(np > best){ best = np; bestPos = [nx,ny]; }
        }
      }
      // only spawn if current tile is local maximum (ties broken by tile coords)
      const isLocalMax = (bestPos[0]===x && bestPos[1]===y);
      if(isLocalMax){
        // choose enemy pool and select by weight
        const pool = ENEMY_DEFS.filter(d => d.biomes.includes(biome));
        if(pool.length){
          const total = pool.reduce((s,p)=>s+p.w,0);
          let r = Math.floor(Math.abs(Math.sin((x*73856093) ^ (y*19349663) ^ cfg.seed))*100000)/100000 * total;
          for(const def of pool){
            r -= def.w;
            if(r <= 0){
              // determine enemy level relative to playerLevel: deterministic offset -2..+2
              const lvlOffset = Math.floor(Perlin.noise2D((x+1.1)*0.37,(y+2.2)*0.37)*5)-2;
              const eLvl = Math.max(1, playerLevel + lvlOffset);
              const scaleFactor = 1 + 0.15*(eLvl-1);
              const inst = {
                def, emoji:def.e, name:def.n, level:eLvl,
                maxHp: Math.max(1, Math.round(def.hp * scaleFactor)),
                hp: Math.max(1, Math.round(def.hp * scaleFactor)),
                dmg: Math.max(1, Math.round(def.d * scaleFactor))
              };
              world.enemies.set(key(x,y), inst);
              return;
            }
          }
        }
      }
    }
    world.enemies.set(key(x,y), null);
  }

  // ---- pre-generate visible block (sync) ----
  function preGenerateVisible(cx,cy,half=12, playerLevel=1){
    const sx = cx-half, sy = cy-half, ex = cx+half, ey = cy+half;
    for(let y=sy;y<=ey;y++) for(let x=sx;x<=ex;x++) {
      if(!world.cells.has(key(x,y))) generateTile(x,y, playerLevel);
    }
  }

  // ---- chunked pre-generation whole world ----
  function generateChunked(centerX=0,centerY=0,area=cfg.worldSize, onProgress){
    const half = Math.floor(area/2);
    const coords = [];
    for(let y=centerY-half; y<=centerY+half; y++) for(let x=centerX-half; x<=centerX+half; x++){
      const k = key(x,y); if(!world.cells.has(k)) coords.push({x,y});
    }
    let i=0, total=coords.length;
    const step = ()=>{
      const end = Math.min(total, i + 1500);
      for(; i<end; i++) generateTile(coords[i].x, coords[i].y);
      if(onProgress) onProgress(Math.round(i/total*100));
      if(i<total) {
        if(window.requestIdleCallback) requestIdleCallback(step, {timeout:50});
        else setTimeout(step, 16);
      } else if(onProgress) onProgress(100);
    };
    step();
  }

  // ---- API ----
  function init(options={}){ cfg.seed = seedFromString(String(options.seed||cfg.seed)); cfg.worldSize = options.worldSize||cfg.worldSize; world.seed = cfg.seed; return exports; }
  function getTile(x,y){ const k=key(x,y); if(!world.cells.has(k)) generateTile(x,y); return world.cells.get(k); }
  function getEnemy(x,y){ const k=key(x,y); if(!world.cells.has(k)) generateTile(x,y); return world.enemies.get(k); }
  function clear(){ world.cells.clear(); world.enemies.clear(); }
  function getBiomeColor(b){ return BIOME_COLOR[b] || '#000'; }

  exports.init = init;
  exports.generateTile = generateTile;
  exports.getTile = getTile;
  exports.getEnemy = getEnemy;
  exports.preGenerateVisible = preGenerateVisible;
  exports.generateChunked = generateChunked;
  exports.clear = clear;
  exports.getBiomeColor = getBiomeColor;
  exports._world = world;
})(window.WorldGen = window.WorldGen || {});
</script>
</body>
</html>
