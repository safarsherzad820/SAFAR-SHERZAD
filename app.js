(() => {
  "use strict";
  const cfg = window.SAFAR_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const whatsapp = String(cfg.whatsappNumber || "9647832775646").replace(/\D/g, "");
  const supabaseReady = Boolean(window.supabase && cfg.supabaseUrl && cfg.supabaseAnonKey &&
    cfg.supabaseUrl.startsWith("https://") && !cfg.supabaseUrl.includes("PASTE_") &&
    !cfg.supabaseAnonKey.includes("PASTE_"));
  const db = supabaseReady ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  let products = [];
  let selectedFile = null;
  let toastTimer;

  const sampleProducts = [
    {id:"sample-1",name:"مۆبایلی زیرەک",category:"مۆبایل",price:350000,description:"وردەکاری کاڵاکە لە ژووری بەڕێوەبەر زیاد بکە.",image_url:"",is_active:true},
    {id:"sample-2",name:"کۆمپیوتەر",category:"ئەلیکترۆنی",price:850000,description:"کاڵای گونجاو بۆ کار و خوێندن.",image_url:"",is_active:true},
    {id:"sample-3",name:"کاتژمێری زیرەک",category:"ئاکسسوار",price:75000,description:"وردەکاری و نرخ دەتوانرێت بگۆڕدرێت.",image_url:"",is_active:true},
    {id:"sample-4",name:"ماوسی گەیمینگ",category:"کۆمپیوتەر",price:25000,description:"بەرهەمەکان لە داتابەیسەوە زیاد بکە.",image_url:"",is_active:true}
  ];

  function money(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat("en-US", {maximumFractionDigits:0}).format(n) + (cfg.currency === "USD" ? " USD" : " د.ع");
  }
  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function showToast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
  }
  function waLink(message = "") { return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`; }
  ["hero-whatsapp","about-whatsapp","footer-whatsapp"].forEach(id => { if ($(id)) $(id).href = waLink("سڵاو، دەمەوێت پرسیارێک لەسەر کاڵاکانت بکەم."); });
  $("year").textContent = new Date().getFullYear();
  if (!supabaseReady) $("status").textContent = "پێشنیار: ئەم وێبسایتە ئامادەیە، بەڵام بۆ کاڵای هاوبەش و ژووری بەڕێوەبەری ڕاستەقینە پێویستە Supabase لە config.js ڕێکبخرێت. کاڵای نموونەیی لە خوارەوە دەردەکەون.";

  async function loadProducts() {
    if (!db) { products = sampleProducts; renderProducts(); return; }
    const {data,error} = await db.from("products").select("*").eq("is_active", true).order("created_at", {ascending:false});
    if (error) { $("status").textContent = "نەتوانرا کاڵاکان بار بکرێن. ڕێکخستنی Supabase و RLS بپشکنە."; console.error(error); products=[]; renderProducts(); return; }
    products = data || []; $("status").textContent = products.length ? ` ${products.length} کاڵا بەردەستە` : "هێشتا کاڵایەک زیاد نەکراوە.";
    renderProducts();
  }
  function renderProducts() {
    const search = ($("search").value || "").trim().toLocaleLowerCase();
    const category = $("category").value;
    const filtered = products.filter(p => (!category || p.category === category) &&
      (!search || `${p.name||""} ${p.description||""} ${p.category||""}`.toLocaleLowerCase().includes(search)));
    const categories = [...new Set(products.map(p=>p.category).filter(Boolean))].sort();
    const select = $("category"), previous = select.value;
    select.innerHTML = '<option value="">هەموو پۆلەکان</option>' + categories.map(c=>`<option value="${safeText(c)}">${safeText(c)}</option>`).join("");
    if (categories.includes(previous)) select.value = previous;
    $("product-grid").innerHTML = filtered.map(p => `
      <article class="product-card">
        <div class="product-image">${p.image_url ? `<img loading="lazy" src="${safeText(p.image_url)}" alt="${safeText(p.name)}" onerror="this.remove()">` : '<span class="placeholder">▦</span>'}</div>
        <div class="product-info"><span class="product-category">${safeText(p.category || "کاڵا")}</span>
        <h3>${safeText(p.name)}</h3><p>${safeText(p.description || "بۆ زانیاری زیاتر پەیوەندیمان پێوە بکە.")}</p>
        <div class="product-bottom"><span class="price">${money(p.price)}</span><button class="buy-button" data-order="${safeText(p.id)}">داواکردن ←</button></div></div>
      </article>`).join("");
    $("empty-state").classList.toggle("hidden", filtered.length !== 0);
    $("product-grid").classList.toggle("hidden", filtered.length === 0);
    if (db && products.length) $("status").textContent = `${products.length} کاڵا لە فرۆشگا`;
    $("product-grid").querySelectorAll("[data-order]").forEach(btn => btn.addEventListener("click", () => openOrder(btn.dataset.order)));
  }
  $("search").addEventListener("input", renderProducts);
  $("category").addEventListener("change", renderProducts);

  function openOrder(id) {
    const p = products.find(x => String(x.id) === String(id));
    if (!p) return;
    $("order-product-id").value = p.id; $("order-title").textContent = p.name; $("order-price").textContent = money(p.price);
    $("order-dialog").showModal();
  }
  $("order-form").addEventListener("submit", async e => {
    e.preventDefault();
    const p = products.find(x => String(x.id) === $("order-product-id").value);
    if (!p) return;
    const order = {product_id: p.id, product_name:p.name, unit_price:Number(p.price), customer_name:$("customer-name").value.trim(),
      customer_phone:$("customer-phone").value.trim(), customer_address:$("customer-address").value.trim(), note:$("customer-note").value.trim()};
    if (db) {
      const {error} = await db.from("orders").insert({...order, status:"new"});
      if (error) { console.error(error); showToast("داواکاری لە داتابەیس پاشەکەوت نەکرا؛ لە واتساپەوە بینێرە."); }
    }
    const msg = `داواکاری نوێ - SAFAR SHERZAD%0Aکاڵا: ${order.product_name}%0Aنرخ: ${money(order.unit_price)}%0Aناو: ${order.customer_name}%0Aژمارە: ${order.customer_phone}%0Aناونیشان: ${order.customer_address}%0Aتێبینی: ${order.note || "نییە"}`;
    $("order-dialog").close(); window.open(waLink(decodeURIComponent(msg)), "_blank", "noopener");
  });

  function closeDialog(id) { const d=$(id); if (d && d.open) d.close(); }
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
  ["order-dialog","admin-dialog"].forEach(id=>$(id).addEventListener("click",e=>{if(e.target===$(id)) closeDialog(id)}));
  $("admin-open").addEventListener("click",()=>{$("admin-dialog").showModal();});
  $("login-form").addEventListener("submit", async e=>{
    e.preventDefault();
    if (!db) { $("admin-login-view").querySelector(".tiny-note").textContent = "سەرەتا URL و anon/publishable key ـی Supabase لە config.js دابنێ و SQL ـی README.md جێبەجێ بکە."; return; }
    const email=$("admin-email").value.trim(), password=$("admin-password").value;
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error){showToast("چوونە ژوورەوە سەرکەوتوو نەبوو. ئیمەیڵ و وشەی نهێنی بپشکنە.");return;}
    await showAdmin();
  });
  async function showAdmin() {
    if (!db) return;
    const {data:{user}}=await db.auth.getUser();
    if(!user){$("admin-login-view").classList.remove("hidden");$("admin-dashboard").classList.add("hidden");return;}
    if(String(user.email).toLowerCase()!==String(cfg.adminEmail).toLowerCase()){
      await db.auth.signOut(); showToast("ئەم هەژمارە مافی بەڕێوەبەری نییە."); return;
    }
    $("admin-login-view").classList.add("hidden");$("admin-dashboard").classList.remove("hidden");
    await loadAdminProducts();
  }
  $("logout").addEventListener("click",async()=>{if(db)await db.auth.signOut();$("admin-dashboard").classList.add("hidden");$("admin-login-view").classList.remove("hidden");$("admin-password").value="";showToast("چوویتە دەرەوە.");});
  document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));
    document.querySelectorAll(".admin-panel").forEach(p=>p.classList.toggle("hidden",p.id!==tab.dataset.tab));
  }));
  $("product-file").addEventListener("change",()=>{selectedFile=$("product-file").files[0]||null;});
  $("reset-product").addEventListener("click",resetProductForm);
  function resetProductForm() { $("product-form").reset();$("edit-id").value="";$("product-active").checked=true;$("editor-heading").textContent="زیادکردنی کاڵا";selectedFile=null;$("admin-message").textContent=""; }
  $("product-form").addEventListener("submit",async e=>{
    e.preventDefault(); if(!db){$("admin-message").textContent="Supabase هێشتا ڕێک نەخراوە.";return;}
    const {data:{user}}=await db.auth.getUser(); if(!user||user.email.toLowerCase()!==String(cfg.adminEmail).toLowerCase()){showToast("دەبێت وەک بەڕێوەبەر بچیتە ژوورەوە.");return;}
    const editId=$("edit-id").value; let imageUrl=$("product-image").value.trim();
    try{
      if(selectedFile){
        const ext=(selectedFile.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase();
        const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
        const {error:uploadError}=await db.storage.from("product-images").upload(path,selectedFile,{upsert:false,contentType:selectedFile.type});
        if(uploadError)throw uploadError;
        const {data}=db.storage.from("product-images").getPublicUrl(path);imageUrl=data.publicUrl;
      }
      const payload={name:$("product-name").value.trim(),price:Number($("product-price").value),category:$("product-category").value.trim(),
        image_url:imageUrl||null,description:$("product-description").value.trim(),is_active:$("product-active").checked,updated_at:new Date().toISOString()};
      let result;
      if(editId) result=await db.from("products").update(payload).eq("id",editId).select().single();
      else result=await db.from("products").insert(payload).select().single();
      if(result.error)throw result.error;
      $("admin-message").textContent="کاڵاکە بە سەرکەوتوویی پاشەکەوت کرا.";
      resetProductForm();await loadProducts();await loadAdminProducts();
    }catch(err){console.error(err);$("admin-message").textContent="هەڵە لە پاشەکەوتکردن: "+(err.message||"هەڵەی نەناسراو");}
  });
  async function loadAdminProducts(){
    if(!db)return;const {data,error}=await db.from("products").select("*").order("created_at",{ascending:false});
    if(error){$("admin-product-list").textContent="نەتوانرا کاڵاکان بهێنرێن. ڕێکخستنی RLS بپشکنە.";return;}
    $("admin-product-list").innerHTML=(data||[]).map(p=>`<div class="admin-product-row"><img src="${safeText(p.image_url||"")}" alt="" onerror="this.style.visibility='hidden'"><div class="row-info"><b>${safeText(p.name)}</b><small>${money(p.price)} · ${safeText(p.category)} · ${p.is_active?"چالاک":"شاراوە"}</small></div><div class="mini-actions"><button data-edit="${safeText(p.id)}">دەستکاری</button><button class="delete" data-delete="${safeText(p.id)}">سڕینەوە</button></div></div>`).join("")||"<p>هێشتا کاڵایەک نییە.</p>";
    $("admin-product-list").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct((data||[]).find(p=>String(p.id)===b.dataset.edit))));
    $("admin-product-list").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("دڵنیایت لە سڕینەوەی ئەم کاڵایە؟"))return;const {error}=await db.from("products").delete().eq("id",b.dataset.delete);if(error){showToast("سڕینەوە سەرکەوتوو نەبوو.");return;}await loadProducts();await loadAdminProducts();showToast("کاڵاکە سڕایەوە.");}));
  }
  function editProduct(p){if(!p)return;$("edit-id").value=p.id;$("product-name").value=p.name||"";$("product-price").value=p.price||0;$("product-category").value=p.category||"";$("product-image").value=p.image_url||"";$("product-description").value=p.description||"";$("product-active").checked=Boolean(p.is_active);$("editor-heading").textContent="دەستکاری کاڵا";document.querySelector('[data-tab="product-editor"]').click();$("product-editor").scrollIntoView({behavior:"smooth",block:"start"});}
  // Live updates: product changes made by the owner appear on customer pages
  // automatically, provided Supabase Realtime is enabled for public.products.
  if (db) {
    db.auth.getSession().then(({data}) => { if (data.session) showAdmin(); });
    db.channel("safar-sherzad-products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        loadProducts();
        if (!$("admin-dashboard").classList.contains("hidden")) loadAdminProducts();
      })
      .subscribe();
  }
  loadProducts();
})();