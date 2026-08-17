let comments=[],vodInfo=null;
const $=id=>document.getElementById(id);

function offset(s){
  s=Number(s||0);
  const ms=Math.round((s%1)*1000);
  const t=Math.floor(s);
  return `${String(Math.floor(t/3600)).padStart(2,"0")}:${String(Math.floor(t/60)%60).padStart(2,"0")}:${String(t%60).padStart(2,"0")}.${String(ms).padStart(3,"0")}`;
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
  $("status").textContent=t;
  $("status").classList.remove("hidden");
  $("status").classList.toggle("error",e);
}
function blob(b,n){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);a.download=n;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function preview(){
  const b=$("preview");b.innerHTML="";
  comments.slice(0,200).forEach(r=>{
    const tr=document.createElement("tr");
    [r.Date,offset(r["Comment video time"]),r.Badge,r.Name,r.Color,r.Comment].forEach(v=>{
      const td=document.createElement("td");td.textContent=v||"";tr.appendChild(td);
    });
    b.appendChild(tr);
  });
}

$("download").onclick=async()=>{
  const vod=$("vod").value.trim();
  if(!vod)return status("Informe a URL ou o ID do VOD.",true);

  $("download").disabled=true;
  $("progressWrap").classList.remove("hidden");
  $("progress").style.width="12%";
  status("Baixando o chat replay... VODs grandes podem levar alguns minutos.");

  try{
    $("progress").style.width="25%";
    const r=await fetch("/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({vod})
    });
    $("progress").style.width="80%";
    const d=await r.json();
    if(!r.ok)throw Error(d.error||"Erro ao baixar o chat.");

    comments=d.comments||[];
    if($("skipEmpty").checked)comments=comments.filter(x=>String(x.Comment||"").trim());

    vodInfo=d.vod||{};
    $("title").textContent=`VOD ${vodInfo.id||""}`;
    $("meta").textContent=`${comments.length.toLocaleString("pt-BR")} mensagens`;
    preview();
    $("result").classList.remove("hidden");
    $("progress").style.width="100%";
    status(`Concluído: ${comments.length.toLocaleString("pt-BR")} mensagens.`);
  }catch(e){
    $("progress").style.width="0";
    status(e.message||"Falha ao baixar o chat.",true);
  }finally{
    $("download").disabled=false;
  }
};

$("vod").onkeydown=e=>{if(e.key==="Enter")$("download").click()};

$("csv").onclick=()=>{
  const h=["Date","Comment video time","Badge","Name","Color","Comment"];
  const r=rows();
  const csv=[h.map(esc).join(","),...r.map(x=>h.map(k=>esc(x[k])).join(","))].join("\r\n");
  blob(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),`twitch_${vodInfo?.id||"chat"}_chat.csv`);
};

$("xlsx").onclick=async()=>{
  const r=rows();
  if(!r.length)return;
  try{
    const x=await fetch("/api/xlsx",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({comments:r})
    });
    if(!x.ok)throw Error(await x.text());
    blob(await x.blob(),`twitch_${vodInfo?.id||"chat"}_chat.xlsx`);
  }catch(e){status(e.message,true)}
};
