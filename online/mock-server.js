// Servidor de teste que imita as funções do Supabase (migrations/000_inscricoes_online.sql). Uso: node mock-server.js [porta]
const http=require('http'),crypto=require('crypto');
function create(){
  const ev={},regs=[];const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
  const yr=new Date().getFullYear();
  const E=m=>{const e=new Error(m);e.pg=m;return e};
  const adm=(id,a)=>{if(!ev[id]||ev[id].h!==sha(a||''))throw E('sem_permissao')};
  const fn={
    create_event:b=>{if(!b.p_name||b.p_name.trim().length<2)throw E('nome_invalido');if(!b.p_admin||b.p_admin.length<16)throw E('token_invalido');const id=crypto.randomUUID();ev[id]={name:b.p_name,date:b.p_date,h:sha(b.p_admin),open:true};return id},
    get_event:b=>ev[b.p_id]?{name:ev[b.p_id].name,date:ev[b.p_id].date,open:ev[b.p_id].open}:null,
    submit_registration:b=>{const e=ev[b.p_event];if(!e)throw E('evento_inexistente');if(!e.open)throw E('inscricoes_encerradas');
      if(!b.p_name||b.p_name.trim().length<2)throw E('nome_invalido');if(!b.p_team||b.p_team.trim().length<2)throw E('equipe_invalida');if(!['M','F'].includes(b.p_sex))throw E('sexo_invalido');
      if(!(b.p_born>=yr-100&&b.p_born<=yr-3))throw E('nascimento_invalido');if(!(b.p_weight>=15&&b.p_weight<=200))throw E('peso_invalido');if(!b.p_belt||b.p_belt.trim().length<3)throw E('faixa_invalida');
      if(regs.some(r=>r.event===b.p_event&&r.name.toLowerCase()===b.p_name.trim().toLowerCase()&&r.born===b.p_born))throw E('ja_inscrito');
      regs.push({id:crypto.randomUUID(),event:b.p_event,name:b.p_name.trim(),team:b.p_team.trim(),sex:b.p_sex,born:b.p_born,weight:Math.round(b.p_weight*10)/10,belt:b.p_belt.trim().toLowerCase(),phone:b.p_phone||null,imported:false,at:new Date().toISOString()});return {ok:true}},
    list_registrations:b=>{adm(b.p_event,b.p_admin);return regs.filter(r=>r.event===b.p_event).map(({event,...r})=>r)},
    set_open:b=>{adm(b.p_event,b.p_admin);ev[b.p_event].open=b.p_open;return {open:b.p_open}},
    mark_imported:b=>{adm(b.p_event,b.p_admin);regs.forEach(r=>{if(r.event===b.p_event&&b.p_ids.includes(r.id))r.imported=true});return {ok:true}}
  };
  const srv=http.createServer((req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    let body='';req.on('data',c=>body+=c);req.on('end',()=>{
      const m=req.url.match(/^\/rest\/v1\/rpc\/(\w+)/);
      if(!m||!fn[m[1]]||!req.headers.apikey){res.writeHead(404);return res.end('{"message":"not found"}')}
      try{const out=fn[m[1]](JSON.parse(body||'{}'));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(out))}
      catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:e.pg||String(e)}))}
    });
  });
  return {srv,ev,regs};
}
module.exports={create};
if(require.main===module){const {srv}=create();const p=+process.argv[2]||54321;srv.listen(p,()=>console.log('mock em http://localhost:'+p))}
