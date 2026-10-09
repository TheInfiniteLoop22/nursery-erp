// Removes the vendor and notes created by live.mjs.  API_URL=... node clean.mjs
const API = process.env.API_URL || 'http://localhost:8000/api/v1'
const tok=(await (await fetch(`${API}/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_username:'admin',user_password:'admin123'})})).json()).access_token
const H={Authorization:`Bearer ${tok}`}
const list=await (await fetch(`${API}/nursery/all?page=1&page_size=50`,{headers:H})).json()
for (const v of list.items){
  const d=await (await fetch(`${API}/nursery/${v.nursery_id}`,{headers:H})).json()
  for (const p of d.products||[]){
    const notes=await (await fetch(`${API}/products/${p.product_id}/notes`,{headers:H})).json()
    for(const n of Array.isArray(notes)?notes:[]) if(n.note_text==='E2E note'){ console.log('del note',(await fetch(`${API}/products/${p.product_id}/notes/${n.note_id}`,{method:'DELETE',headers:H})).status)}
  }
  if(v.nursery_name==='E2E Vendor') console.log('del vendor',(await fetch(`${API}/nursery/${v.nursery_id}`,{method:'DELETE',headers:H})).status)
}
