/* Curved cylinder gallery adapted from the user's CircularCarousel reference.
   Uses the existing static portfolio, with no React runtime or placeholder photos. */
(() => {
  'use strict';
  const RAD = Math.PI / 180, SPRING = 118, OVERLAP = 2.5;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const wrap = d => ((((d + 180) % 360) + 360) % 360) - 180;
  const rx = (p, degrees) => {const r=degrees*RAD,c=Math.cos(r),s=Math.sin(r);return [p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c];};
  const ry = (p, degrees) => {const r=degrees*RAD,c=Math.cos(r),s=Math.sin(r);return [p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];};
  const escape = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const digits = value => String(value).padStart(2,'0').split('').map(n=>'<span class="circular-carousel__digit"><span class="circular-carousel__reel" style="transform:translateY('+(-Number(n)*10)+'%)">'+Array.from({length:10},(_,i)=>'<span>'+i+'</span>').join('')+'</span></span>').join('');

  window.mountCircularCarousel = function(host, incoming, options = {}) {
    if (!incoming.length) return {destroy(){},setSuspended(){}};
    const items=incoming,compact=matchMedia('(max-width: 600px)');
    let pageSize=compact.matches?5:10,pageCount=Math.ceil(items.length/pageSize);
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const W=options.cardWidth || 260,H=W/(options.aspectRatio || .8),P=2500,tilt=-5;
    host.classList.add('circular-carousel');host.tabIndex=0;
    host.setAttribute('role','region');host.setAttribute('aria-roledescription','轮播');host.setAttribute('aria-label',options.label || '作品轮播');
    host.innerHTML='<div class="circular-carousel__view"><div class="circular-carousel__stage"><div class="circular-carousel__camera"><div class="circular-carousel__ring"></div></div></div></div><div class="circular-carousel__caption"><p class="circular-carousel__title"></p><span class="circular-carousel__count"><span class="circular-carousel__digits"></span><span>/</span><span>'+String(items.length).padStart(2,'0')+'</span></span></div><div class="circular-carousel__controls"><div><button data-cc-prev aria-label="上一件作品">←</button><button data-cc-next aria-label="下一件作品">→</button><button data-cc-pause aria-pressed="false">暂停旋转</button></div><div><button data-cc-page-prev aria-label="上一组作品">上一组</button><span class="circular-carousel__page-label"></span><button data-cc-page-next aria-label="下一组作品">下一组</button></div><div><button data-cc-open>'+escape(options.openLabel || '放大查看 ↗')+'</button>'+(options.onProject?'<button data-cc-project>项目与资产 ↓</button>':'')+'</div></div><p class="circular-carousel__help">左右拖动旋转 · 单击聚焦 · 双击放大 · 方向键切换，Enter 打开</p><span class="circular-carousel__live" aria-live="polite" aria-atomic="true"></span>';
    const view=host.querySelector('.circular-carousel__view'),stage=host.querySelector('.circular-carousel__stage'),camera=host.querySelector('.circular-carousel__camera'),ring=host.querySelector('.circular-carousel__ring');
    const state={angle:0,velocity:0,target:null,hover:false,drag:false,press:null,fit:1,shift:0,drop:0,yaw:0,pitch:0,pointer:{inside:false,x:0,y:0},holdUntil:0,last:0,introStart:0,introDone:false};
    let page=0,list=[],cards=[],active=-1,radius=0,step=360,raf=0,visible=false,paused=motion.matches,suspended=false,destroyed=false,clickTimer=0,wheelTimer=0,previewTimer=0,previewRaf=0,previewVideo=null,previewCard=null;
    const cleanups=[];
    const on=(target,type,handler,opts)=>{target.addEventListener(type,handler,opts);cleanups.push(()=>target.removeEventListener(type,handler,opts));};
    const globalIndex=()=>page*pageSize+Math.max(0,active);
    const canRun=()=>visible&&!document.hidden&&!suspended&&!destroyed;
    const stopPreview=()=>{
      clearTimeout(previewTimer);cancelAnimationFrame(previewRaf);previewRaf=0;
      if(previewVideo){previewVideo.pause();previewVideo.removeAttribute('src');previewVideo.load();previewVideo.remove();previewVideo=null;}
      if(previewCard){previewCard.querySelectorAll('canvas').forEach(c=>c.remove());previewCard.querySelectorAll('img').forEach(img=>img.style.visibility='');previewCard=null;}
    };
    const schedulePreview=()=>{
      stopPreview();const item=list[active],card=cards[active];
      if(!item?.video||!canRun()||motion.matches||state.drag)return;
      previewTimer=setTimeout(()=>{
        if(!canRun()||list[active]!==item)return;
        const video=document.createElement('video');previewVideo=video;previewCard=card;
        video.className='circular-carousel__source';video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.setAttribute('aria-hidden','true');video.src=item.video;host.append(video);
        const strips=[...card.querySelectorAll('[data-front]')].map(tile=>{
          const canvas=document.createElement('canvas');canvas.className='circular-carousel__video-frame';canvas.width=Math.ceil(Number(tile.dataset.size)*2);canvas.height=Math.ceil(H*2);tile.querySelector('.circular-carousel__frame').append(canvas);
          return {canvas,ctx:canvas.getContext('2d'),start:Number(tile.dataset.start),size:Number(tile.dataset.size)};
        });
        let lastPaint=0;
        const paint=now=>{
          previewRaf=0;if(previewVideo!==video||!canRun())return;
          if(video.readyState>=2&&now-lastPaint>65){
            lastPaint=now;
            const scale=Math.min(W/video.videoWidth,H/video.videoHeight),dw=video.videoWidth*scale,dh=video.videoHeight*scale,x=(W-dw)/2,y=(H-dh)/2;
            for(const {canvas,ctx,start,size} of strips){ctx.fillStyle='#eeede9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(video,(x-start)*2,y*2,dw*2,dh*2);canvas.style.display='block';}
            card.querySelectorAll('[data-front] img').forEach(img=>img.style.visibility='hidden');
          }
          previewRaf=requestAnimationFrame(paint);
        };
        video.addEventListener('playing',()=>{if(!previewRaf)previewRaf=requestAnimationFrame(paint);},{once:true});
        video.addEventListener('error',()=>{if(previewVideo===video)stopPreview();},{once:true});
        video.play().catch(()=>{if(previewVideo===video)stopPreview();});
      },450);
    };
    const caption=()=>{
      const item=list[active];if(!item)return;
      host.querySelector('.circular-carousel__title').innerHTML=escape(item.title || item.alt)+'<span class="circular-carousel__subtitle">'+escape(item.subtitle || item.alt || '')+'</span>';
      const number=host.querySelector('.circular-carousel__digits'),value=String(globalIndex()+1).padStart(2,'0');
      if(!number.children.length){number.innerHTML=digits(globalIndex()+1);number.setAttribute('aria-hidden','true');}
      else number.querySelectorAll('.circular-carousel__reel').forEach((reel,i)=>reel.style.transform='translateY('+(-Number(value[i])*10)+'%)');
      host.querySelector('.circular-carousel__live').textContent=(item.title||item.alt)+'，第 '+(globalIndex()+1)+' 件，共 '+items.length+' 件';
      host.dataset.active=String(globalIndex());
      if(item.video)host.querySelector('[data-cc-open]').textContent='放大播放 ↗';
      options.onChange?.(item,globalIndex());schedulePreview();
    };
    const measure=()=>{
      const rect=view.getBoundingClientRect();if(!rect.width||!rect.height)return;
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(let a=-180;a<=180;a+=7.5){for(const [cx,cy] of [[-W/2,-H/2],[W/2,-H/2],[-W/2,H/2],[W/2,H/2]]){
        const q=rx(ry([cx,cy,radius],a),tilt),z=q[2]-radius,k=P/(P-z);
        minX=Math.min(minX,q[0]*k);maxX=Math.max(maxX,q[0]*k);minY=Math.min(minY,q[1]*k);maxY=Math.max(maxY,q[1]*k);
      }}
      state.fit=Math.min(1,rect.width*.94/(maxX-minX),rect.height*.86/(maxY-minY));
      state.shift=-(minY+maxY)/2*state.fit;
      state.drop=rect.height/state.fit*.55+H;
      stage.style.perspective=P+'px';stage.style.transform='translate3d(0,'+state.shift+'px,0) scale('+state.fit+')';
    };
    const draw=now=>{
      const elapsed=state.introStart?now-state.introStart:0,intro=state.introDone?1:clamp(elapsed/1400,0,1);
      const R=radius*(1+(motion.matches?0:.06)*Math.min(1,Math.abs(state.velocity)/420));
      camera.style.transform='translate3d(0,0,'+(-R)+'px) rotateX('+(tilt+state.pitch)+'deg) rotateY('+state.yaw+'deg)';
      ring.style.transform='rotateY('+state.angle+'deg)';
      for(let i=0;i<cards.length;i++){
        const base=i*step,reach=Math.abs(wrap(base+state.angle)),delay=reach/180*480;
        const rise=state.introDone?1:1-Math.pow(1-clamp((elapsed-delay)/900,0,1),5);
        cards[i].style.transform='rotateY('+base+'deg) translateZ('+R+'px)'+(rise<1?' translateY('+((1-rise)*state.drop)+'px)':'');
        const facing=Math.cos(wrap(base+state.angle)*RAD);
        cards[i].style.setProperty('--cc-depth',(.55*Math.pow((1-facing)/2,1.25)).toFixed(3));
        cards[i].style.pointerEvents=facing>.05?'':'none';
      }
      if(intro===1)state.introDone=true;
      const next=((Math.round(-state.angle/step)%list.length)+list.length)%list.length;
      if(next!==active){active=next;caption();}
    };
    const frame=now=>{
      raf=0;if(!canRun()){state.last=0;return;}
      if(!state.introStart)state.introStart=now;
      const dt=state.last?Math.min((now-state.last)/1000,.05):1/60;state.last=now;
      const cruise=list.length>1&&!paused&&!motion.matches&&!state.hover&&!state.drag&&now>state.holdUntil&&state.introDone?-11:0;
      let busy=!state.introDone||state.drag||now<state.holdUntil;
      if(!state.drag){
        if(state.target!==null){
          let remaining=dt;while(remaining>0){const h=Math.min(remaining,1/240);state.velocity+=(SPRING*(state.target-state.angle)-2*Math.sqrt(SPRING)*state.velocity)*h;state.angle+=state.velocity*h;remaining-=h;}
          if(Math.abs(state.target-state.angle)<.004&&Math.abs(state.velocity)<.03){state.angle=state.target;state.velocity=0;state.target=null;}busy=true;
        }else{
          state.velocity+=(cruise-state.velocity)*(1-Math.exp(-dt/1.08));state.angle+=state.velocity*dt;
          if(cruise===0&&Math.abs(state.velocity)<9&&Math.abs(state.angle-Math.round(state.angle/step)*step)>.004)state.target=Math.round(state.angle/step)*step;
          busy=busy||cruise!==0||Math.abs(state.velocity)>.01||state.target!==null;
        }
      }
      const ease=1-Math.exp(-dt/.35),aimYaw=state.pointer.inside&&!motion.matches?state.pointer.x*2.7:0,aimPitch=state.pointer.inside&&!motion.matches?-state.pointer.y*1.8:0;
      state.yaw+=(aimYaw-state.yaw)*ease;state.pitch+=(aimPitch-state.pitch)*ease;
      busy=busy||Math.abs(aimYaw-state.yaw)>.01||Math.abs(aimPitch-state.pitch)>.01;draw(now);
      if(busy)raf=requestAnimationFrame(frame);else state.last=0;
    };
    const wake=()=>{if(!raf&&canRun())raf=requestAnimationFrame(frame);};
    const focus=index=>{
      const target=-index*step;state.target=target+360*Math.round((state.angle-target)/360);state.holdUntil=performance.now()+2800;
      if(motion.matches){state.angle=state.target;state.velocity=0;state.target=null;draw(performance.now());}wake();
    };
    const buildPage=(next,focusLast=false)=>{
      stopPreview();cancelAnimationFrame(raf);raf=0;page=next;list=items.slice(page*pageSize,(page+1)*pageSize);step=360/list.length;
      const n=Math.max(3,list.length);radius=Math.max(n*(W+25)/(2*Math.PI),W*.6);
      state.angle=focusLast?-(list.length-1)*step:0;state.target=null;state.velocity=0;state.introStart=0;state.introDone=motion.matches;state.last=0;active=-1;
      const bend=radius,length=W/8;
      ring.innerHTML=list.map((item,index)=>'<div class="circular-carousel__card" data-cc-index="'+index+'" role="button" tabindex="-1" aria-label="双击放大：'+escape(item.title||item.alt)+'">'+[false,true].map(back=>Array.from({length:8},(_,t)=>{
        const start=t*length-(t?OVERLAP/2:0),end=(t+1)*length+(t<7?OVERLAP/2:0),size=end-start,center=(start+end)/2-W/2,alpha=center/bend,shift=bend*Math.sin(alpha),depth=-bend*(1-Math.cos(alpha)),turn=alpha/RAD;
        const offset=back?W-end:start,first=back?t===7:t===0,last=back?t===0:t===7;
        return '<div class="circular-carousel__tile" '+(!back?'data-front ':'')+'data-start="'+start+'" data-size="'+size+'" style="left:'+(-size/2)+'px;top:'+(-H/2)+'px;width:'+size+'px;height:'+H+'px;transform:translate3d('+shift+'px,0,'+depth+'px) rotateY('+turn+'deg)'+(back?' rotateY(180deg)':'')+'"><div class="circular-carousel__frame" style="height:'+H+'px;border-radius:'+(first?'12px':'0')+' '+(last?'12px':'0')+' '+(last?'12px':'0')+' '+(first?'12px':'0')+'"><img class="circular-carousel__photo" src="'+escape(item.src)+'" alt="" draggable="false" decoding="async" style="left:'+(-offset)+'px;top:0;width:'+W+'px;height:'+H+'px">'+(back?'<div class="circular-carousel__inner"></div>':'')+'<div class="circular-carousel__shade"></div></div></div>';
      }).join('')).join('')+'</div>').join('');
      cards=[...ring.children];host.dataset.page=String(page);
      host.dataset.count=String(list.length);
      host.querySelector('[data-cc-prev]').disabled=list.length===1&&pageCount===1;
      host.querySelector('[data-cc-next]').disabled=list.length===1&&pageCount===1;
      host.querySelector('[data-cc-pause]').disabled=list.length===1;
      host.querySelector('.circular-carousel__help').textContent=list.length===1?'双击放大 · Enter 打开':'左右拖动旋转 · 单击聚焦 · 双击放大 · 方向键切换，Enter 打开';
      host.querySelector('[data-cc-page-prev]').disabled=page===0;host.querySelector('[data-cc-page-next]').disabled=page===pageCount-1;
      host.querySelector('.circular-carousel__page-label').textContent=(page+1)+' / '+pageCount+' 组';
      host.querySelector('[data-cc-page-prev]').parentElement.hidden=pageCount===1;
      measure();draw(performance.now());wake();
    };
    const advance=delta=>{
      const base=state.target??Math.round(state.angle/step)*step;
      const next=((Math.round(-base/step)%list.length)+list.length)%list.length+delta;
      if(next>=list.length&&page<pageCount-1)buildPage(page+1);
      else if(next<0&&page>0)buildPage(page-1,true);
      else {state.target=base-delta*step;state.holdUntil=performance.now()+2800;if(motion.matches){state.angle=state.target;state.target=null;draw(performance.now());}wake();}
    };
    const open=index=>{clearTimeout(clickTimer);options.onOpen?.(list[index],page*pageSize+index,cards[index]);};
    const release=event=>{
      const press=state.press;if(!press||press.id!==event.pointerId)return;state.press=null;
      if(!press.moved)return;state.drag=false;host.removeAttribute('data-dragging');
      const first=press.samples[0],last=press.samples.at(-1),span=(last.time-first.time)/1000;
      const velocity=event.type==='pointercancel'?0:span>.008?clamp((last.angle-first.angle)/span,-1400,1400):0;
      state.velocity=velocity;state.target=Math.round((state.angle+velocity*1.08*.55)/step)*step;state.holdUntil=performance.now()+1600;
      state.suppressUntil=performance.now()+350;
      if(view.hasPointerCapture(event.pointerId))view.releasePointerCapture(event.pointerId);schedulePreview();wake();
    };
    on(view,'pointerdown',event=>{if(event.button!==0||list.length===1)return;clearTimeout(clickTimer);state.press={id:event.pointerId,x:event.clientX,y:event.clientY,angle:state.angle,moved:false,origin:0,samples:[{time:performance.now(),angle:state.angle}]};});
    on(view,'pointermove',event=>{
      const rect=view.getBoundingClientRect();if(event.pointerType==='mouse'){state.pointer.inside=true;state.pointer.x=clamp((event.clientX-rect.left)/rect.width*2-1,-1,1);state.pointer.y=clamp((event.clientY-rect.top)/rect.height*2-1,-1,1);}
      const press=state.press;if(!press||press.id!==event.pointerId){wake();return;}
      const dx=event.clientX-press.x,dy=event.clientY-press.y;
      if(!press.moved){if(Math.abs(dx)<5)return;if(event.pointerType!=='mouse'&&Math.abs(dy)>Math.abs(dx)*1.2){state.press=null;return;}press.moved=true;press.origin=dx;state.drag=true;state.target=null;state.velocity=0;stopPreview();host.setAttribute('data-dragging','');view.setPointerCapture(event.pointerId);}
      state.angle=press.angle+(dx-press.origin)*180/(Math.PI*radius*state.fit);const now=performance.now();press.samples.push({time:now,angle:state.angle});while(press.samples.length>2&&now-press.samples[0].time>110)press.samples.shift();wake();
    });
    on(view,'pointerup',release);on(view,'pointercancel',release);on(view,'lostpointercapture',release);
    on(view,'pointerenter',event=>{if(event.pointerType==='mouse'){state.hover=true;wake();}});
    on(view,'pointerleave',event=>{if(event.pointerType==='mouse'){state.hover=false;state.pointer.inside=false;wake();}});
    on(view,'wheel',event=>{if(list.length===1||Math.abs(event.deltaX)<=Math.abs(event.deltaY))return;event.preventDefault();state.target=null;const delta=-event.deltaX*180/(Math.PI*radius*state.fit);state.angle+=delta;state.velocity=delta*30;state.holdUntil=performance.now()+1600;clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{state.target=Math.round((state.angle+state.velocity*.12)/step)*step;wake();},140);wake();},{passive:false});
    on(host,'click',event=>{
      const button=event.target.closest('button');
      if(button){
        if(button.hasAttribute('data-cc-prev'))advance(-1);else if(button.hasAttribute('data-cc-next'))advance(1);
        else if(button.hasAttribute('data-cc-page-prev'))buildPage(page-1);else if(button.hasAttribute('data-cc-page-next'))buildPage(page+1);
        else if(button.hasAttribute('data-cc-open'))open(active);else if(button.hasAttribute('data-cc-project'))options.onProject?.(list[active],globalIndex());
        else if(button.hasAttribute('data-cc-pause')){paused=!paused;button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'继续旋转':'暂停旋转';wake();}return;
      }
      const card=event.target.closest('[data-cc-index]');if(!card||performance.now()<(state.suppressUntil||0))return;
      clearTimeout(clickTimer);if(event.detail<2)clickTimer=setTimeout(()=>focus(Number(card.dataset.ccIndex)),240);
    });
    on(view,'dblclick',event=>{const card=event.target.closest('[data-cc-index]');if(card&&performance.now()>=(state.suppressUntil||0)){event.preventDefault();open(Number(card.dataset.ccIndex));}});
    on(host,'keydown',event=>{
      if(event.target.closest('button'))return;
      if(event.key==='ArrowRight')advance(1);else if(event.key==='ArrowLeft')advance(-1);else if(event.key==='Home'){buildPage(0);focus(0);}else if(event.key==='End'){buildPage(pageCount-1,true);focus(list.length-1);}else if(event.key==='Enter'||event.key===' ')open(active);else return;event.preventDefault();
    });
    on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;state.last=0;stopPreview();}else{wake();schedulePreview();}});
    on(motion,'change',()=>{paused=motion.matches;state.introDone=true;const button=host.querySelector('[data-cc-pause]');button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'继续旋转':'暂停旋转';stopPreview();wake();});
    on(compact,'change',()=>{const current=globalIndex();pageSize=compact.matches?5:10;pageCount=Math.ceil(items.length/pageSize);buildPage(Math.floor(current/pageSize));focus(current%pageSize);});
    const ro=new ResizeObserver(()=>{measure();wake();});ro.observe(view);
    const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible){measure();wake();schedulePreview();}else{cancelAnimationFrame(raf);raf=0;state.last=0;stopPreview();}},{threshold:.05});io.observe(view);
    buildPage(0);host.querySelector('[data-cc-pause]').setAttribute('aria-pressed',String(paused));host.querySelector('[data-cc-pause]').textContent=paused?'继续旋转':'暂停旋转';
    return {
      setSuspended(value){suspended=value;if(value){cancelAnimationFrame(raf);raf=0;state.last=0;stopPreview();}else{wake();schedulePreview();}},
      focus(global){const next=clamp(global,0,items.length-1),newPage=Math.floor(next/pageSize);if(newPage!==page)buildPage(newPage);focus(next%pageSize);},
      destroy(){destroyed=true;cancelAnimationFrame(raf);clearTimeout(clickTimer);clearTimeout(wheelTimer);stopPreview();ro.disconnect();io.disconnect();cleanups.forEach(fn=>fn());}
    };
  };
})();
