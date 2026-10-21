'use strict';
const $=s=>document.querySelector(s),R=20037508.342789244,WORLD=2*R;
const wm=(l,f,m)=>`https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${l}&STYLE=normal&FORMAT=${f}&TILEMATRIXSET=${m}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`;
const ORTHO=wm('ORTHOIMAGERY.ORTHOPHOTOS','image/jpeg','PM_0_19');
const BASES={ortho:ORTHO,plan:wm('GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2','image/png','PM'),osm:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'};
const ATTR={ortho:'© IGN',plan:'© IGN',osm:'© OpenStreetMap'};
const MNT='IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93';
const P=ll=>L.CRS.EPSG3857.project(L.latLng(ll)),U=(x,y)=>L.CRS.EPSG3857.unproject(L.point(x,y));
const map=L.map('map',{minZoom:5,maxZoom:19}).setView([49.75,0.4],11);
map.createPane('mask').style.zIndex=395;
let base,zone=null,zl=[],dem=null,hsOv=null,hsUrl=null,geo=[],act=-1,draw=null,rq=0;
const hsC=document.createElement('canvas');
const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,5000)};
const setBase=k=>{base&&map.removeLayer(base);base=L.tileLayer(BASES[k],{maxZoom:19,attribution:ATTR[k]}).addTo(map);base.bringToBack()};
setBase('plan');
const SL=(id,l,a,b,s,v,u='')=>`<label>${l} <output id="${id}o">${v}${u}</output><input type="range" id="${id}" min="${a}" max="${b}" step="${s}" value="${v}" data-u="${u}"></label>`;
$('#s2b').innerHTML=SL('hso','Opacité',0,100,1,70,' %')+SL('hsc','Contraste',0.2,3,0.05,1)+SL('hsb','Luminosité',-100,100,1,0)+SL('az','Azimut du soleil',0,360,1,315,'°')+SL('ex','Exagération verticale',1,20,0.5,3,'×')+SL('zmin','Zoom min',13,19,1,13)+SL('zmax','Zoom max',13,19,1,19);
$('#s3b').innerHTML=SL('gw','Épaisseur',1,12,1,3,' px')+SL('gfo','Opacité du remplissage',0,100,5,25,' %');
$('#synth').innerHTML=SL('oo','Opacité BD Ortho',0,100,5,100,' %')+SL('oh','Opacité MNT ombré',0,100,5,50,' %')+SL('og','Opacité géologie',0,100,5,100,' %');
document.addEventListener('input',e=>{const t=e.target;if(t.type==='range'){const o=$('#'+t.id+'o');if(o)o.textContent=t.value+(t.dataset.u||'')}});

/* ---------- dessin générique (clic = sommet) ---------- */
function startDraw(mode,style,upd,done){cancel();draw={pts:[],mode,upd,done,tmp:(mode==='poly'?L.polygon:L.polyline)([],{...style,interactive:false}).addTo(map)};map.getContainer().style.cursor='crosshair'}
function cancel(){if(draw){map.removeLayer(draw.tmp);draw=null;map.getContainer().style.cursor=''}}
function finish(){if(!draw)return toast('Aucun dessin en cours');if(draw.pts.length<(draw.mode==='poly'?3:2))return toast('Pas assez de points');const d=draw;cancel();d.done(d.pts)}
map.on('click',e=>{if(!draw)return;draw.pts.push(e.latlng);draw.tmp.setLatLngs(draw.pts);draw.upd&&draw.upd(draw.pts)});
const diam=a=>{let m=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)m=Math.max(m,map.distance(a[i],a[j]));return m};

/* ---------- 1. zone ---------- */
$('#base').onchange=e=>setBase(e.target.value);
$('#zdraw').onclick=()=>{resetZone();startDraw('poly',{color:'#ffd400',weight:2,dashArray:'6 4',fillOpacity:.1},p=>$('#zinfo').textContent=`Longueur : ${Math.round(diam(p))} m / 1500 m`,setZone)};
$('#zend').onclick=finish;
$('#zclr').onclick=()=>{cancel();resetZone();$('#zinfo').textContent='Zone effacée.'};
function resetZone(){zl.forEach(l=>map.removeLayer(l));zl=[];hsOv&&map.removeLayer(hsOv);hsOv=null;dem=null;zone=null;
 ['s2','s3','s4'].forEach(i=>$('#'+i).classList.add('lock'));$('#base').disabled=false;map.setMaxBounds(null);map.setMinZoom(5);map.setMaxZoom(19)}
function setZone(pts){
 const d=diam(pts);if(d>1500)return toast(`Secteur trop long : ${Math.round(d)} m (max 1500 m)`);
 zone=pts;$('#zinfo').textContent=`Secteur validé : ${Math.round(d)} m`;
 zl=[L.polygon(pts,{color:'#ffd400',weight:2,fill:false,interactive:false}),
  L.polygon([[[-85,-180],[-85,180],[85,180],[85,-180]],pts],{stroke:false,fillColor:'#0c1218',fillOpacity:.92,interactive:false,pane:'mask'})].map(l=>l.addTo(map));
 $('#base').value='ortho';setBase('ortho');$('#base').disabled=true;
 ['s2','s3','s4'].forEach(i=>$('#'+i).classList.remove('lock'));
 map.fitBounds(L.latLngBounds(pts));map.setMaxBounds(L.latLngBounds(pts).pad(.6));applyZoom();loadDEM();
}
function applyZoom(){const a=+$('#zmin').value,b=+$('#zmax').value;map.setMinZoom(a);map.setMaxZoom(b)}
['zmin','zmax'].forEach(id=>$('#'+id).oninput=()=>{const a=$('#zmin'),b=$('#zmax');if(+a.value>+b.value){(id==='zmin'?b:a).value=$('#'+id).value;(id==='zmin'?b:a).dispatchEvent(new Event('input',{bubbles:true}))}applyZoom()});

/* ---------- 2. MNT LiDAR HD + ombrage ---------- */
async function loadDEM(){
 const st=$('#st');st.textContent='Téléchargement du MNT LiDAR HD…';
 try{
  const pm=zone.map(P),xs=pm.map(q=>q.x),ys=pm.map(q=>q.y),x0=Math.min(...xs),y1=Math.max(...ys),w=Math.max(...xs)-x0,h=y1-Math.min(...ys);
  const p=Math.max(0.78,Math.max(w,h)/3000),W=Math.ceil(w/p),H=Math.ceil(h/p),z=new Float32Array(W*H).fill(NaN),T=1000;
  for(let r=0;r<H;r+=T)for(let c=0;c<W;c+=T){
   const tw=Math.min(T,W-c),th=Math.min(T,H-r),bx=x0+c*p,by=y1-r*p;
   const u=`https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${MNT}&STYLES=&FORMAT=image/geotiff&CRS=EPSG:3857&BBOX=${bx},${by-th*p},${bx+tw*p},${by}&WIDTH=${tw}&HEIGHT=${th}`;
   const rs=await fetch(u);if(!rs.ok)throw new Error('HTTP '+rs.status);
   const img=await(await GeoTIFF.fromArrayBuffer(await rs.arrayBuffer())).getImage(),a=(await img.readRasters())[0],iw=img.getWidth();
   for(let j=0;j<th;j++)for(let i=0;i<tw;i++){const v=a[j*iw+i];z[(r+j)*W+c+i]=v>-500&&v<5000?v:NaN}
   st.textContent=`MNT : ${Math.min(100,Math.round(((r/T)*Math.ceil(W/T)+c/T+1)/(Math.ceil(H/T)*Math.ceil(W/T))*100))} %`;
  }
  if(!z.some(v=>v===v))throw new Error('aucune donnée LiDAR HD sur ce secteur');
  const mc=document.createElement('canvas');mc.width=W;mc.height=H;const cx=mc.getContext('2d');cx.beginPath();
  pm.forEach((q,i)=>cx[i?'lineTo':'moveTo']((q.x-x0)/p,(y1-q.y)/p));cx.fill();
  const md=cx.getImageData(0,0,W,H).data,mask=new Uint8Array(W*H);for(let k=0;k<W*H;k++)mask[k]=md[4*k+3]>0;
  dem={W,H,z,mask,p,x0,y1,cell:p*Math.cos(zone[0].lat*Math.PI/180)};
  st.textContent=`MNT chargé (${W}×${H} px, ~${(dem.cell).toFixed(2)} m/px)`;render();
 }catch(e){st.textContent='Échec MNT : '+e.message;toast('Échec du téléchargement du MNT : '+e.message)}
}
function render(){
 if(!dem)return;const{W,H,z,mask,cell}=dem,ex=+$('#ex').value,am=((450-+$('#az').value)%360)*Math.PI/180,ct=+$('#hsc').value,br=+$('#hsb').value,S=Math.SQRT1_2;
 const q=(r,s,c)=>{const v=z[r*W+s];return v===v?v:c},id=new ImageData(W,H),o=id.data;
 for(let j=0;j<H;j++){const jn=j?j-1:0,js=j<H-1?j+1:j;
  for(let i=0;i<W;i++){const k=j*W+i,c=z[k];if(!mask[k]||c!==c)continue;
   const iw=i?i-1:0,ie=i<W-1?i+1:i,a=q(jn,iw,c),b=q(jn,i,c),cc=q(jn,ie,c),d=q(j,iw,c),f=q(j,ie,c),g=q(js,iw,c),h=q(js,i,c),n=q(js,ie,c);
   const dx=((cc+2*f+n)-(a+2*d+g))/(8*cell)*ex,dy=((g+2*h+n)-(a+2*b+cc))/(8*cell)*ex,sl=Math.atan(Math.hypot(dx,dy));
   let hs=S*Math.cos(sl)+S*Math.sin(sl)*Math.cos(am-Math.atan2(dy,-dx));hs=Math.max(0,hs);
   const v=Math.max(0,Math.min(255,(hs*255-128)*ct+128+br));o[4*k]=o[4*k+1]=o[4*k+2]=v;o[4*k+3]=255}}
 hsC.width=W;hsC.height=H;hsC.getContext('2d').putImageData(id,0,0);
 hsC.toBlob(b=>{const u=URL.createObjectURL(b),op=+$('#hso').value/100;
  if(hsOv)hsOv.setUrl(u);else hsOv=L.imageOverlay(u,L.latLngBounds(U(dem.x0,dem.y1-H*dem.p),U(dem.x0+W*dem.p,dem.y1)),{opacity:op,interactive:false}).addTo(map);
  hsUrl&&URL.revokeObjectURL(hsUrl);hsUrl=u});
}
const rr=()=>{cancelAnimationFrame(rq);rq=requestAnimationFrame(render)};
['hsc','hsb','az','ex'].forEach(id=>$('#'+id).oninput=rr);
$('#hso').oninput=e=>hsOv&&hsOv.setOpacity(e.target.value/100);

/* ---------- 3. interprétation géologique ---------- */
function glist(){$('#glist').innerHTML=geo.map((l,i)=>`<div class="g${i===act?' on':''}" data-i="${i}"><input type="checkbox" ${l.vis?'checked':''} data-v="${i}"><i style="background:${l.col}"></i><span data-a="${i}">${l.name}</span><button data-d="${i}">×</button></div>`).join('')}
$('#gadd').onclick=()=>{const n=$('#gname').value.trim();if(!n)return toast('Donnez un nom à la couche');geo.push({name:n,col:$('#gcol').value,vis:true,g:L.featureGroup().addTo(map)});act=geo.length-1;$('#gname').value='';glist()};
$('#glist').onclick=e=>{const t=e.target.dataset;
 if(t.a!==undefined){act=+t.a;glist()}
 if(t.d!==undefined){const l=geo[+t.d];map.removeLayer(l.g);geo.splice(+t.d,1);act=geo.length-1;glist()}};
$('#glist').onchange=e=>{const i=e.target.dataset.v;if(i===undefined)return;const l=geo[+i];l.vis=e.target.checked;l.vis?map.addLayer(l.g):map.removeLayer(l.g)};
$('#gdraw').onclick=()=>{if(act<0)return toast('Créez d\'abord une couche');const poly=$('#gmode').value==='poly',L0=geo[act],
 st={color:$('#gcol').value,weight:+$('#gw').value,fill:poly,fillOpacity:poly?+$('#gfo').value/100:0};
 startDraw(poly?'poly':'line',st,null,pts=>{(poly?L.polygon:L.polyline)(pts,{...st,interactive:false}).addTo(L0.g)})};
$('#gend').onclick=finish;
$('#gclr').onclick=()=>{if(draw)return cancel();const g=act>=0&&geo[act].g,ls=g&&g.getLayers();if(ls&&ls.length)g.removeLayer(ls[ls.length-1])};

/* ---------- 4. export MBTiles / GeoPackage ---------- */
$('#s4').addEventListener('change',()=>{$('#synth').hidden=document.querySelector('[name=view]:checked').value!=='synth'});
const loadImg=u=>new Promise(r=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>r(i);i.onerror=()=>r(null);i.src=u});
$('#exp').onclick=async()=>{
 if(!zone||!dem)return toast('Validez d\'abord un secteur (MNT chargé)');
 const view=document.querySelector('[name=view]:checked').value,gp=$('#efmt').value==='gpkg',z0=+$('#zmin').value,z1=+$('#zmax').value;
 const w={ortho:[1,0,0],mnt:[0,1,0],geo:[0,0,1],synth:[$('#oo').value/100,$('#oh').value/100,$('#og').value/100]}[view];
 const png=view==='geo'||$('#png').checked,mime=png?'image/png':'image/jpeg',pb=$('#prog');pb.hidden=false;pb.value=0;$('#exp').disabled=true;
 try{
  const SQL=await initSqlJs({locateFile:f=>'vendor/'+f}),db=new SQL.Database(),pm=zone.map(P),xs=pm.map(q=>q.x),ys=pm.map(q=>q.y);
  const bx0=Math.min(...xs),bx1=Math.max(...xs),by0=Math.min(...ys),by1=Math.max(...ys),ll=L.latLngBounds(zone),nm=`platier ${view}`;
  if(gp){db.exec(`PRAGMA application_id=1196444487;PRAGMA user_version=10300;
CREATE TABLE gpkg_spatial_ref_sys(srs_name TEXT NOT NULL,srs_id INTEGER PRIMARY KEY,organization TEXT NOT NULL,organization_coordsys_id INTEGER NOT NULL,definition TEXT NOT NULL,description TEXT);
INSERT INTO gpkg_spatial_ref_sys VALUES('Undefined Cartesian SRS',-1,'NONE',-1,'undefined',NULL),('Undefined geographic SRS',0,'NONE',0,'undefined',NULL),('WGS 84 / Pseudo-Mercator',3857,'EPSG',3857,'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]',NULL);
CREATE TABLE gpkg_contents(table_name TEXT NOT NULL PRIMARY KEY,data_type TEXT NOT NULL,identifier TEXT UNIQUE,description TEXT DEFAULT '',last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),min_x DOUBLE,min_y DOUBLE,max_x DOUBLE,max_y DOUBLE,srs_id INTEGER);
CREATE TABLE gpkg_tile_matrix_set(table_name TEXT NOT NULL PRIMARY KEY,srs_id INTEGER NOT NULL,min_x DOUBLE NOT NULL,min_y DOUBLE NOT NULL,max_x DOUBLE NOT NULL,max_y DOUBLE NOT NULL);
CREATE TABLE gpkg_tile_matrix(table_name TEXT NOT NULL,zoom_level INTEGER NOT NULL,matrix_width INTEGER NOT NULL,matrix_height INTEGER NOT NULL,tile_width INTEGER NOT NULL,tile_height INTEGER NOT NULL,pixel_x_size DOUBLE NOT NULL,pixel_y_size DOUBLE NOT NULL,PRIMARY KEY(table_name,zoom_level));
CREATE TABLE platier(id INTEGER PRIMARY KEY AUTOINCREMENT,zoom_level INTEGER NOT NULL,tile_column INTEGER NOT NULL,tile_row INTEGER NOT NULL,tile_data BLOB NOT NULL,UNIQUE(zoom_level,tile_column,tile_row));`);
   db.run(`INSERT INTO gpkg_contents(table_name,data_type,identifier,description,min_x,min_y,max_x,max_y,srs_id) VALUES('platier','tiles',?,'Export platier',?,?,?,?,3857)`,[nm,bx0,by0,bx1,by1]);
   db.run(`INSERT INTO gpkg_tile_matrix_set VALUES('platier',3857,?,?,?,?)`,[-R,-R,R,R]);
   for(let z=z0;z<=z1;z++){const s=WORLD/2**z/256;db.run(`INSERT INTO gpkg_tile_matrix VALUES('platier',?,?,?,256,256,?,?)`,[z,2**z,2**z,s,s])}
  }else{db.exec(`CREATE TABLE metadata(name TEXT,value TEXT);CREATE TABLE tiles(zoom_level INTEGER,tile_column INTEGER,tile_row INTEGER,tile_data BLOB,PRIMARY KEY(zoom_level,tile_column,tile_row));`);
   [['name',nm],['format',png?'png':'jpg'],['bounds',[ll.getWest(),ll.getSouth(),ll.getEast(),ll.getNorth()].join(',')],['center',`${ll.getCenter().lng},${ll.getCenter().lat},${z0}`],['minzoom',z0],['maxzoom',z1],['type','baselayer'],['version','1.0'],['description','Export platier']].forEach(m=>db.run('INSERT INTO metadata VALUES(?,?)',m))}
  const ins=db.prepare(gp?'INSERT INTO platier(zoom_level,tile_column,tile_row,tile_data) VALUES(?,?,?,?)':'INSERT INTO tiles VALUES(?,?,?,?)');
  const gs=geo.filter(l=>l.vis).flatMap(l=>l.g.getLayers()),list=[];
  for(let z=z0;z<=z1;z++){const s=WORLD/2**z;for(let x=Math.floor((bx0+R)/s);x<=Math.floor((bx1+R)/s);x++)for(let y=Math.floor((R-by1)/s);y<=Math.floor((R-by0)/s);y++)list.push([z,x,y])}
  let k=0,n=0;
  const mk=async(z,x,y)=>{
   const s=WORLD/2**z,tx0=-R+x*s,ty1=R-y*s,f=256/s,cv=document.createElement('canvas');cv.width=cv.height=256;const cx=cv.getContext('2d');
   if(!png){cx.fillStyle='#000';cx.fillRect(0,0,256,256)}
   cx.beginPath();pm.forEach((q,i)=>cx[i?'lineTo':'moveTo']((q.x-tx0)*f,(ty1-q.y)*f));cx.clip();
   if(w[0]){const im=await loadImg(ORTHO.replace('{z}',z).replace('{x}',x).replace('{y}',y));if(im){cx.globalAlpha=w[0];cx.drawImage(im,0,0,256,256)}}
   if(w[1]){cx.globalAlpha=w[1];cx.imageSmoothingEnabled=true;cx.drawImage(hsC,(tx0-dem.x0)/dem.p,(dem.y1-ty1)/dem.p,s/dem.p,s/dem.p,0,0,256,256)}
   if(w[2])gs.forEach(l=>{const poly=l instanceof L.Polygon,r=(poly?l.getLatLngs()[0]:l.getLatLngs()).map(c=>{const m=P(c);return[(m.x-tx0)*f,(ty1-m.y)*f]});
    cx.beginPath();r.forEach((c,i)=>cx[i?'lineTo':'moveTo'](c[0],c[1]));
    if(poly){cx.closePath();cx.globalAlpha=w[2]*l.options.fillOpacity;cx.fillStyle=l.options.color;cx.fill()}
    cx.globalAlpha=w[2];cx.strokeStyle=l.options.color;cx.lineWidth=l.options.weight;cx.lineJoin='round';cx.stroke()});
   return new Uint8Array(await(await new Promise(r=>cv.toBlob(r,mime,.88))).arrayBuffer())};
  await Promise.all(Array.from({length:6},async()=>{while(k<list.length){const[z,x,y]=list[k++],d=await mk(z,x,y);ins.run([z,x,gp?y:(1<<z)-1-y,d]);pb.value=++n/list.length}}));
  ins.free();const data=db.export();db.close();
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/octet-stream'}));a.download=`platier_${view}_z${z0}-${z1}.${gp?'gpkg':'mbtiles'}`;a.click();
  toast(`Export terminé : ${list.length} tuiles`);
 }catch(e){toast('Échec de l\'export : '+e.message)}
 pb.hidden=true;$('#exp').disabled=false;
};
