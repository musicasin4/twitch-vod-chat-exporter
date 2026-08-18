let comments=[],vodInfo=null,currentPage=1,pageSize=100;
const $=id=>document.getElementById(id);

function offset(s){
  const t=Math.max(0,Math.floor(Number(s||0)));
  return `${String(Math.floor(t/3600)).padStart(2,"0")}:${String(Math.floor(t/60)%60).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
}
function esc(v){return `"${String(v??"").replace(/"/g,'""')}"`}
function rows(){return comments.map(x=>({
  Date:x.Date||"",
  "Comment video time":offset(x["Comment video time"]),
  Badge:x.Badge||"",
  Name:x.Name||"",
  Color:x.Color||"",
  Comment:x.Comment||""
}))}
function status(t,e=false){
  $("status").textContent=t;$("status").classList.remove("hidden");$("status").classList.toggle("error",e);
}
function blob(b,n){const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function totalPages(){return pageSize===0?1:Math.max(1,Math.ceil(comments.length/pageSize))}
function visibleComments(){if(pageSize===0)return comments;const s=(currentPage-1)*pageSize;return comments.slice(s,s+pageSize)}

function badgeNode(badge){
  const wrap=document.createElement("span");wrap.className="badge-wrap";wrap.title=badge.title||"";
  if(badge.url){
    const img=document.createElement("img");
    img.className="chat-badge";img.src=badge.url;img.alt=badge.title||"Badge";img.loading="lazy";img.referrerPolicy="no-referrer";
    img.onerror=()=>{wrap.textContent=badge.title||"";wrap.classList.add("badge-fallback")};
    wrap.appendChild(img);
  }else{wrap.textContent=badge.title||"";wrap.classList.add("badge-fallback")}
  return wrap;
}
function pageButton(p){
  const b=document.createElement("button");b.className="page-btn secondary"+(p===currentPage?" active":"");b.textContent=p;
  b.onclick=()=>{currentPage=p;preview()};return b;
}
function renderPagination(){
  const c=$("pagination"),label=$("pageInfo");c.innerHTML="";
  if(pageSize===0){label.textContent=`Todas as ${comments.length.toLocaleString("pt-BR")} mensagens`;c.classList.add("hidden");return}
  c.classList.remove("hidden");
  const total=totalPages(),start=comments.length?(currentPage-1)*pageSize+1:0,end=Math.min(currentPage*pageSize,comments.length);
  label.textContent=`${start.toLocaleString("pt-BR")}–${end.toLocaleString("pt-BR")} de ${comments.length.toLocaleString("pt-BR")}`;
  const prev=document.createElement("button");prev.className="page-btn secondary";prev.textContent="‹";prev.disabled=currentPage<=1;prev.onclick=()=>{currentPage--;preview()};c.appendChild(prev);
  let first=Math.max(1,currentPage-3),last=Math.min(total,first+6);first=Math.max(1,last-6);
  if(first>1){c.appendChild(pageButton(1));if(first>2){const d=document.createElement("span");d.className="page-dots";d.textContent="…";c.appendChild(d)}}
  for(let p=first;p<=last;p++)c.appendChild(pageButton(p));
  if(last<total){if(last<total-1){const d=document.createElement("span");d.className="page-dots";d.textContent="…";c.appendChild(d)}c.appendChild(pageButton(total))}
  const next=document.createElement("button");next.className="page-btn secondary";next.textContent="›";next.disabled=currentPage>=total;next.onclick=()=>{currentPage++;preview()};c.appendChild(next);
}
function preview(){
  const b=$("preview");b.innerHTML="";const frag=document.createDocumentFragment();
  for(const r of visibleComments()){
    const tr=document.createElement("tr");
    const time=document.createElement("td");time.className="time-col";time.textContent=offset(r["Comment video time"]);tr.appendChild(time);
    const bt=document.createElement("td");bt.className="badges-col";
    (Array.isArray(r.BadgeImages)?r.BadgeImages:[]).forEach(x=>bt.appendChild(badgeNode(x)));tr.appendChild(bt);
    const name=document.createElement("td");name.className="name-col";name.textContent=r.Name||"";if(r.Color)name.style.color=r.Color;tr.appendChild(name);
    const msg=document.createElement("td");msg.className="comment-col";msg.textContent=r.Comment||"";tr.appendChild(msg);
    frag.appendChild(tr);
  }
  b.appendChild(frag);renderPagination();
  $("previewMeta").textContent=pageSize===0?`Mostrando todas as ${comments.length.toLocaleString("pt-BR")} mensagens`:`Mostrando ${visibleComments().length.toLocaleString("pt-BR")} mensagens nesta página`;
}
$("pageSize").onchange=e=>{pageSize=Number(e.target.value);currentPage=1;preview()};
$("download").onclick=async()=>{
  const vod=$("vod").value.trim();if(!vod)return status("Informe a URL ou o ID do VOD.",true);
  $("download").disabled=true;$("progressWrap").classList.remove("hidden");$("progress").style.width="12%";status("Baixando o chat replay... VODs grandes podem levar alguns minutos.");
  try{
    $("progress").style.width="25%";
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({vod})});
    $("progress").style.width="80%";const d=await r.json();if(!r.ok)throw Error(d.error||"Erro ao baixar o chat.");
    comments=d.comments||[];if($("skipEmpty").checked)comments=comments.filter(x=>String(x.Comment||"").trim());
    vodInfo=d.vod||{};currentPage=1;pageSize=Number($("pageSize").value);
    $("title").textContent=`VOD ${vodInfo.id||""}`;$("meta").textContent=`${comments.length.toLocaleString("pt-BR")} mensagens baixadas`;
    preview();$("result").classList.remove("hidden");$("progress").style.width="100%";status(`Concluído: ${comments.length.toLocaleString("pt-BR")} mensagens.`);
  }catch(e){$("progress").style.width="0";status(e.message||"Falha ao baixar o chat.",true)}
  finally{$("download").disabled=false}
};
$("vod").onkeydown=e=>{if(e.key==="Enter")$("download").click()};
$("csv").onclick=()=>{
  const h=["Date","Comment video time","Badge","Name","Color","Comment"],r=rows();
  const csv=[h.map(esc).join(","),...r.map(x=>h.map(k=>esc(x[k])).join(","))].join("\r\n");
  blob(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),`twitch_${vodInfo?.id||"chat"}_chat.csv`);
};
$("xlsx").onclick=async()=>{
  const r=rows();if(!r.length)return;
  try{const x=await fetch("/api/xlsx",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({comments:r})});if(!x.ok)throw Error(await x.text());blob(await x.blob(),`twitch_${vodInfo?.id||"chat"}_chat.xlsx`)}
  catch(e){status(e.message,true)}
};
