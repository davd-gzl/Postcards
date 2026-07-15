// Render a PUBLISHED journey to ONE self-contained HTML document — the "book"
// a visitor discovers (Polarsteps-style): a cover, a route map, and one
// photo-led page per step, paged left→right.
//
// Constitution guarantees baked into this output:
//   • INERT — all story text and captions are placed with textContent (never
//     innerHTML), and the embedded JSON escapes "<" so it can never break the
//     <script> boundary. A shared page can't form raw HTML, a script, or a
//     tracking pixel.
//   • PRIVATE / OFFLINE — everything (CSS, JS, data, photos) is inlined. There
//     is NO external URL of any kind: no CDN, no web font, no map tile, no
//     analytics. Photos are already inline data: URLs and are embedded as-is.
//     The reader makes ZERO network requests and leaks nothing.
//   • ZERO-KNOWLEDGE PASSPHRASE — when `opts.encrypted` is given instead of a
//     plain journey, only the AES-GCM envelope ships. A tiny inline decrypt
//     routine (same PBKDF2-SHA256 + AES-GCM scheme as encrypt.ts) unlocks it in
//     the visitor's browser; the passphrase is never written to the file.
//
// This module is PURE: `renderReaderHtml(journey, opts?)` returns a string and
// touches no I/O, no DOM, no globals — it is unit-tested for self-containment.

import type { PublishedJourney } from "./bundle";
import type { EncryptedEnvelope } from "./encrypt";

export interface RenderReaderOptions {
  /** When set, the reader ships this envelope instead of a plain journey and
   *  gates on a passphrase. Pass `journey: null` in this mode — the plaintext
   *  must NOT be in the file. */
  encrypted?: EncryptedEnvelope;
  /** Attribution line for the map/reference data (kept visible per dataset
   *  licenses). Defaults to the app's Natural Earth / OpenStreetMap / GeoNames
   *  credit. Plain text only — never a link (offline, zero external requests). */
  attribution?: string;
}

/** Default credit for the reference data behind the coordinates and outline. */
const DEFAULT_ATTRIBUTION =
  "Coordinates from GeoNames (CC BY 4.0). Outline data © Natural Earth / OpenStreetMap contributors.";

/** HTML-escape text destined for markup (title tag, static labels, footer). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Serialize a value as JSON safe to drop inside a <script type="application/json">
 * block: escape "<", ">", "&" and the U+2028/U+2029 line separators to their
 * \uXXXX forms. JSON.parse decodes them back, so the data is unchanged — but the
 * text can never close the script element or smuggle markup (inert by design).
 */
function jsonForScript(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // U+2028 / U+2029 are legal in JSON strings but terminate an inline script.
    .replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

// ---------------------------------------------------------------------------
// Inline styles — theme-aware (light + dark via prefers-color-scheme, with an
// explicit toggle), accessible focus rings, reduced-motion honoured. No web
// fonts (system stack), no external asset of any kind.
// ---------------------------------------------------------------------------
const READER_CSS = `
:root{
  --pc-bg:#f4f2ee; --pc-surface:#ffffff; --pc-elev:#faf8f4;
  --pc-text:#1a1b1e; --pc-muted:#585a61; --pc-border:#e3ded4;
  --pc-accent:#4338ca; --pc-accent-ink:#ffffff; --pc-ocean:#e8ecf5;
  color-scheme:light;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --pc-bg:#121317; --pc-surface:#1c1e24; --pc-elev:#232631;
    --pc-text:#eceef3; --pc-muted:#a6aab4; --pc-border:#2e313a;
    --pc-accent:#a5b4fc; --pc-accent-ink:#17181c; --pc-ocean:#1a2030;
    color-scheme:dark;
  }
}
:root[data-theme="dark"]{
  --pc-bg:#121317; --pc-surface:#1c1e24; --pc-elev:#232631;
  --pc-text:#eceef3; --pc-muted:#a6aab4; --pc-border:#2e313a;
  --pc-accent:#a5b4fc; --pc-accent-ink:#17181c; --pc-ocean:#1a2030;
  color-scheme:dark;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{
  background:var(--pc-bg); color:var(--pc-text);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  line-height:1.55; -webkit-text-size-adjust:100%;
}
.pc-shell{min-height:100%; display:flex; flex-direction:column}
.pc-app{flex:1; width:100%; max-width:760px; margin:0 auto; padding:0 16px 96px; position:relative}
.pc-loading{color:var(--pc-muted); text-align:center; padding:56px 0}
.pc-noscript{max-width:520px; margin:56px auto; padding:18px 20px; border:1px solid var(--pc-border);
  background:var(--pc-surface); border-radius:14px; text-align:center}
:focus-visible{outline:3px solid var(--pc-accent); outline-offset:2px; border-radius:6px}

/* Header: progress + counter + theme toggle */
.pc-head{position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:12px;
  padding:12px 16px; background:color-mix(in srgb, var(--pc-bg) 88%, transparent);
  backdrop-filter:saturate(1.2) blur(6px); border-bottom:1px solid var(--pc-border)}
.pc-progress{flex:1; height:6px; background:var(--pc-border); border-radius:99px; overflow:hidden}
.pc-progress-bar{height:100%; width:0; background:var(--pc-accent); transition:width .25s ease}
.pc-counter{font-size:13px; color:var(--pc-muted); font-variant-numeric:tabular-nums; white-space:nowrap}
.pc-theme{border:1px solid var(--pc-border); background:var(--pc-surface); color:var(--pc-text);
  border-radius:99px; width:34px; height:34px; font-size:16px; cursor:pointer; line-height:1}
.pc-theme:hover{background:var(--pc-elev)}

/* Spreads */
.pc-spread{padding:28px 4px 8px; animation:pc-in .28s ease both}
.pc-spread[hidden]{display:none}
@keyframes pc-in{from{opacity:0; transform:translateX(14px)} to{opacity:1; transform:none}}

/* Cover */
.pc-cover{text-align:center; padding-top:40px}
.pc-cover-kicker{letter-spacing:.14em; text-transform:uppercase; font-size:12px; color:var(--pc-muted); margin:0 0 10px}
.pc-cover h1{font-size:clamp(28px,7vw,44px); line-height:1.1; margin:0 0 8px; font-weight:800}
.pc-cover-sub{font-size:18px; color:var(--pc-muted); margin:0 0 6px}
.pc-cover-dates{font-size:15px; color:var(--pc-muted); margin:0 0 26px}
.pc-totals{display:flex; justify-content:center; flex-wrap:wrap; gap:14px}
.pc-total{background:var(--pc-surface); border:1px solid var(--pc-border); border-radius:14px;
  padding:14px 20px; min-width:104px; box-shadow:0 1px 2px rgba(0,0,0,.04)}
.pc-total-n{font-size:26px; font-weight:800; font-variant-numeric:tabular-nums}
.pc-total-l{font-size:12px; color:var(--pc-muted); text-transform:uppercase; letter-spacing:.06em}
.pc-cover-hint{margin-top:30px; color:var(--pc-muted); font-size:14px}

/* Map */
.pc-mapwrap h2, .pc-step h2{font-size:22px; margin:0 0 12px}
.pc-map{background:var(--pc-ocean); border:1px solid var(--pc-border); border-radius:16px; overflow:hidden}
.pc-map-svg{display:block; width:100%; height:auto}
.pc-map-bg{fill:var(--pc-ocean)}
.pc-grat line{stroke:var(--pc-border); stroke-width:.6}
.pc-legs line{stroke-width:2.2; stroke-linecap:round; fill:none}
.pc-pt{fill:var(--pc-accent); stroke:var(--pc-surface); stroke-width:1.4}
.pc-legend{display:flex; flex-wrap:wrap; gap:10px 16px; margin:14px 2px 0; font-size:13px; color:var(--pc-muted)}
.pc-legend span{display:inline-flex; align-items:center; gap:6px}
.pc-swatch{width:16px; height:3px; border-radius:2px; display:inline-block}
.pc-attrib{margin:14px 2px 0; font-size:12px; color:var(--pc-muted)}

/* Step page */
.pc-hero{position:relative; width:100%; aspect-ratio:3/2; border-radius:16px; overflow:hidden;
  background:var(--pc-elev); border:1px solid var(--pc-border)}
.pc-hero img{width:100%; height:100%; object-fit:cover; display:block}
.pc-hero-empty{display:flex; align-items:center; justify-content:center; height:100%;
  background:linear-gradient(135deg,var(--pc-elev),var(--pc-surface)); flex-direction:column; gap:8px}
.pc-hero-empty .pc-flag{font-size:52px}
.pc-hero-empty .pc-place{color:var(--pc-muted); font-size:15px}
.pc-badge{position:absolute; top:12px; left:12px; background:var(--pc-accent); color:var(--pc-accent-ink);
  border-radius:99px; padding:6px 12px; font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px}
.pc-step-meta{display:flex; align-items:baseline; flex-wrap:wrap; gap:6px 12px; margin:16px 0 4px}
.pc-step h2{margin:0}
.pc-step-date{color:var(--pc-muted); font-size:15px}
.pc-story-title{font-size:17px; margin:16px 0 6px}
.pc-story-text{white-space:pre-wrap; margin:0; font-size:16px}
.pc-gallery{display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:8px; margin-top:18px}
.pc-thumb{padding:0; border:1px solid var(--pc-border); border-radius:10px; overflow:hidden; cursor:pointer;
  background:var(--pc-elev); aspect-ratio:1; display:block}
.pc-thumb img{width:100%; height:100%; object-fit:cover; display:block}

/* Nav */
.pc-nav{position:fixed; left:0; right:0; bottom:0; display:flex; justify-content:center; gap:12px;
  padding:12px 16px calc(12px + env(safe-area-inset-bottom)); background:color-mix(in srgb, var(--pc-bg) 88%, transparent);
  backdrop-filter:blur(6px); border-top:1px solid var(--pc-border)}
.pc-btn{border:1px solid var(--pc-border); background:var(--pc-surface); color:var(--pc-text);
  border-radius:99px; padding:10px 20px; font-size:15px; font-weight:600; cursor:pointer; min-width:120px}
.pc-btn:hover:not(:disabled){background:var(--pc-elev)}
.pc-btn:disabled{opacity:.4; cursor:default}
.pc-btn-primary{background:var(--pc-accent); color:var(--pc-accent-ink); border-color:transparent}

/* Passphrase gate */
.pc-gate{max-width:420px; margin:64px auto 0; text-align:center}
.pc-gate-title{font-size:24px; margin:0 0 8px}
.pc-gate-note{color:var(--pc-muted); margin:0 0 22px}
.pc-gate-label{display:block; text-align:left; font-size:13px; color:var(--pc-muted); margin-bottom:16px}
.pc-gate-input{width:100%; margin-top:6px; padding:12px 14px; font-size:16px; border-radius:12px;
  border:1px solid var(--pc-border); background:var(--pc-surface); color:var(--pc-text)}
.pc-gate-msg{color:var(--pc-accent); min-height:22px; margin:16px 0 0; font-weight:600}

/* Footer */
.pc-foot{max-width:760px; margin:0 auto; padding:20px 16px 84px; color:var(--pc-muted);
  font-size:13px; text-align:center; border-top:1px solid var(--pc-border)}

/* Lightbox */
.pc-lightbox{position:fixed; inset:0; z-index:50; background:rgba(0,0,0,.86); display:flex;
  flex-direction:column; align-items:center; justify-content:center; padding:20px}
.pc-lb-img{max-width:100%; max-height:78vh; object-fit:contain; border-radius:8px}
.pc-lb-cap{color:#f0f0f0; margin-top:12px; font-size:14px; text-align:center; max-width:640px}
.pc-lb-nav{position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,.14);
  color:#fff; border:0; font-size:30px; width:52px; height:52px; border-radius:99px; cursor:pointer}
.pc-lb-prev{left:16px} .pc-lb-next{right:16px}
.pc-lb-close{position:absolute; top:16px; right:16px; background:rgba(255,255,255,.14); color:#fff;
  border:0; font-size:16px; padding:8px 14px; border-radius:99px; cursor:pointer}
.pc-lb-count{position:absolute; top:20px; left:16px; color:#ddd; font-size:13px; font-variant-numeric:tabular-nums}
.pc-sr{position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); border:0}

@media (prefers-reduced-motion:reduce){
  *{animation-duration:.001ms !important; animation-iteration-count:1 !important; transition-duration:.001ms !important}
  .pc-spread{animation:none}
}
`;

// ---------------------------------------------------------------------------
// Inline reader runtime. Written in plain ES5-ish JS with NO backslashes, NO
// backticks and NO "${" so it survives being embedded verbatim in the document
// (and the source template literal below). Emojis are literal characters.
// ---------------------------------------------------------------------------
const READER_JS = `
(function(){
  "use strict";
  var MODE_GLYPH={flight:"✈️",train:"🚆",bus:"🚌",ferry:"⛴️",car:"🚗",other:"•"};
  var MODE_LABEL={flight:"Flight",train:"Train",bus:"Bus",ferry:"Ferry",car:"Car",other:"Travel"};
  var MODE_COLOR={flight:"#4338ca",train:"#15803d",bus:"#b45309",ferry:"#0369a1",car:"#be185d",other:"#6b7280"};

  function el(tag,props,kids){
    var e=document.createElement(tag);
    if(props){for(var k in props){var v=props[k];
      if(v==null) continue;
      if(k==="className") e.className=v;
      else if(k==="textContent") e.textContent=v;
      else if(k==="html") e.innerHTML=v;
      else if(k in e){try{e[k]=v;}catch(_e){e.setAttribute(k,String(v));}}
      else e.setAttribute(k,String(v));
    }}
    if(kids){for(var i=0;i<kids.length;i++){var c=kids[i]; if(c==null) continue;
      e.appendChild(typeof c==="string"?document.createTextNode(c):c);}}
    return e;
  }
  function fmtInt(n){try{return new Intl.NumberFormat().format(Math.round(n));}catch(_e){return String(Math.round(n));}}
  function fmtDate(iso){
    if(!iso) return "";
    var d=new Date(iso+"T00:00:00");
    if(isNaN(d.getTime())) return iso;
    try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(d);}catch(_e){return iso;}
  }
  function flag(cc){
    if(!cc||cc==="ZZ") return "📍";
    var up=cc.toUpperCase(), out="";
    for(var i=0;i<up.length;i++){var ch=up.charCodeAt(i); if(ch<65||ch>90) return "📍"; out+=String.fromCodePoint(127397+ch);}
    return out;
  }

  // --- decrypt (mirrors encrypt.ts: PBKDF2-SHA256 -> AES-GCM) ---
  function b64(s){var bin=atob(s); var out=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i); return out;}
  function deriveKey(pass,salt,iter){
    var enc=new TextEncoder().encode(pass);
    return crypto.subtle.importKey("raw",enc,"PBKDF2",false,["deriveKey"]).then(function(base){
      return crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:iter,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["decrypt"]);
    });
  }
  function decrypt(env,pass){
    var iv=b64(env.iv), ct=b64(env.ct), salt=b64(env.salt);
    return deriveKey(pass,salt,env.iter||250000).then(function(key){
      return crypto.subtle.decrypt({name:"AES-GCM",iv:iv},key,ct);
    }).then(function(buf){ return JSON.parse(new TextDecoder().decode(buf)); });
  }

  // --- route map (inline SVG, trusted markup, no user text) ---
  function mapSvg(steps){
    var W=720,H=360,s="";
    s+='<svg class="pc-map-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Route map of the journey">';
    s+='<rect class="pc-map-bg" x="0" y="0" width="'+W+'" height="'+H+'"/>';
    var g="",lon,lat;
    for(lon=-180;lon<=180;lon+=30){var x=(lon+180)/360*W; g+='<line x1="'+x.toFixed(1)+'" y1="0" x2="'+x.toFixed(1)+'" y2="'+H+'"/>';}
    for(lat=-90;lat<=90;lat+=30){var y=(90-lat)/180*H; g+='<line x1="0" y1="'+y.toFixed(1)+'" x2="'+W+'" y2="'+y.toFixed(1)+'"/>';}
    s+='<g class="pc-grat">'+g+'</g>';
    function px(st){return {x:(st.lon+180)/360*W, y:(90-st.lat)/180*H};}
    var seg="";
    for(var i=1;i<steps.length;i++){
      if(!steps[i].arriveBy) continue;
      if(Math.abs(steps[i].lon-steps[i-1].lon)>180) continue;
      var a=px(steps[i-1]),b=px(steps[i]);
      var col=MODE_COLOR[steps[i].arriveBy]||MODE_COLOR.other;
      seg+='<line x1="'+a.x.toFixed(1)+'" y1="'+a.y.toFixed(1)+'" x2="'+b.x.toFixed(1)+'" y2="'+b.y.toFixed(1)+'" stroke="'+col+'"/>';
    }
    s+='<g class="pc-legs">'+seg+'</g>';
    var pts="";
    for(var j=0;j<steps.length;j++){var p=px(steps[j]); pts+='<circle class="pc-pt" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4"/>';}
    s+='<g class="pc-pts">'+pts+'</g></svg>';
    return s;
  }

  function reduced(){try{return window.matchMedia("(prefers-reduced-motion:reduce)").matches;}catch(_e){return false;}}

  var state={spreads:[],idx:0,journey:null};

  function buildCover(j){
    var sec=el("section",{className:"pc-spread pc-cover","aria-label":"Cover",tabIndex:-1});
    sec.appendChild(el("p",{className:"pc-cover-kicker",textContent:"A Postcards journey"}));
    sec.appendChild(el("h1",{textContent:j.title||"A journey"}));
    if(j.subtitle) sec.appendChild(el("p",{className:"pc-cover-sub",textContent:j.subtitle}));
    var dr=j.dateRange||{};
    if(dr.start){
      var range=dr.end&&dr.end!==dr.start?fmtDate(dr.start)+" – "+fmtDate(dr.end):fmtDate(dr.start);
      sec.appendChild(el("p",{className:"pc-cover-dates",textContent:range}));
    }
    var t=j.totals||{countries:0,places:0,distanceKm:0};
    var totals=el("div",{className:"pc-totals",role:"list"});
    function total(n,l){return el("div",{className:"pc-total",role:"listitem"},[
      el("div",{className:"pc-total-n",textContent:n}), el("div",{className:"pc-total-l",textContent:l})]);}
    totals.appendChild(total(fmtInt(t.countries), t.countries===1?"country":"countries"));
    totals.appendChild(total(fmtInt(t.distanceKm)+" km","travelled"));
    totals.appendChild(total(fmtInt(t.places), t.places===1?"place":"places"));
    sec.appendChild(totals);
    sec.appendChild(el("p",{className:"pc-cover-hint",textContent:"Use the arrow keys, swipe, or the buttons below to read on →"}));
    return sec;
  }

  function buildMap(j){
    var sec=el("section",{className:"pc-spread pc-mapwrap","aria-label":"Journey map",tabIndex:-1});
    sec.appendChild(el("h2",{textContent:"The journey"}));
    sec.appendChild(el("div",{className:"pc-map",html:mapSvg(j.steps)}));
    var used={};
    for(var i=0;i<j.steps.length;i++){var m=j.steps[i].arriveBy; if(m) used[m]=true;}
    var legend=el("div",{className:"pc-legend"});
    var order=["flight","train","bus","ferry","car","other"];
    for(var k=0;k<order.length;k++){ if(!used[order[k]]) continue;
      var sw=el("span",{},[el("i",{className:"pc-swatch"}), MODE_LABEL[order[k]]]);
      sw.firstChild.style.background=MODE_COLOR[order[k]];
      legend.appendChild(sw);
    }
    if(legend.childNodes.length) sec.appendChild(legend);
    sec.appendChild(el("p",{className:"pc-attrib",textContent:document.body.getAttribute("data-attrib")||""}));
    return sec;
  }

  function buildStep(step,n,total){
    var sec=el("section",{className:"pc-spread pc-step","aria-label":"Stop "+n+" of "+total+": "+step.place.name,tabIndex:-1});
    var hero=el("div",{className:"pc-hero"});
    if(step.arriveBy){
      hero.appendChild(el("span",{className:"pc-badge"},[MODE_GLYPH[step.arriveBy]||"•"," ",MODE_LABEL[step.arriveBy]||"Travel"]));
    }
    if(step.photos&&step.photos.length){
      hero.appendChild(el("img",{src:step.photos[0].src,alt:step.photos[0].caption||("Photo of "+step.place.name),loading:"lazy",decoding:"async"}));
    }else{
      hero.appendChild(el("div",{className:"pc-hero-empty"},[
        el("span",{className:"pc-flag","aria-hidden":"true",textContent:flag(step.place.countryId)}),
        el("span",{className:"pc-place",textContent:step.place.name})]));
    }
    sec.appendChild(hero);
    var meta=el("div",{className:"pc-step-meta"});
    meta.appendChild(el("h2",{},[flag(step.place.countryId)+" "+step.place.name]));
    if(step.date) meta.appendChild(el("span",{className:"pc-step-date",textContent:fmtDate(step.date)}));
    sec.appendChild(meta);
    if(step.story){
      if(step.story.title) sec.appendChild(el("h3",{className:"pc-story-title",textContent:step.story.title}));
      if(step.story.text) sec.appendChild(el("p",{className:"pc-story-text",textContent:step.story.text}));
    }
    if(step.photos&&step.photos.length){
      var gal=el("div",{className:"pc-gallery"});
      for(var i=0;i<step.photos.length;i++){ (function(idx){
        var btn=el("button",{type:"button",className:"pc-thumb","aria-label":"View photo "+(idx+1)+" of "+step.photos.length});
        btn.appendChild(el("img",{src:step.photos[idx].src,alt:step.photos[idx].caption||"",loading:"lazy",decoding:"async"}));
        btn.addEventListener("click",function(){openLightbox(step.photos,idx,btn);});
        gal.appendChild(btn);
      })(i); }
      sec.appendChild(gal);
    }
    return sec;
  }

  // --- lightbox (accessible: arrows page, Escape closes, focus returns) ---
  var lb=null;
  function openLightbox(photos,start,trigger){
    closeLightbox();
    var idx=start;
    var box=el("div",{className:"pc-lightbox",role:"dialog","aria-modal":"true","aria-label":"Photo viewer"});
    var count=el("span",{className:"pc-lb-count","aria-hidden":"true"});
    var img=el("img",{className:"pc-lb-img"});
    var cap=el("p",{className:"pc-lb-cap",role:"status"});
    var close=el("button",{className:"pc-lb-close",type:"button",textContent:"Close",title:"Close (Esc)"});
    var prev=el("button",{className:"pc-lb-nav pc-lb-prev",type:"button","aria-label":"Previous photo",textContent:"‹"});
    var next=el("button",{className:"pc-lb-nav pc-lb-next",type:"button","aria-label":"Next photo",textContent:"›"});
    function show(){
      var p=photos[idx];
      img.src=p.src; img.alt=p.caption||"Photo "+(idx+1);
      cap.textContent=p.caption||"";
      count.textContent=(idx+1)+" / "+photos.length;
      prev.style.display=next.style.display=photos.length>1?"":"none";
    }
    function step(d){idx=(idx+d+photos.length)%photos.length; show();}
    prev.addEventListener("click",function(){step(-1);});
    next.addEventListener("click",function(){step(1);});
    close.addEventListener("click",closeLightbox);
    box.addEventListener("click",function(e){if(e.target===box) closeLightbox();});
    box.appendChild(count); box.appendChild(prev); box.appendChild(img); box.appendChild(next); box.appendChild(close); box.appendChild(cap);
    document.body.appendChild(box);
    lb={box:box,trigger:trigger,step:step};
    show(); close.focus();
  }
  function closeLightbox(){
    if(!lb) return;
    var t=lb.trigger; lb.box.remove(); lb=null;
    if(t&&t.focus) t.focus();
  }

  // --- paging ---
  var bar,counter,prevBtn,nextBtn;
  function go(n){
    n=Math.max(0,Math.min(state.spreads.length-1,n));
    for(var i=0;i<state.spreads.length;i++) state.spreads[i].hidden=(i!==n);
    state.idx=n;
    var pct=state.spreads.length>1?(n/(state.spreads.length-1))*100:100;
    bar.style.width=pct+"%";
    bar.parentNode.setAttribute("aria-valuenow",String(n+1));
    counter.textContent=(n+1)+" / "+state.spreads.length;
    prevBtn.disabled=n===0; nextBtn.disabled=n===state.spreads.length-1;
    var cur=state.spreads[n]; if(cur&&cur.focus) cur.focus();
    window.scrollTo(0,0);
  }

  function start(journey){
    state.journey=journey;
    var doc=journey&&journey.title?journey.title:"A journey";
    try{document.title=doc;}catch(_e){}
    var app=document.getElementById("pc-app"); app.innerHTML="";

    var head=el("div",{className:"pc-head"});
    var prog=el("div",{className:"pc-progress",role:"progressbar","aria-label":"Reading progress","aria-valuemin":"1"});
    bar=el("div",{className:"pc-progress-bar"}); prog.appendChild(bar);
    counter=el("span",{className:"pc-counter"});
    var theme=el("button",{className:"pc-theme",type:"button","aria-label":"Toggle light or dark theme",title:"Toggle theme",textContent:"◐"});
    theme.addEventListener("click",function(){
      var r=document.documentElement;
      var dark=r.getAttribute("data-theme")==="dark"||(r.getAttribute("data-theme")!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches);
      r.setAttribute("data-theme",dark?"light":"dark");
    });
    head.appendChild(prog); head.appendChild(counter); head.appendChild(theme);
    app.appendChild(head);

    var stage=el("div",{className:"pc-stage"}); app.appendChild(stage);
    var spreads=[buildCover(journey)];
    if(journey.steps&&journey.steps.length) spreads.push(buildMap(journey));
    for(var i=0;i<(journey.steps||[]).length;i++) spreads.push(buildStep(journey.steps[i],i+1,journey.steps.length));
    state.spreads=spreads;
    for(var k=0;k<spreads.length;k++) stage.appendChild(spreads[k]);
    prog.setAttribute("aria-valuemax",String(spreads.length));

    var nav=el("nav",{className:"pc-nav","aria-label":"Pages"});
    prevBtn=el("button",{className:"pc-btn",type:"button"},["← Back"]);
    nextBtn=el("button",{className:"pc-btn pc-btn-primary",type:"button"},["Next →"]);
    prevBtn.addEventListener("click",function(){go(state.idx-1);});
    nextBtn.addEventListener("click",function(){go(state.idx+1);});
    nav.appendChild(prevBtn); nav.appendChild(nextBtn);
    app.appendChild(nav);

    // Touch swipe
    var sx=0,sy=0;
    stage.addEventListener("touchstart",function(e){var t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY;},{passive:true});
    stage.addEventListener("touchend",function(e){
      var t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
      if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)){ go(state.idx+(dx<0?1:-1)); }
    },{passive:true});

    go(0);
  }

  document.addEventListener("keydown",function(e){
    if(lb){
      if(e.key==="Escape"){closeLightbox(); e.preventDefault();}
      else if(e.key==="ArrowLeft"){lb.step(-1); e.preventDefault();}
      else if(e.key==="ArrowRight"){lb.step(1); e.preventDefault();}
      return;
    }
    var tag=e.target&&e.target.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA") return;
    if(!state.spreads.length) return;
    if(e.key==="ArrowRight"||e.key==="PageDown"){go(state.idx+1); e.preventDefault();}
    else if(e.key==="ArrowLeft"||e.key==="PageUp"){go(state.idx-1); e.preventDefault();}
    else if(e.key==="Home"){go(0); e.preventDefault();}
    else if(e.key==="End"){go(state.spreads.length-1); e.preventDefault();}
  });

  function showGate(env){
    var app=document.getElementById("pc-app"); app.innerHTML="";
    var form=el("form",{className:"pc-gate"});
    form.appendChild(el("h1",{className:"pc-gate-title",textContent:"This journal is locked 🔒"}));
    form.appendChild(el("p",{className:"pc-gate-note",textContent:"Enter the passphrase the author shared with you. It is checked here in your browser — nothing is ever sent to a server."}));
    var input=el("input",{type:"password",className:"pc-gate-input",autocomplete:"off","aria-label":"Passphrase"});
    var label=el("label",{className:"pc-gate-label",textContent:"Passphrase"},[input]);
    var btn=el("button",{className:"pc-btn pc-btn-primary",type:"submit",textContent:"Unlock"});
    var msg=el("p",{className:"pc-gate-msg",role:"alert"});
    form.appendChild(label); form.appendChild(btn); form.appendChild(msg);
    form.addEventListener("submit",function(e){
      e.preventDefault(); msg.textContent=""; btn.disabled=true; btn.textContent="Unlocking…";
      decrypt(env,input.value).then(function(journey){start(journey);}).catch(function(){
        btn.disabled=false; btn.textContent="Unlock"; msg.textContent="Wrong passphrase, or the file is damaged.";
        input.focus(); input.select();
      });
    });
    app.appendChild(form); input.focus();
  }

  function boot(){
    var dataEl=document.getElementById("pc-data");
    var envEl=document.getElementById("pc-env");
    try{
      if(dataEl){ start(JSON.parse(dataEl.textContent)); }
      else if(envEl){ showGate(JSON.parse(envEl.textContent)); }
    }catch(err){
      var app=document.getElementById("pc-app");
      if(app) app.innerHTML="<p class='pc-loading'>This journal could not be opened.</p>";
    }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot); else boot();
})();
`;

/**
 * Render a self-contained reader document for `journey`. When `opts.encrypted`
 * is given, pass `journey: null` and only the AES-GCM envelope ships — the
 * reader gates on a passphrase and decrypts in the visitor's browser.
 */
export function renderReaderHtml(
  journey: PublishedJourney | null,
  opts: RenderReaderOptions = {},
): string {
  const encrypted = opts.encrypted;
  const attribution = opts.attribution ?? DEFAULT_ATTRIBUTION;
  // Never leak the real title into an encrypted file.
  const docTitle = encrypted ? "A locked journey" : journey?.title || "A journey";
  const payloadScript = encrypted
    ? `<script type="application/json" id="pc-env">${jsonForScript(encrypted)}</script>`
    : `<script type="application/json" id="pc-data">${jsonForScript(journey ?? { title: docTitle, dateRange: {}, steps: [], totals: { countries: 0, places: 0, distanceKm: 0 } })}</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(docTitle)}</title>
<style>${READER_CSS}</style>
</head>
<body data-attrib="${escapeHtml(attribution)}">
<div class="pc-shell">
<noscript><div class="pc-noscript">This published journal is an interactive book that needs JavaScript to page through. Please enable JavaScript in your browser to read it. Your data stays private — nothing is sent anywhere.</div></noscript>
<main id="pc-app" class="pc-app" aria-live="polite"><p class="pc-loading">Loading the journey…</p></main>
<footer class="pc-foot">Published with Postcards · a private, offline travel journal. ${escapeHtml(attribution)}</footer>
</div>
${payloadScript}
<script>${READER_JS}</script>
</body>
</html>`;
}
