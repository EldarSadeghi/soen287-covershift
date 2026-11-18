import {JsonStore} from '../../../../src/storage/json-store.js';
import {createAppServer} from '../../../../src/app.js';
import {SessionStore} from '../../../../src/auth/sessions.js';
const dir=process.env.ACCEPTANCE_DATA_DIRECTORY;
if(!dir || !/^\/(private\/)?tmp\/covershift-acceptance-/.test(dir)) throw new Error('Use a fictional directory created by create-preview.mjs.');
const server=createAppServer({store:new JsonStore(`${dir}/covershift.json`),sessions:new SessionStore()});
const handle=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(req,res)=>{if(req.method==='GET'&&req.url==='/api/manager/workers'){setTimeout(()=>{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"message":"Injected delayed roster response"}');},45000);return;}handle(req,res);});server.listen(3014,'127.0.0.1',()=>console.log('Fault-injection acceptance server :3014; only roster GET delayed 45 seconds'));
