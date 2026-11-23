import { requestJSON } from './request.js';
import { element } from './shift-card.js';
export function mountNotifications(account,csrfToken) {
  const bell=element('button','logout-button notification-bell');bell.type='button';bell.setAttribute('aria-label','Notifications');bell.setAttribute('aria-haspopup','dialog');
  bell.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-count" hidden></span>';
  document.querySelector('.profile').prepend(bell);
  const dialog=element('dialog','notification-dialog');dialog.setAttribute('aria-labelledby','notification-heading');
  dialog.innerHTML='<div class="panel-head"><h2 id="notification-heading">Notifications</h2><button type="button" class="logout-button" data-close>Close</button></div><p class="section-note">Coverage updates for your account. Assignment still requires manager approval.</p><div class="notification-tools"><button type="button" class="logout-button" data-refresh>Refresh</button><button type="button" class="logout-button" data-read>Mark displayed as read</button></div><p role="status" aria-live="polite" data-state></p><div data-list></div><button type="button" class="logout-button" data-more hidden>Load older notifications</button>';
  document.body.append(dialog);
  const count=bell.querySelector('span'),list=dialog.querySelector('[data-list]'),state=dialog.querySelector('[data-state]'),refresh=dialog.querySelector('[data-refresh]'),read=dialog.querySelector('[data-read]'),more=dialog.querySelector('[data-more]');
  let stopped=false,busy=false,writing=false,rows=[],next=null;
  const date=new Intl.DateTimeFormat(undefined,{timeZone:account.business.timezone,dateStyle:'medium',timeStyle:'short'});
  function badge(n){count.textContent=n>99?'99+':String(n);count.hidden=n===0;bell.setAttribute('aria-label',`Notifications, ${n} unread`);}
  function controls(){refresh.disabled=more.disabled=busy||writing;read.disabled=busy||writing||!rows.some(n=>!n.readAt);}
  function render(){
    list.replaceChildren();
    if(!rows.length)list.append(element('p','section-note','No notifications yet. New coverage updates will appear here.'));
    for(const n of rows){
      const card=element('article',`notification-item ${n.readAt?'':'notification-unread'}`);
      card.append(element('h3','',n.title),element('p','',n.message),element('p','section-note',`${date.format(new Date(n.createdAt))} · ${n.readAt?'Read':'Unread'} · Current status: ${n.currentStatus}`));
      const link=element('a','', 'View request and current status');link.href=n.href;card.append(link);
      if(!n.readAt){const button=element('button','logout-button','Mark as read');button.type='button';button.disabled=writing;button.addEventListener('click',()=>mark([n.id]));card.append(button);}
      list.append(card);
    }
    more.hidden=!next;controls();
  }
  async function load(append=false,silent=false){
    if(stopped||busy||writing)return;busy=true;if(!silent)controls();if(!silent)state.textContent='Loading notifications…';
    try{
      const response=await requestJSON('/api/notifications'+(append&&next?'?before='+next:''),{cache:'no-store'});
      if(stopped)return;
      if(response.status===401){clear();location.replace('/login?expired=1');return;}
      if(!response.ok)throw new Error();badge(response.data.unreadCount);
      // Background polling only updates the badge: never replace focused inbox controls.
      if(!silent || dialog.open && !rows.length){rows=response.data.notifications;next=response.data.next;render();state.textContent=`${response.data.unreadCount} unread. Times shown in ${account.business.timezone}.`;}
    }catch{if(!stopped){bell.setAttribute('aria-label','Notifications, updates unavailable');if(!silent || dialog.open && !rows.length)state.textContent='Notifications could not be loaded. Use Refresh to try again.';}}
    finally{busy=false;if(!stopped)controls();}
  }
  async function mark(ids){
    if(stopped||busy||writing)return;writing=true;controls();state.textContent='Saving read status…';
    try{
      const response=await requestJSON('/api/notifications/read',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({ids})});
      if(stopped)return;
      if(response.status===401){clear();location.replace('/login?expired=1');return;}
      if(!response.ok)throw new Error();
      for(const n of rows)if(ids.includes(n.id))n.readAt=new Date().toISOString();render();state.textContent='Selected notifications marked as read.';
    }catch{if(!stopped)state.textContent='Read status could not be confirmed. Refresh to check before trying again.';}
    finally{writing=false;if(!stopped){render();refresh.focus();void load(false,true);}}
  }
  bell.addEventListener('click',()=>{dialog.showModal();dialog.querySelector('[data-close]').focus();state.textContent='Loading notifications…';void load();});
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(!stopped)bell.focus();});
  dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=[...dialog.querySelectorAll('button:not(:disabled),a[href]')].filter(x=>!x.hidden);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}});
  refresh.addEventListener('click',()=>void load());more.addEventListener('click',()=>void load(true));read.addEventListener('click',()=>void mark(rows.filter(n=>!n.readAt).map(n=>n.id)));
  const visible=()=>{if(document.visibilityState==='visible')void load(false,true);};
  document.addEventListener('visibilitychange',visible);
  const timer=setInterval(visible,30000);
  function clear(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);rows=[];dialog.close();dialog.remove();bell.remove();}
  void load(false,true);return {clear};
}
