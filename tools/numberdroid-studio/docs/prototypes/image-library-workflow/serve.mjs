// Static, loopback-only design demo. Never imports or opens Studio's data store.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const files=new Map([['/',['index.html','text/html']],['/index.html',['index.html','text/html']],['/style.css',['style.css','text/css']],['/app.js',['app.js','text/javascript']]]);
const server=createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const entry=files.get(path);if(!entry){res.writeHead(404);res.end('Not found');return;}
  try{const bytes=await readFile(new URL(entry[0],import.meta.url));res.writeHead(200,{'content-type':entry[1]+'; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(500);res.end('Prototype unavailable');}
});
server.listen(4327,'127.0.0.1',()=>console.log('Image → Library design prototype ready on 127.0.0.1:4327'));
let stopping=false;const close=()=>{if(stopping)return;stopping=true;server.close();};
process.once('SIGINT',close);process.once('SIGTERM',close);
