/* Shared by Canvas and the After Effects build. Keep this file ES3-compatible. */
function jzInterludeBounds(duration, segments, beat, barOffset) {
  var bounds = [0], bar = beat > 0 ? beat * 4 : 0;
  var interval = duration / segments, origin = barOffset || 0;
  for (var i = 1; i < segments; i++) {
    var at = interval * i;
    if (bar > 0) {
      var aligned = origin + Math.round((at - origin) / bar) * bar;
      if (Math.abs(at - aligned) < interval * .45) at = aligned;
    }
    bounds.push(at);
  }
  bounds.push(duration);
  return bounds;
}

function jzInterludeSequence(duration, style, seed, beat, previous, hasPhoto, barOffset, previousScene) {
  var themed = {
    noir: ['chroma'], crimson: ['panel', 'domino'], caution: ['panel'], magenta: ['domino'],
    paper: ['paper', 'ink', 'photo'], hud: ['radar'], specimen: ['photo'],
    transit: ['route'], blueprint: ['blueprint', 'route'], mono: ['ink']
  };
  var options = themed[style] instanceof Array ? themed[style] : [];
  var common = ['pulse', 'light', 'frame'];
  if (previous) common.push('glyph');
  var segments = duration > 6 ? Math.min(8, Math.ceil(duration / 4)) : 1;
  var bounds = jzInterludeBounds(duration, segments, beat, barOffset), result = [], last = previousScene || '';
  var i, j;
  for (i = 1; i < bounds.length; i++) {
    var pool = common.slice();
    for (j = 0; j < options.length; j++) {
      var id = options[j];
      if (id !== 'photo' || hasPhoto((bounds[i - 1] + bounds[i]) / 2)) pool.push(id, id, id);
    }
    var choices = [];
    for (j = 0; j < pool.length; j++) if (pool[j] !== last) choices.push(pool[j]);
    var n = ((seed >>> 0) + i * 7919) % 104729;
    n = (n * n * 8191 + n * 131) % 104729;
    last = choices[n % choices.length];
    result.push({ id: last, start: bounds[i - 1], end: bounds[i], seed: n });
  }
  return result;
}

function jzInterludeFrame(scene, W, H, q, phase, strong) {
  var id = scene.id, shapes = [], U = Math.min(W, H), X = W / 2, Y = H / 2, TAU = Math.PI * 2;
  var edge = Math.max(0, Math.min(1, 10 * q, 14 * (1 - q)));
  var weight = U * (0.002 + strong * 0.002), i, j, x, y, a, b, s, p, r, pts;
  function mark(points, color, alpha, width, close) {
    shapes.push({ points: points, color: color, alpha: alpha * edge, width: width || 0, close: close !== false });
  }
  function ring(cx, cy, radius, color, alpha, width, from, span) {
    var points = [], k, angle;
    from = from || 0; span = span || TAU;
    for (k = 0; k <= 24; k++) {
      angle = from + span * k / 24;
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
    mark(points, color, alpha, width, false);
  }
  function box(cx, cy, w, h, rot, color, alpha, width) {
    var corners = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]], points = [], k;
    var c = Math.cos(rot), sn = Math.sin(rot);
    for (k = 0; k < corners.length; k++) points.push([cx+c*corners[k][0]-sn*corners[k][1],cy+sn*corners[k][0]+c*corners[k][1]]);
    mark(points, color, alpha, width);
  }
  function rand(k) { var v = Math.sin(scene.seed * 0.31 + k * 127.1) * 43758.5453; return v - Math.floor(v); }

  if (id === 'pulse') {
    for (i = 0; i < 5; i++) {
      p = (phase + i / 5) % 1; r = U * (0.035 + p * (0.58 + strong * 0.24)) * (1 - 0.72 * Math.pow(q, 9));
      ring(X, Y, r, i % 2 ? 'accent' : 'accent2', (1 - p) * 0.8, weight * (1 + (1 - p) * 1.5));
    }
  } else if (id === 'light') {
    for (i = 0; i < 4; i++) {
      x = W * ((q * 1.7 + i / 4) % 1.4 - 0.2); s = U * (0.025 + strong * 0.035);
      mark([[x-s,0],[x,0],[x+H*.45,H],[x+H*.45+s,H]], i % 2 ? 'accent2' : 'accent', 0.12 + strong * 0.28);
    }
    box(X,Y,W*.95,H*.92,0,'accent',0.2 + strong * 0.7,weight);
  } else if (id === 'frame') {
    for (i = 0; i < 6; i++) {
      s = Math.pow(1.6, i / 2 + q * 2) * 0.22;
      box(X + W * .06 * Math.sin(q * TAU), Y, W*s, H*s, (i - 2) * .052 * (1 - q), i % 2 ? 'accent' : 'fg', .2 + (5-i)*.1, weight);
    }
  } else if (id === 'glyph') {
    for (i = 0; i < 15; i++) {
      a = i * TAU / 15 + q * TAU; r = U * (.04 + Math.sin(q * Math.PI) * (.18 + .27 * rand(i)));
      x = X + r * Math.cos(a); y = Y + r * Math.sin(a) * .78;
      box(x,y,U*(.024+.055*rand(i+20)),U*.009,a,'accent',.27 + strong*.4);
      shapes[shapes.length - 1].glyph = { x: x, y: y, angle: a, index: i };
    }
  } else if (id === 'chroma') {
    for (i = 0; i < 8; i++) {
      a = q * TAU / 2 + i * TAU / 8;
      x = X + U * .21 * Math.cos(a); y = Y + U * .21 * Math.sin(a);
      s = U * .012 * (1 - strong);
      box(x-s,y,U*.26,U*.08,a,'ghostA',.75,weight*1.4);
      box(x+s,y,U*.26,U*.08,a,'ghostB',.75,weight*1.4);
    }
  } else if (id === 'panel') {
    for (i = 0; i < 7; i++) {
      x = W * ((i - 1) / 5 + (i % 2 ? 1 : -1) * (.12 * q + strong * .065));
      mark([[x,0],[x+W*.1,0],[x-W*.2,H],[x-W*.31,H]],i % 2 ? 'accent' : 'dim',.34 + strong*.4);
    }
  } else if (id === 'radar') {
    for (i = 1; i <= 4; i++) ring(X,Y,U*.105*i,'sub',.36,weight);
    a = q * TAU * 2;
    for (i = 0; i < 10; i++) {
      b = a - .038 * i;
      mark([[X,Y],[X+U*.43*Math.cos(b),Y+U*.43*Math.sin(b)]],'accent',.67-i*.06,weight,false);
    }
    for (i = 0; i < 11; i++) {
      b = rand(i)*TAU; r = U*(.06+.35*rand(i+13));
      p = ((a-b+TAU*2)%TAU)/TAU;
      box(X+r*Math.cos(b),Y+r*Math.sin(b),U*.014,U*.014,Math.PI/4,'accent2',(1-p)*.95);
    }
  } else if (id === 'paper') {
    for (i = 0; i < 7; i++) {
      p = Math.min(1, Math.max(0, q * 2.4 - i * .18)); x = W * (.2+.6*rand(i));
      y = H * (.2+.6*rand(i+10)) - H*.7*(1-p)*(1-p); s = U * (.14+.26*rand(i+20));
      mark([[x-s/2,y-s/3],[x+s/2,y-s/3+U*.025],[x+s*.43,y+s/3],[x-s*.48,y+s*.26]],i % 3 ? 'sub' : 'accent',.42*p);
      for (j = 0; j < 5; j++) box(x+s*(j-2)*.15,y+s*.14,U*.009,U*.009,0,'fg',.5*p);
    }
  } else if (id === 'blueprint' || id === 'route') {
    for (i = 0; i < 6; i++) {
      p = Math.min(1, Math.max(0, q * 1.8 - i * .12));
      x = W*(.09+rand(i)*.37); y = H*(.13 + i*.145);
      a = id === 'route' ? X : W*(.54+.33*rand(i+14)); b = id === 'route' ? Y : H*(.18+rand(i+24)*.64);
      pts = [[x,y],[x+(a-x)*Math.min(1,2*p),y],[p>.5?a:x+(a-x)*2*p,y+(b-y)*Math.max(0,2*p-1)]];
      mark(pts, i % 2 ? 'accent' : 'accent2', .72 * p, weight*(id === 'route' ? 2 : 1), false);
      box(pts[2][0],pts[2][1],U*.018,U*.018,id === 'route' ? Math.PI/4 : 0,'fg',.8*p);
    }
    if(id === 'blueprint') for(i=1;i<9;i++) {
      mark([[W*i/9,0],[W*i/9,H]],'sub',.2,weight*.5,false);
      mark([[0,H*i/9],[W,H*i/9]],'sub',.2,weight*.5,false);
    }
  } else if (id === 'photo') {
    for (i = 0; i < 4; i++) {
      p = Math.min(1, Math.max(0,q*2.5-i*.3));
      x = W*(.20+.60*rand(i)); y = H*(.25+.5*rand(i+10)) - H*.74*(1-p)*(1-p);
      s = U*(.26+.13*rand(i+20)); a = (rand(i+30)-.5)*.6;
      if(i===3){
        b=Math.pow(q,8); x+=(X-x)*b; y+=(Y-y)*b; s+=(Math.max(W,H)*1.4-s)*b; a*=1-b;
      }
      box(x,y,s,s*.78,a,'fg',p*.95);
      shapes[shapes.length - 1].photo = { x: x, y: y, size: s, angle: a, index: i };
    }
  } else if (id === 'domino') {
    for (i = 0; i < 12; i++) {
      p = Math.min(1,Math.max(0,q*1.65-i*.08));
      x=W*(.1+.8*(i%4)/3); y=H*(.2+.6*Math.floor(i/4)/2);
      box(x,y,U*.17,U*(.012+.17*Math.sin(p*Math.PI/2)),(i%2?1:-1)*.32*(1-p),i%2?'accent2':'accent',p*(.42+strong*.43));
    }
  } else if (id === 'ink') {
    for (i = 0; i < 9; i++) {
      a = rand(i)*TAU; r = U*(.08+.31*rand(i+10))*Math.pow(q,.55);
      x = X + W*.6*(1-q)*Math.cos(a); y = Y + H*.6*(1-q)*Math.sin(a);
      pts = [];
      for(j=0;j<13;j++){
        b=j*TAU/13; s=r*(.65+.45*rand(i*13+j+20));
        pts.push([x+s*Math.cos(b),y+s*.85*Math.sin(b)]);
      }
      mark(pts,i%3?'dim':'accent',.35+strong*.29);
    }
  }
  return shapes;
}
