import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  document.getElementById("app").innerHTML =
    '<div class="login-wrap"><div class="login-card"><h1>Missing config</h1><p class="note">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file (or Vercel project settings) and reload.</p></div></div>';
  throw new Error("Missing Supabase env vars");
}
const supabase = createClient(supabaseUrl, supabaseKey);

const app = document.getElementById("app");
let state = { stock: [], customers: [], sales: [] };
let activeTab = "dashboard";
let showStockForm = false, showCustForm = false, showSaleForm = false;
const money = n => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => (s == null ? "" : String(s)).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- AUTH ----------
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) renderApp(session);
  else renderLogin();
});

async function boot() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) renderApp(session);
  else renderLogin();
}

function renderLogin(mode = "signin", error = "") {
  app.innerHTML = `
    <div class="login-wrap"><div class="login-card">
      <h1>Joseph Agency</h1>
      <div class="tag">Sales Dashboard</div>
      <input id="li-email" type="email" placeholder="Email">
      <input id="li-pass" type="password" placeholder="Password">
      ${error ? `<div class="error">${esc(error)}</div>` : ""}
      <button class="primary" style="width:100%;margin-top:6px" id="li-submit">${mode === "signin" ? "Sign in" : "Create account"}</button>
      <div class="note" style="margin-top:14px">
        ${mode === "signin"
          ? `New here? <button class="link" id="li-switch">Create an account</button>`
          : `Already have one? <button class="link" id="li-switch">Sign in</button>`}
      </div>
    </div></div>`;
  document.getElementById("li-switch").onclick = () => renderLogin(mode === "signin" ? "signup" : "signin");
  document.getElementById("li-submit").onclick = async () => {
    const email = document.getElementById("li-email").value.trim();
    const password = document.getElementById("li-pass").value;
    const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error: err } = await fn.call(supabase.auth, { email, password });
    if (err) renderLogin(mode, err.message);
    else if (mode === "signup") renderLogin("signin", "Account created — check your email if confirmation is required, then sign in.");
  };
}

// ---------- APP SHELL ----------
async function renderApp(session) {
  await loadAll();
  app.innerHTML = `
    <div class="app">
      <nav class="side">
        <h1>Joseph Agency</h1>
        <div class="tag">Sales Dashboard</div>
        <button data-tab="dashboard">Dashboard</button>
        <button data-tab="stock">Stock</button>
        <button data-tab="customers">Customers</button>
        <button data-tab="sales">Sales</button>
        <button class="link" id="signout" style="margin-top:20px;color:#C6CCD3">Sign out</button>
      </nav>
      <main id="main"></main>
    </div>`;
  document.querySelectorAll("nav.side button[data-tab]").forEach(b =>
    b.addEventListener("click", () => { activeTab = b.dataset.tab; renderTab(); })
  );
  document.getElementById("signout").onclick = () => supabase.auth.signOut();
  renderTab();
}

async function loadAll() {
  const [{ data: stock }, { data: customers }, { data: sales }] = await Promise.all([
    supabase.from("stock").select("*").order("name"),
    supabase.from("customers").select("*").order("name"),
    supabase.from("sales").select("*").order("sold_at", { ascending: false }),
  ]);
  state.stock = stock || [];
  state.customers = customers || [];
  state.sales = sales || [];
}

function renderTab() {
  document.querySelectorAll("nav.side button[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === activeTab));
  const main = document.getElementById("main");
  if (activeTab === "dashboard") main.innerHTML = dashboardHtml();
  if (activeTab === "stock") main.innerHTML = stockHtml();
  if (activeTab === "customers") main.innerHTML = customersHtml();
  if (activeTab === "sales") main.innerHTML = salesHtml();
  wireTabEvents();
}

// ---------- DASHBOARD ----------
function dashboardHtml() {
  const revenue = state.sales.reduce((a, s) => a + Number(s.total || 0), 0);
  const lowStock = state.stock.filter(i => Number(i.quantity) <= Number(i.reorder_at || 5)).length;
  return `
    <div class="row"><h2>Overview</h2></div>
    <div class="cards">
      <div class="card"><div class="num">${money(revenue)}</div><div class="lbl">Total revenue</div></div>
      <div class="card"><div class="num">${state.sales.length}</div><div class="lbl">Sales recorded</div></div>
      <div class="card"><div class="num">${state.customers.length}</div><div class="lbl">Customers</div></div>
      <div class="card"><div class="num" style="${lowStock ? "color:var(--rust)" : ""}">${lowStock}</div><div class="lbl">Items low on stock</div></div>
    </div>
    <h3 style="margin-bottom:10px;font-size:16px">Recent sales</h3>
    ${saleTable(state.sales.slice(0, 6))}`;
}

// ---------- STOCK ----------
function stockHtml() {
  return `
    <div class="row"><h2>Stock</h2><button class="primary" id="toggle-stock">${showStockForm ? "Cancel" : "Add item"}</button></div>
    <div class="panel-form ${showStockForm ? "open" : ""}">
      <div class="grid">
        <div><label>Item name</label><input id="sf-name"></div>
        <div><label>SKU</label><input id="sf-sku"></div>
        <div><label>Quantity</label><input id="sf-qty" type="number" min="0" value="0"></div>
        <div><label>Unit price</label><input id="sf-price" type="number" min="0" step="0.01" value="0"></div>
        <div><label>Reorder at</label><input id="sf-reorder" type="number" min="0" value="5"></div>
      </div>
      <button class="primary" id="save-stock">Save item</button>
    </div>
    ${state.stock.length === 0 ? '<div class="empty">No stock items yet.</div>' : `
    <div class="wrap-table"><table>
      <tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit price</th><th></th></tr>
      ${state.stock.map(i => `
        <tr>
          <td>${esc(i.name)}</td><td>${esc(i.sku || "—")}</td>
          <td class="${Number(i.quantity) <= Number(i.reorder_at || 5) ? "low" : ""}">${i.quantity}${Number(i.quantity) <= Number(i.reorder_at || 5) ? " · low" : ""}</td>
          <td>${money(i.price)}</td>
          <td><button class="link danger" data-del-stock="${i.id}">Remove</button></td>
        </tr>`).join("")}
    </table></div>`}`;
}

// ---------- CUSTOMERS ----------
function customersHtml() {
  return `
    <div class="row"><h2>Customers</h2><button class="primary" id="toggle-cust">${showCustForm ? "Cancel" : "Add customer"}</button></div>
    <div class="panel-form ${showCustForm ? "open" : ""}">
      <div class="grid">
        <div><label>Name</label><input id="cf-name"></div>
        <div><label>Phone</label><input id="cf-phone"></div>
        <div><label>Email</label><input id="cf-email"></div>
      </div>
      <button class="primary" id="save-cust">Save customer</button>
    </div>
    ${state.customers.length === 0 ? '<div class="empty">No customers yet.</div>' : `
    <div class="wrap-table"><table>
      <tr><th>Name</th><th>Phone</th><th>Email</th><th></th></tr>
      ${state.customers.map(c => `
        <tr>
          <td>${esc(c.name)}</td><td>${esc(c.phone || "—")}</td><td>${esc(c.email || "—")}</td>
          <td><button class="link danger" data-del-cust="${c.id}">Remove</button></td>
        </tr>`).join("")}
    </table></div>`}`;
}

// ---------- SALES ----------
function saleTable(list) {
  if (list.length === 0) return '<div class="empty">No sales recorded yet.</div>';
  return `<div class="wrap-table"><table>
    <tr><th>Date</th><th>Customer</th><th>Item</th><th>Qty</th><th>Total</th></tr>
    ${list.map(s => `
      <tr>
        <td>${new Date(s.sold_at).toLocaleDateString()}</td>
        <td>${esc(s.customer_name)}</td><td>${esc(s.item_name)}</td>
        <td>${s.quantity}</td><td>${money(s.total)}</td>
      </tr>`).join("")}
  </table></div>`;
}

function salesHtml() {
  const custOpts = state.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  const itemOpts = state.stock.map(i => `<option value="${i.id}">${esc(i.name)} (${i.quantity} in stock)</option>`).join("");
  return `
    <div class="row"><h2>Sales</h2><button class="primary" id="toggle-sale">${showSaleForm ? "Cancel" : "Record sale"}</button></div>
    <div class="panel-form ${showSaleForm ? "open" : ""}">
      ${(state.customers.length === 0 || state.stock.length === 0) ? '<div class="note">Add at least one customer and one stock item first.</div>' : `
      <div class="grid">
        <div><label>Customer</label><select id="sf2-cust">${custOpts}</select></div>
        <div><label>Item</label><select id="sf2-item">${itemOpts}</select></div>
        <div><label>Quantity</label><input id="sf2-qty" type="number" min="1" value="1"></div>
        <div><label>Total</label><input id="sf2-total" type="number" readonly></div>
      </div>
      <button class="primary" id="save-sale">Save sale</button>`}
    </div>
    ${saleTable(state.sales)}`;
}

// ---------- EVENT WIRING & MUTATIONS ----------
function wireTabEvents() {
  const byId = id => document.getElementById(id);

  if (activeTab === "stock") {
    byId("toggle-stock").onclick = () => { showStockForm = !showStockForm; renderTab(); };
    if (showStockForm) byId("save-stock").onclick = addStock;
    document.querySelectorAll("[data-del-stock]").forEach(b => b.onclick = () => deleteStock(b.dataset.delStock));
  }
  if (activeTab === "customers") {
    byId("toggle-cust").onclick = () => { showCustForm = !showCustForm; renderTab(); };
    if (showCustForm) byId("save-cust").onclick = addCustomer;
    document.querySelectorAll("[data-del-cust]").forEach(b => b.onclick = () => deleteCustomer(b.dataset.delCust));
  }
  if (activeTab === "sales") {
    byId("toggle-sale").onclick = () => { showSaleForm = !showSaleForm; renderTab(); };
    if (showSaleForm && state.customers.length && state.stock.length) byId("save-sale").onclick = recordSale;
  }
}

async function addStock() {
  const name = document.getElementById("sf-name").value.trim();
  if (!name) return;
  const item = {
    name,
    sku: document.getElementById("sf-sku").value.trim(),
    quantity: Number(document.getElementById("sf-qty").value || 0),
    price: Number(document.getElementById("sf-price").value || 0),
    reorder_at: Number(document.getElementById("sf-reorder").value || 5),
  };
  const { error } = await supabase.from("stock").insert(item);
  if (error) { alert(error.message); return; }
  showStockForm = false;
  await loadAll(); renderTab();
}
async function deleteStock(id) {
  const { error } = await supabase.from("stock").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  await loadAll(); renderTab();
}
async function addCustomer() {
  const name = document.getElementById("cf-name").value.trim();
  if (!name) return;
  const cust = {
    name,
    phone: document.getElementById("cf-phone").value.trim(),
    email: document.getElementById("cf-email").value.trim(),
  };
  const { error } = await supabase.from("customers").insert(cust);
  if (error) { alert(error.message); return; }
  showCustForm = false;
  await loadAll(); renderTab();
}
async function deleteCustomer(id) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  await loadAll(); renderTab();
}
async function recordSale() {
  const custId = document.getElementById("sf2-cust").value;
  const itemId = document.getElementById("sf2-item").value;
  const qty = Number(document.getElementById("sf2-qty").value || 0);
  const cust = state.customers.find(c => c.id === custId);
  const item = state.stock.find(i => i.id === itemId);
  if (!cust || !item || qty <= 0) return;
  if (qty > Number(item.quantity)) { alert("Not enough stock — only " + item.quantity + " available."); return; }

  const sale = {
    customer_id: cust.id, customer_name: cust.name,
    item_id: item.id, item_name: item.name,
    quantity: qty, unit_price: item.price, total: Number((item.price * qty).toFixed(2)),
    sold_at: new Date().toISOString(),
  };
  const { error: saleErr } = await supabase.from("sales").insert(sale);
  if (saleErr) { alert(saleErr.message); return; }
  const { error: stockErr } = await supabase.from("stock").update({ quantity: item.quantity - qty }).eq("id", item.id);
  if (stockErr) { alert(stockErr.message); return; }

  showSaleForm = false;
  await loadAll(); renderTab();
}

boot();
