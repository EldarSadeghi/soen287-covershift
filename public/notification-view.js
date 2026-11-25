// Pure view helpers: event IDs and read states remain independent after grouping.
export function mergeNotificationPages(existing,incoming){const records=new Map(existing.map(n=>[n.id,n]));for(const n of incoming)records.set(n.id,n);return [...records.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));}
export function groupNotificationRows(rows,filter='all'){
 const map=new Map();for(const n of mergeNotificationPages([],rows)){const key=n.groupKey||n.id;let group=map.get(key);if(!group){group={key,latest:n,events:[],unreadIds:[]};map.set(key,group);}group.events.push(n);if(!n.readAt)group.unreadIds.push(n.id);}
 return [...map.values()].filter(g=>filter!=='unread'||g.unreadIds.length);
}
export function localNotificationDay(value,timezone){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function notificationAge(value,now=Date.now()) {const elapsed=Math.max(0,now-Date.parse(value)),minutes=Math.floor(elapsed/60000);if(minutes<1)return 'Just now';if(minutes<60)return minutes+' min ago';const hours=Math.floor(minutes/60);if(hours<24)return hours+' hr ago';return Math.floor(hours/24)+' days ago';}
