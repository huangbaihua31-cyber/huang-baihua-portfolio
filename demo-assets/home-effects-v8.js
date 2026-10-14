/* Homepage adaptation of the user's MaskedHeading: SVG text mask, rise reveal,
   pointer parallax and slow drift. Only the directory title and subtitle use it. */
(() => {
  'use strict';
  document.querySelectorAll('#basics-title, #scene2 .headline > .h-line2').forEach((root,index)=>{
  const text=root.textContent.trim(),scene=root.closest('#scene2'),clipId='directory-heading-mask-'+index;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  root.classList.add('masked-heading');root.setAttribute('aria-label',text);
  root.innerHTML='<span class="masked-heading__measure" aria-hidden="true"><span class="masked-heading__word"></span><i class="masked-heading__baseline"></i></span><svg class="masked-heading__defs" aria-hidden="true" focusable="false"><defs><clipPath id="'+clipId+'" clipPathUnits="userSpaceOnUse"><text></text></clipPath></defs></svg><span class="masked-heading__reveal" aria-hidden="true"><span class="masked-heading__clip"><span class="masked-heading__media"><canvas></canvas></span></span></span>';
  root.querySelector('.masked-heading__clip').style.clipPath='url(#'+clipId+')';
  const measure=root.querySelector('.masked-heading__measure'),word=root.querySelector('.masked-heading__word'),baseline=root.querySelector('.masked-heading__baseline');
  const glyph=root.querySelector('text'),media=root.querySelector('.masked-heading__media'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  word.textContent=text;glyph.textContent=text;
  if(!ctx)return;
  let raf=0,last=0,clock=0,visible=true,revealed=false,ready=false,x=0,y=0,tx=0,ty=0;
  const sync=()=>{
    const style=getComputedStyle(measure);
    glyph.setAttribute('x',String(word.offsetLeft));glyph.setAttribute('y',String(baseline.offsetTop));
    for(const property of ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing'])glyph.style[property]=style[property];
    const dpr=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(root.clientWidth*dpr)),height=Math.max(1,Math.round(root.clientHeight*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    wake();
  };
  const canRun=()=>visible&&!scene.inert&&!root.inert&&Number(root.style.opacity||1)>.15&&!document.hidden&&!document.querySelector('.work-dialog[open]');
  const paint=()=>{
    const source=document.getElementById('video-frame');
    if(!source||!source.width||!source.height)return false;
    const width=canvas.width,height=canvas.height,scale=Math.max(width/source.width,height/source.height);
    const sw=width/scale,sh=height/scale;
    try{ctx.drawImage(source,(source.width-sw)/2,(source.height-sh)*.46,sw,sh,0,0,width,height);return true;}catch{return false;}
  };
  const reveal=()=>{
    if(revealed)return;revealed=true;root.dataset.revealed='true';
    if(!reduce.matches)glyph.animate([{transform:'translateY(115%)'},{transform:'translateY(0)'}],{duration:1100,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'});
  };
  const frame=now=>{
    raf=0;if(!canRun())return;
    const dt=Math.min(.05,(now-(last||now))/1000);last=now;clock+=dt;
    if(paint()){
      if(!ready){ready=true;root.classList.add('is-masked');reveal();}
      const ease=1-Math.exp(-dt/.18),dx=reduce.matches?0:Math.sin(clock*.21)*18,dy=reduce.matches?0:Math.cos(clock*.17)*10.8;
      x+=(tx+dx-x)*ease;y+=(ty+dy-y)*ease;
      const maxX=root.clientWidth*.125,maxY=root.clientHeight*.125;
      media.style.transform='translate3d('+clamp(x,-maxX,maxX).toFixed(2)+'px,'+clamp(y,-maxY,maxY).toFixed(2)+'px,0) scale(1.25)';
    }
    if(!reduce.matches||!ready)raf=requestAnimationFrame(frame);
  };
  function wake(){if(!raf&&canRun()){last=0;raf=requestAnimationFrame(frame);}}
  root.addEventListener('pointermove',event=>{if(reduce.matches)return;const box=root.getBoundingClientRect();tx=-clamp((event.clientX-box.left)/box.width*2-1,-1,1)*26;ty=-clamp((event.clientY-box.top)/box.height*2-1,-1,1)*26;wake();});
  root.addEventListener('pointerleave',()=>{tx=ty=0;wake();});
  new ResizeObserver(sync).observe(root);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake();}).observe(root);
  new MutationObserver(wake).observe(scene,{attributes:true,attributeFilter:['inert','style']});
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['inert','style']});
  new MutationObserver(wake).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('visibilitychange',wake);
  reduce.addEventListener('change',()=>{tx=ty=x=y=0;if(reduce.matches)glyph.getAnimations().forEach(animation=>animation.finish());sync();});
  document.fonts?.ready.then(sync).catch(()=>{});
  sync();
  });
})();
