function formatMoney(num) { return new Intl.NumberFormat('vi-VN').format(num); }

function formatUnit(unitStr) {
    if (!unitStr) return 'Cái';
    unitStr = unitStr.trim();
    return unitStr.charAt(0).toUpperCase() + unitStr.slice(1).toLowerCase();
}

// ================= BIẾN TOÀN CỤC =================
let products = [];
let historyDataNAS = []; 
let inventoryList = []; // Biến lưu danh sách sản phẩm từ kho KB Tech

// ================= 1. KHỞI TẠO ỨNG DỤNG =================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load các khung giao diện tĩnh từ thư mục components
    await loadComponent('login-container', 'components/login.html'); 
    await loadComponent('sidebar-container', 'components/sidebar.html'); 
    
    // 2. Kiểm tra phiên đăng nhập
    checkSession();

    // 3. Tải dữ liệu kho hàng ngay khi mở trang
    loadInventory();
});

async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Lỗi tải file: ${filePath}`);
        document.getElementById(elementId).innerHTML = await response.text();
    } catch (error) {
        console.error("Lỗi giao diện:", error);
    }
}

// ================= 2. KẾT NỐI API KHO HÀNG & TÌM KIẾM =================
async function loadInventory() {
    try {
        // Gọi qua proxy.php để tránh lỗi CORS
        const response = await fetch('proxy.php');
        
        if (!response.ok) throw new Error("Lỗi API Kho");
        
        const data = await response.json();
        // Lấy danh sách sản phẩm
        inventoryList = data.data || data || []; 
        console.log("📦 Đã tải kho hàng:", inventoryList.length, "sản phẩm");
        
        // Tạo Datalist để hỗ trợ tính năng search
        renderDatalist();
    } catch (error) {
        console.error("❌ Không thể tải dữ liệu kho:", error);
    }
}

function renderDatalist() {
    let datalist = document.getElementById('inventory-datalist');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'inventory-datalist';
        document.body.appendChild(datalist);
    }
    let options = '';
    inventoryList.forEach(item => {
        // Lọc bỏ ngoặc kép để không làm hỏng cú pháp HTML
        let safeName = item.productName.replace(/"/g, '&quot;');
        options += `<option value="${safeName}"></option>`;
    });
    datalist.innerHTML = options;
}

function getInventorySearchHTML(index) {
    return `
        <div class="mb-3 relative group">
            <input type="text" list="inventory-datalist" 
                class="input-premium border-dashed border-red-300 bg-red-50 text-red-700 placeholder:text-red-400 font-bold transition-all focus:bg-white" 
                placeholder="Gõ tên sản phẩm để tìm & chọn nhanh từ kho" 
                onchange="applyFromSearch(this, ${index})"
                onclick="this.value=''">
            <div class="absolute right-3 top-2.5 text-red-300 text-xs pointer-events-none group-focus-within:opacity-0 transition-opacity">
            </div>
        </div>
    `;
}

function applyFromSearch(inputEl, index) {
    const searchTerm = inputEl.value.trim().toLowerCase();
    if (!searchTerm) return;

    // Tìm ưu tiên khớp chính xác (nếu user click chọn từ danh sách thả xuống)
    let item = inventoryList.find(p => p.productName.toLowerCase() === searchTerm);
    
    // Nếu không khớp chính xác, tìm theo từ khóa gần giống
    if (!item) {
        item = inventoryList.find(p => p.productName.toLowerCase().includes(searchTerm));
    }
    
    if (item) {
        const price = item.salePrice || 0;
        const rawUnit = item.unit || 'Cái';
        const unit = formatUnit(rawUnit); // Tính năng chuẩn hóa ĐVT
        
        let desc = item.description || item.short_description || item.mo_ta || "";
        let name = item.productName;
        
        // Nối mô tả vào tên
        if (desc && desc.trim() !== '') {
            name += '\n' + desc.trim();
        }
        
        products[index].name = name;
        products[index].unit = unit;
        products[index].price = parseInt(price) || 0;
        
        // Render lại khu vực input để hiện dữ liệu mới lấp vào
        renderProductInputs();
    }
}

// ================= 3. LOGIC ĐĂNG NHẬP (SSO) =================
async function checkSession() {
    try {
        let res = await fetch('auth.php?action=check');
        let data = await res.json();
        if (data.status === 'logged_in') {
            showApp(data.user);
        } else {
            document.getElementById('loginOverlay').classList.remove('hidden');
        }
    } catch(e) { console.error("API Error", e); }
}

async function login() {
    let u = document.getElementById('username').value;
    let p = document.getElementById('password').value;
    let btn = document.getElementById('btnLogin');
    let err = document.getElementById('loginError');
    
    err.classList.add('hidden');
    btn.innerHTML = 'ĐANG XỬ LÝ...';
    btn.disabled = true;

    try {
        let res = await fetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        let data = await res.json();

        if (data.status === 'success') {
            showApp(u);
        } else {
            err.innerText = data.message;
            err.classList.remove('hidden');
        }
    } catch(e) {
        err.innerText = "Không thể kết nối đến máy chủ NAS.";
        err.classList.remove('hidden');
    }
    btn.innerHTML = 'ĐĂNG NHẬP';
    btn.disabled = false;
}

async function logout() {
    await fetch('auth.php?action=logout');
    location.reload();
}

function showApp(username) {
    document.getElementById('loginOverlay').classList.add('opacity-0');
    setTimeout(() => { document.getElementById('loginOverlay').classList.add('hidden'); }, 500);
    
    let app = document.getElementById('appContainer');
    app.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('currentUserDisplay').innerText = username;

    createNewDocument(true);
}


// ================= 4. LOGIC LƯU NAS & LỊCH SỬ =================
async function saveQuoteToDB() {
    const quoteNo = document.getElementById('quoteNo').value;
    if(!quoteNo) return alert("Vui lòng điền số báo giá!");
    
    const currentData = {
        date: document.getElementById('docDate').value,
        quoteNo: quoteNo,
        contractNo: document.getElementById('contractNo').value,
        projectName: document.getElementById('projectName').value,
        buyerName: document.getElementById('buyerName').value,
        buyerAddress: document.getElementById('buyerAddress').value,
        deliveryAddress: document.getElementById('deliveryAddress').value,
        buyerTax: document.getElementById('buyerTax').value,
        buyerPhone: document.getElementById('buyerPhone').value,
        buyerRep: document.getElementById('buyerRep').value,
        buyerRole: document.getElementById('buyerRole').value,
        paymentOpt: document.getElementById('paymentOpt').value,
        products: products
    };

    let btn = document.getElementById('btnSaveDB');
    let originalText = btn.innerHTML;
    btn.innerHTML = "⏳ ĐANG LƯU LÊN SERVER...";
    btn.disabled = true;

    try {
        let res = await fetch('api.php?action=save_quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentData)
        });
        let data = await res.json();
        
        if (data.status === 'success') {
            alert("✅ Lưu báo giá thành công lên NAS!");
            loadHistoryFromDB();
        } else {
            alert("❌ Lỗi: " + data.message);
        }
    } catch(e) {
        alert("❌ Lỗi kết nối đến máy chủ.");
    }
    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function loadHistoryFromDB() {
    try {
        let res = await fetch('api.php?action=get_history');
        let data = await res.json();
        if (data.status === 'success') {
            historyDataNAS = data.data;
            renderHistoryNAS(historyDataNAS);
        }
    } catch(e) { console.error("Lỗi lấy lịch sử", e); }
}

function renderHistoryNAS(historyArray) {
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    if(historyArray.length === 0) {
        container.innerHTML = '<div class="text-center p-8 bg-white rounded-2xl"><p class="text-slate-400">Chưa có dữ liệu trên NAS.</p></div>';
        return;
    }
    historyArray.forEach(item => {
        let prods = [];
        try { prods = JSON.parse(item.products_json); } catch(e){}
        const totalAmount = prods.reduce((acc, p) => acc + (p.price * p.qty), 0);
        
        const html = `
            <div class="bg-white border p-5 rounded-2xl shadow-sm cursor-pointer mb-3" onclick="fillHistoryToForm(${item.id})">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-xs">${item.quote_no}</span>
                    <span class="text-xs text-slate-400">${item.doc_date}</span>
                </div>
                <div class="text-sm font-bold text-slate-800">${item.buyer_name || 'Khách lẻ'}</div>
                <div class="text-xs text-slate-500">${item.project_name || 'Chưa đặt tên'}</div>
                <div class="text-xs font-bold text-slate-800 text-right mt-2 text-red-600">${formatMoney(totalAmount + (totalAmount*0.08))} ₫</div>
            </div>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function fillHistoryToForm(dbId) {
    const item = historyDataNAS.find(h => h.id == dbId);
    if(!item) return;
    if(!confirm(`Tải lại báo giá ${item.quote_no}? Dữ liệu hiện tại sẽ bị ghi đè!`)) return;

    document.getElementById('docDate').value = item.doc_date;
    document.getElementById('quoteNo').value = item.quote_no;
    document.getElementById('contractNo').value = item.contract_no;
    document.getElementById('projectName').value = item.project_name;
    document.getElementById('buyerName').value = item.buyer_name;
    document.getElementById('buyerAddress').value = item.buyer_address;
    document.getElementById('deliveryAddress').value = item.delivery_address;
    document.getElementById('buyerTax').value = item.buyer_tax;
    document.getElementById('buyerPhone').value = item.buyer_phone;
    document.getElementById('buyerRep').value = item.buyer_rep;
    document.getElementById('buyerRole').value = item.buyer_role;
    document.getElementById('paymentOpt').value = item.payment_opt;
    
    try { products = JSON.parse(item.products_json) || []; } catch(e){ products = []; }
    renderProductInputs();
    switchTab('form-tab');
}


// ================= 5. LOGIC QUẢN LÝ GIAO DIỆN FORM =================
function createNewDocument(isInit = false) {
    if(!isInit && !confirm("Làm mới? Dữ liệu đang nhập sẽ bị xóa!")) return;
    document.getElementById('docDate').valueAsDate = new Date();
    if (isInit) {
        document.getElementById('projectName').value = "SERVER LƯU TRỮ";
        document.getElementById('buyerName').value = "CÔNG TY TNHH FOCUS SUCCESS";
        document.getElementById('buyerAddress').value = "Tầng 9, Tòa nhà Viễn Đông, 14 Phan Tôn, Phường Tân Định, Quận 1, TP. Hồ Chí Minh.";
        document.getElementById('deliveryAddress').value = "";
        document.getElementById('buyerTax').value = "0313427745";
        document.getElementById('buyerPhone').value = "";
        document.getElementById('buyerRep').value = "Chị Trinh";
        document.getElementById('buyerRole').value = "";
        products = [
            { name: "Thiết bị lưu trữ mạng NAS Synology DS225+\nModel: DS225+", bh: "36 tháng", unit: "Cái", qty: 1, price: 37000000 },
            { name: "HDD WD Black 4TB 3.5 inch SATA III", bh: "60 tháng", unit: "Cái", qty: 1, price: 6500000 }
        ];
    } else {
        document.getElementById('projectName').value = "";
        document.getElementById('buyerName').value = "";
        document.getElementById('buyerAddress').value = "";
        document.getElementById('deliveryAddress').value = "";
        document.getElementById('buyerTax').value = "";
        document.getElementById('buyerPhone').value = "";
        document.getElementById('buyerRep').value = "";
        document.getElementById('buyerRole').value = "";
        products = [{ name: "", bh: "12 tháng", unit: "Cái", qty: 1, price: 0 }];
    }
    autoGenerateDocumentNumbers();
    renderProductInputs();
    switchTab('form-tab');
}

function autoGenerateDocumentNumbers() {
    const d = document.getElementById('docDate').value ? new Date(document.getElementById('docDate').value) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const baseCode = `KB${yy}${dd}${mm}`;
    document.getElementById('quoteNo').value = `${baseCode}-1`;
    document.getElementById('contractNo').value = `${baseCode}-HDMB`;
}

function handleDateChange() { autoGenerateDocumentNumbers(); updateDoc(); }

function switchTab(tabId) {
    document.getElementById('form-tab').classList.add('hidden');
    document.getElementById('history-tab').classList.add('hidden');
    document.getElementById('btn-form-tab').classList.remove('active');
    document.getElementById('btn-history-tab').classList.remove('active');
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById('btn-' + tabId).classList.add('active');
}


// ================= 6. LOGIC SẢN PHẨM & TÍNH TOÁN =================

// Hàm riêng xử lý Textarea không gọi re-render, chống lỗi mất focus
function updateProductName(index, value) {
    products[index].name = value;
    updateDoc(); 
}

// Hàm riêng xử lý Quantity không gọi re-render, chống lỗi mất focus
function updateProductQty(index, value) {
    products[index].qty = parseInt(value) || 0;
    updateDoc(); 
}

function handlePriceInput(inputElem, index) {
    let rawValue = inputElem.value.replace(/[^0-9]/g, '');
    let numValue = parseInt(rawValue, 10);
    if (isNaN(numValue)) numValue = 0;
    products[index].price = numValue;
    inputElem.value = numValue === 0 ? '' : formatMoney(numValue);
    updateDoc(); // Không re-render chống mất focus
}

const bhOptions = ["N/A", "12 tháng", "24 tháng", "36 tháng", "60 tháng"];
const unitOptions = ["Cái", "Bộ", "Gói", "Mét"];

function createSelectHTML(options, currentValue, index, field) {
    let html = `<select onchange="updateProductSelect(${index}, '${field}', this.value)" class="input-premium py-2 cursor-pointer text-xs">`;
    let isCustom = true;
    options.forEach(opt => {
        const selected = (currentValue === opt) ? 'selected' : '';
        if(selected) isCustom = false;
        html += `<option value="${opt}" ${selected}>${opt}</option>`;
    });
    if(isCustom && currentValue) html += `<option value="${currentValue}" selected>${currentValue}</option>`;
    html += `<option value="Khác...">Nhập khác...</option></select>`;
    return html;
}

// Hàm xử lý riêng cho Dropdown (bh, unit), vì chọn xong có thể re-render mà ko sợ
function updateProductSelect(index, field, value) {
    if(value === "Khác...") { 
        let customVal = prompt("Nhập giá trị mới:"); 
        if(customVal) value = customVal; 
        else value = (field === 'bh') ? "12 tháng" : "Cái"; 
    }
    products[index][field] = value;
    renderProductInputs();
}

function renderProductInputs() {
    const container = document.getElementById('productList');
    container.innerHTML = '';
    
    products.forEach((prod, index) => {
        const priceFormatted = prod.price === 0 ? '' : formatMoney(prod.price);
        const rowHtml = `
            <div class="bg-white border border-slate-200 p-5 rounded-2xl relative group mb-4">
                <button onclick="removeProductRow(${index})" class="absolute -top-3 -right-3 bg-white border border-slate-200 text-red-500 rounded-full w-8 h-8 font-bold hover:bg-red-500 hover:text-white transition-all z-10 shadow-sm">✕</button>
                
                ${getInventorySearchHTML(index)}
                
                <div class="mb-4">
                    <label class="label-premium">Tên & Mô tả</label>
                    <textarea rows="3" oninput="updateProductName(${index}, this.value)" class="input-premium font-medium">${prod.name}</textarea>
                </div>
                <div class="grid grid-cols-12 gap-2">
                    <div class="col-span-3"><label class="label-premium">Bảo hành</label>${createSelectHTML(bhOptions, prod.bh, index, 'bh')}</div>
                    <div class="col-span-2"><label class="label-premium">Đơn vị</label>${createSelectHTML(unitOptions, prod.unit, index, 'unit')}</div>
                    <div class="col-span-2"><label class="label-premium text-center">SL</label><input type="number" min="1" value="${prod.qty}" oninput="updateProductQty(${index}, this.value)" class="input-premium text-center"></div>
                    <div class="col-span-5"><label class="label-premium text-right">Đơn giá (VNĐ)</label><input type="text" value="${priceFormatted}" oninput="handlePriceInput(this, ${index})" class="input-premium text-right text-red-600 font-bold"></div>
                </div>
            </div>`;
        container.insertAdjacentHTML('beforeend', rowHtml);
    });
    
    updateDoc(); 
}

function addProductRow() { products.push({ name: "", bh: "12 tháng", unit: "Cái", qty: 1, price: 0 }); renderProductInputs(); }
function removeProductRow(index) { products.splice(index, 1); renderProductInputs(); }


// ================= 7. KẾT XUẤT VÀ IN ẤN (PREVIEW) =================
function printSection(sectionId) {
    const sections = ['quote-section', 'contract-section', 'acceptance-section'];
    const dividers = document.querySelectorAll('.print-divider');
    if (sectionId === 'all') {
        sections.forEach(s => document.getElementById(s)?.classList.remove('no-print'));
        dividers.forEach(d => d.classList.remove('no-print'));
    } else {
        sections.forEach(s => {
            if(s === sectionId) document.getElementById(s)?.classList.remove('no-print');
            else document.getElementById(s)?.classList.add('no-print');
        });
        dividers.forEach(d => d.classList.add('no-print'));
    }
    window.print();
    sections.forEach(s => document.getElementById(s)?.classList.remove('no-print'));
    dividers.forEach(d => d.classList.remove('no-print'));
}

function updateDoc() {
    const dateInput = document.getElementById('docDate').value;
    const cDate = dateInput ? new Date(dateInput) : new Date();
    const day = String(cDate.getDate()).padStart(2, '0');
    const month = String(cDate.getMonth() + 1).padStart(2, '0');
    const year = cDate.getFullYear();
    const dateString = `ngày ${day} tháng ${month} năm ${year}`;
    const pdfDateStr = `${day}/${month}/${year}`; 

    const qNo = document.getElementById('quoteNo').value || "..................";
    const cNo = document.getElementById('contractNo').value || "..................";
    const pName = document.getElementById('projectName').value || "..................";
    const bName = document.getElementById('buyerName').value || ".......................................................";
    const bAddress = document.getElementById('buyerAddress').value || ".......................................................................................";
    const bTax = document.getElementById('buyerTax').value || ".........................";
    const bPhone = document.getElementById('buyerPhone').value || "";
    const bRep = document.getElementById('buyerRep').value || "..............................";
    const bRole = document.getElementById('buyerRole').value || "..............................";
    const payOpt = document.getElementById('paymentOpt').value;
    const dAddressInput = document.getElementById('deliveryAddress').value.trim();
    const deliveryAddress = dAddressInput !== "" ? dAddressInput : bAddress;

    let total = 0, tbodyQuote = "", tbodyHD = "", tbodyNT = "";   

    products.forEach((prod, i) => {
        const sub = prod.price * prod.qty; 
        total += sub;
        
        const lines = prod.name.split('\n');
        const mainName = lines[0];
        const specs = lines.slice(1).join('<br>');
        
        const premiumNameHTML = `<strong style="color: #1e293b; font-size: 10pt;">${mainName}</strong>` + 
            (specs ? `<br><span style="color: #64748b; font-size: 8.5pt; display: inline-block; margin-top: 4px; line-height: 1.4;">${specs}</span>` : '');
        const standardName = prod.name.replace(/\n/g, '<br>');

        tbodyQuote += `<tr>
            <td class="center" style="color: #64748b; font-weight: 600;">${String(i + 1).padStart(2, '0')}</td>
            <td>${premiumNameHTML}</td>
            <td class="center" style="font-weight: 500;">${prod.bh}</td>
            <td class="center" style="color: #64748b;">${prod.unit}</td>
            <td class="center" style="font-weight: 600;">${prod.qty}</td>
            <td class="right" style="color: ${prod.price === 0 ? '#94a3b8' : '#1e293b'};">${prod.price === 0 ? '0' : formatMoney(prod.price)}</td>
            <td class="right" style="color: ${prod.price === 0 ? '#94a3b8' : '#1e293b'}; font-weight: ${prod.price === 0 ? '400' : '600'};">${prod.price === 0 ? 'Tặng kèm' : formatMoney(sub)}</td>
        </tr>`;
        
        tbodyHD += `<tr>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">${i + 1}</td>
            <td style="border: 1px solid black; padding: 6px;">${standardName}</td>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">${prod.bh}</td>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">${prod.unit}</td>
            <td class="money-cell" style="border: 1px solid black; padding: 6px;">${prod.price === 0 ? '0' : formatMoney(prod.price)}</td>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">${prod.qty}</td>
            <td class="money-cell" style="border: 1px solid black; padding: 6px;">${prod.price === 0 ? 'Tặng kèm' : formatMoney(sub)}</td>
        </tr>`;
        
        tbodyNT += `<tr>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">${i + 1}</td>
            <td style="border: 1px solid black; padding: 6px;">${standardName}</td>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">${prod.unit}</td>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">${prod.qty}</td>
            <td style="text-align: center; border: 1px solid black; padding: 6px;">Mới 100%, Hoạt động tốt</td>
        </tr>`;
    });

    const tax = total * 0.08;
    const grandTotal = total + tax;
    
    let paymentText = payOpt === "50" 
        ? `<p>- <b>Đợt 1:</b> Bên A thanh toán <b>50%</b> giá trị hợp đồng (tương đương <b>${formatMoney(grandTotal/2)} VNĐ</b>) ngay sau khi ký kết Hợp đồng để Bên B tiến hành chuẩn bị hàng hóa.</p><p>- <b>Đợt 2:</b> Bên A thanh toán <b>50%</b> giá trị còn lại (tương đương <b>${formatMoney(grandTotal/2)} VNĐ</b>) sau khi Bên B hoàn tất giao hàng, lắp đặt và bàn giao hệ thống (nếu có).</p>` 
        : `<p>- Bên A thanh toán <b>100%</b> giá trị hợp đồng (tương đương <b>${formatMoney(grandTotal)} VNĐ</b>) ngay sau khi ký kết Hợp đồng để Bên B tiến hành chuẩn bị và giao hàng.</p>`;

    const html = `
        <div id="quote-section" class="pdf-quote pb-[10mm]">
            <table class="quote-header"><tr><td style="width: 20%; vertical-align: middle; padding: 0;">
                <img src="logo.png" alt="KB TECH Logo" style="max-width: 100%; height: auto; max-height: 55px; object-fit: contain;">
            </td><td style="width: 45%; vertical-align: middle; padding: 0 0 0 15px;"><div style="font-size: 12.5pt; font-weight: 800; color: #1e293b; letter-spacing: 0.5px; text-transform: uppercase;">CÔNG TY TNHH TM DV KB</div><div style="font-size: 9.5pt; color: #64748b; margin-top: 5px; line-height: 1.5;">info@kbtech.vn | 0933 129 155<br>341/25S Lạc Long Quân, P.Hoà Bình, TP.HCM</div></td><td style="width: 35%; text-align: right; vertical-align: middle; padding: 0;"><div class="quote-title">BÁO GIÁ</div><div class="quote-subtitle">Quotation Proposal</div><div style="margin-top: 8px; font-size: 10pt; color: #64748b;">Mã số / No: <span style="font-weight: 700; color: #b30000; font-family: 'JetBrains Mono', monospace; font-size: 11pt;">${qNo}</span></div></td></tr></table>
            <table class="quote-meta-grid"><tr><td style="width: 42%; padding-right: 20px;"><div class="quote-label">Đơn vị tiếp nhận <span class="quote-muted">/ To</span></div><div class="quote-value"><strong class="quote-accent" style="font-size: 11.5pt;">${bName}</strong><br><span style="font-size: 9.5pt; font-weight: 400; color: #475569; display: block; margin-top: 6px;">Đại diện: <strong style="color: #1e293b;">${bRep}</strong><br>SĐT: ${bPhone}<br>Đ/C: ${bAddress}</span></div></td><td style="width: 33%; padding-right: 15px;"><div class="quote-label" style="padding-left: 12px;">Tư vấn dự án <span class="quote-muted">/ From</span></div><div class="quote-value" style="border-left: 2px solid #e2e8f0; padding-left: 10px;"><strong style="color: #1e293b;">Lê Tuấn Hải</strong><br><span style="font-size: 9.5pt; font-weight: 400; color: #475569; display: block; margin-top: 4px;">0943 511 911<br>tuanhai@kbtech.vn</span></div></td><td style="width: 25%;"><div class="quote-label">Thông tin <span class="quote-muted">/ Info</span></div><div class="quote-value"><table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; font-weight: 400; color: #475569;"><tr><td style="padding: 0 0 5px 0; width: 45px;">Ngày</td><td style="padding: 0 5px 5px 0; width: 10px;">:</td><td style="padding: 0 0 5px 0; font-weight: 600; color: #1e293b;">${pdfDateStr}</td></tr><tr><td style="padding: 0 0 5px 0;">HSD</td><td style="padding: 0 5px 5px 0;">:</td><td style="padding: 0 0 5px 0;">07 Ngày</td></tr><tr><td style="padding: 0; vertical-align: top;">Dự án</td><td style="padding: 0 5px 0 0; vertical-align: top;">:</td><td style="padding: 0; font-weight: 600; color: #b30000; line-height: 1.3;">${pName}</td></tr></table></div></td></tr></table>
            <p style="font-size: 10pt; color: #475569; margin-bottom: 8px; font-style: italic;">Căn cứ theo yêu cầu của Quý khách hàng, KB trân trọng đề xuất giải pháp và chi phí như sau:</p>
            <table class="premium-table"><thead><tr><th class="center" style="width: 5%;">STT</th><th style="width: 42%;">Hạng mục <span class="quote-muted">/ Description</span></th><th class="center" style="width: 12%;">Bảo hành</th><th class="center" style="width: 8%;">ĐVT</th><th class="center" style="width: 8%;">SL</th><th class="right" style="width: 12%;">Đơn giá</th><th class="right" style="width: 13%;">Thành tiền</th></tr></thead><tbody>${tbodyQuote}</tbody></table>
            <div style="width: 100%; overflow: hidden;"><table class="premium-total-table"><tr><td class="total-label">Tổng cộng <span class="quote-muted">/ Subtotal</span></td><td class="total-value" style="width: 45%; padding-right: 0;">${formatMoney(total)}</td></tr><tr><td class="total-label">Thuế VAT (8%) <span class="quote-muted">/ Tax</span></td><td class="total-value" style="padding-right: 0;">${formatMoney(tax)}</td></tr><tr class="grand-total-row"><td style="text-transform: uppercase;">Tổng Thanh Toán</td><td style="padding-right: 0;">${formatMoney(grandTotal)}</td></tr></table></div>
            <div class="premium-terms"><div class="premium-terms-title">Điều kiện thương mại <span class="quote-muted" style="text-transform: none; font-weight: normal; font-size: 9pt;">/ Commercial Terms</span></div><table style="width: 100%; border-collapse: collapse; table-layout: fixed;"><tr><td style="width: 48%; padding: 0 20px 0 0; vertical-align: top;"><ul><li><strong>Giao hàng:</strong> Trong vòng 3 - 5 ngày làm việc kể từ ngày xác nhận đơn hàng/Hợp đồng. Miễn phí vận chuyển tại khu vực nội thành HCM.</li><li><strong>Địa điểm:</strong> Giao hàng và triển khai trực tiếp tại địa chỉ do Khách hàng chỉ định.</li><li><strong>Bảo hành:</strong> Áp dụng chính sách bảo hành tận nơi theo tiêu chuẩn chính hãng của nhà sản xuất.</li></ul></td><td style="width: 4%; vertical-align: top; padding: 0;"></td><td style="width: 48%; padding: 0 0 0 15px; vertical-align: top; border-left: 1px solid #e2e8f0;"><ul><li><strong>Thanh toán:</strong> Thanh toán tiền mặt hoặc chuyển khoản 100% giá trị đơn hàng trong vòng 01 ngày sau khi hoàn tất giao hàng và nghiệm thu.</li><li><strong style="color: #1e293b;">Thông tin chuyển khoản:</strong><br><span style="display: block; margin-top: 6px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;"><span style="color: #64748b; font-size: 8.5pt;">Số Tài Khoản:</span> <strong class="quote-accent" style="font-size: 11pt;">305258</strong><br><span style="color: #1e293b; font-size: 9pt; font-weight: 600;">Ngân hàng ACB</span> <span style="font-size: 9pt;">(CN Ông Ích Khiêm)</span><br><span style="color: #64748b; font-size: 8.5pt;">Chủ Tài Khoản:</span> <span style="font-size: 9pt; font-weight: 500;">CÔNG TY TNHH TM DV KB</span></span></li></ul></td></tr></table></div>
            <table class="premium-signature"><tr><td><div class="role">ĐẠI DIỆN KB TECH</div><div class="hint">Representative</div></td><td><div class="role">XÁC NHẬN TỪ KHÁCH HÀNG</div><div class="hint">Customer Approval</div></td></tr><tr><td style="height: 120px;"></td><td></td></tr></table>
        </div>

        <div class="print-divider page-break w-full border-t-2 border-dashed border-slate-300 my-10 py-5 text-center text-slate-400 text-xs font-semibold tracking-widest no-print">CUT HERE / NEXT PAGE</div>

        <div id="contract-section" class="doc-wrapper">
            <div style="text-align: center; margin-bottom: 20px;"><h3 style="margin: 0; font-weight: bold; font-size: 14pt;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3><p style="margin: 0; font-weight: bold; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</p><p style="margin: 5px 0 15px 0;">----------o0o-----------</p><h2 style="margin: 0; font-weight: bold; font-size: 16pt;">HỢP ĐỒNG MUA BÁN VÀ DỊCH VỤ</h2><p style="margin: 0; font-style: italic;">Số: ${cNo}</p></div>
            <div><p><b>Căn cứ vào:</b></p><p>- Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 và các văn bản pháp luật liên quan;</p><p>- Luật Thương mại số 36/2005/QH11 ngày 14/06/2005 và các văn bản pháp luật liên quan;</p><p>- Nhu cầu và khả năng của các Bên;</p></div>
            <p style="margin-top: 15px;">Hôm nay, ${dateString}, tại TP. Hồ Chí Minh</p><p><b>Chúng tôi gồm có:</b></p>
            <div style="margin-bottom: 10px;"><p><b><u>BÊN MUA (Bên A)</u> : ${bName}</b></p><table style="border: none; width: 100%; margin: 0;"><tr><td style="border: none; padding: 2px; width: 120px;">Địa chỉ</td><td style="border: none; padding: 2px;">: ${bAddress}</td></tr><tr><td style="border: none; padding: 2px;">Mã số thuế</td><td style="border: none; padding: 2px;">: ${bTax}</td></tr><tr><td style="border: none; padding: 2px;">Điện thoại</td><td style="border: none; padding: 2px;">: ${bPhone !== '' ? bPhone : '........................................'}</td></tr><tr><td style="border: none; padding: 2px;">Đại diện bởi</td><td style="border: none; padding: 2px;">: <b>${bRep}</b></td></tr><tr><td style="border: none; padding: 2px;">Chức vụ</td><td style="border: none; padding: 2px;">: ${bRole}</td></tr></table></div>
            <div style="margin-bottom: 15px;"><p><b><u>BÊN BÁN (Bên B)</u> : CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ KB</b></p><table style="border: none; width: 100%; margin: 0;"><tr><td style="border: none; padding: 2px; width: 120px;">Địa chỉ</td><td style="border: none; padding: 2px;">: 341/25S – 341/26S Lạc Long Quân, Phường Hoà Bình , TP. Hồ Chí Minh</td></tr><tr><td style="border: none; padding: 2px;">Mã số thuế</td><td style="border: none; padding: 2px;">: 0317726344</td></tr><tr><td style="border: none; padding: 2px;">Điện thoại</td><td style="border: none; padding: 2px;">: 0933 129 155</td></tr><tr><td style="border: none; padding: 2px;">Đại diện bởi</td><td style="border: none; padding: 2px;">: <b>Ông LÊ TUẤN HẢI</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</td></tr><tr><td style="border: none; padding: 2px;">Tài khoản số</td><td style="border: none; padding: 2px;">: 305258 - Tại: Ngân hàng TMCP Á Châu - CN Ông Ích Khiêm</td></tr></table></div>
            <p><b>ĐIỀU 1: TÊN DỊCH VỤ - GIÁ TRỊ HỢP ĐỒNG</b></p>
            <table>
                <tr><th style="width: 5%; border: 1px solid black; padding: 6px;">STT</th><th style="width: 35%; border: 1px solid black; padding: 6px;">SẢN PHẨM</th><th style="width: 15%; border: 1px solid black; padding: 6px;">BẢO HÀNH</th><th style="width: 10%; border: 1px solid black; padding: 6px;">ĐVT</th><th style="width: 15%; border: 1px solid black; padding: 6px;">ĐƠN GIÁ (VNĐ)</th><th style="width: 5%; border: 1px solid black; padding: 6px;">SL</th><th style="width: 15%; border: 1px solid black; padding: 6px;">THÀNH TIỀN</th></tr>
                ${tbodyHD}
                <tr><td colspan="6" style="text-align: right; font-weight: bold; border: 1px solid black; padding: 6px;">TỔNG CỘNG</td><td class="money-cell" style="font-weight: bold; border: 1px solid black; padding: 6px;">${formatMoney(total)}</td></tr>
                <tr><td colspan="6" style="text-align: right; font-weight: bold; border: 1px solid black; padding: 6px;">THUẾ 8%</td><td class="money-cell" style="font-weight: bold; border: 1px solid black; padding: 6px;">${formatMoney(tax)}</td></tr>
                <tr><td colspan="6" style="text-align: right; font-weight: bold; border: 1px solid black; padding: 6px;">THÀNH TIỀN</td><td class="money-cell" style="font-weight: bold; border: 1px solid black; padding: 6px;">${formatMoney(grandTotal)}</td></tr>
            </table>
            <p><b>ĐIỀU 2: THỜI HẠN HỢP ĐỒNG</b></p><p>Hợp đồng thanh lý ngay sau khi 2 bên hoàn thành nghĩa vụ được quy định tại điều 5, 6.</p>
            <p><b>ĐIỀU 3: THỜI HẠN VÀ PHƯƠNG THỨC THANH TOÁN</b></p><p>Bên A thanh toán cho Bên B bằng hình thức chuyển khoản theo lộ trình sau:</p>${paymentText}
            <p><b>ĐIỀU 4: THỜI ĐIỂM VÀ ĐỊA ĐIỂM CHUYỂN GIAO HÀNG HÓA</b></p><p>- Thời gian giao hàng: 03 (ba) ngày làm việc kể từ ngày hai bên ký kết hợp đồng.</p><p>- Địa điểm chuyển giao: ${deliveryAddress}.</p>
            <p><b>ĐIỀU 5: NGHĨA VỤ CỦA BÊN BÁN (BÊN B)</b></p><p>- Cung cấp đúng theo yêu cầu của Bên A về mẫu mã đã ký duyệt. Bên B có trách nhiệm cung cấp hàng hóa cho Bên A theo đúng số lượng, chất lượng, thời gian thỏa thuận và bảo hành bảo trì khi có sự cố.</p>
            <p><b>ĐIỀU 6: NGHĨA VỤ CỦA BÊN MUA (BÊN A)</b></p><p>- Đảm bảo thanh toán đúng thời hạn và tạo điều kiện thuận lợi để Bên B tiến hành lắp đặt. Kiểm tra số lượng và chất lượng ngay khi nhận hàng, nếu trong vòng 03 ngày không phản hồi xem như Bên B đã hoàn thành trách nhiệm.</p>
            <p><b>ĐIỀU 7: ĐIỀU KHOẢN CHUNG</b></p><p>Hợp đồng này được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.</p>
            <table style="border: none; width: 100%; margin-top: 20px;"><tr><td style="border: none; text-align: center; width: 50%;"><b>ĐẠI DIỆN BÊN A</b></td><td style="border: none; text-align: center; width: 50%;"><b>ĐẠI DIỆN BÊN B</b></td></tr><tr><td style="border: none; height: 100px;"></td><td style="border: none; height: 100px;"></td></tr><tr><td style="border: none; text-align: center;"><b>${bRep === '..............................' ? '' : bRep}</b></td><td style="border: none; text-align: center;"><b>LÊ TUẤN HẢI</b></td></tr></table>
        </div>

        <div class="print-divider page-break w-full border-t-2 border-dashed border-slate-300 my-10 py-5 text-center text-slate-400 text-xs font-semibold tracking-widest no-print">CUT HERE / NEXT PAGE</div>

        <div id="acceptance-section" class="doc-wrapper">
            <div style="text-align: center; margin-bottom: 20px;"><h3 style="margin: 0; font-weight: bold; font-size: 14pt;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3><p style="margin: 0; font-weight: bold; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</p><p style="margin: 5px 0 15px 0;">----------o0o-----------</p><h2 style="margin: 0; font-weight: bold; font-size: 16pt;">BIÊN BẢN BÀN GIAO & NGHIỆM THU</h2><p style="margin: 0; font-style: italic;">Căn cứ Hợp đồng số: ${cNo}</p></div>
            <p style="margin-top: 15px;">Hôm nay, ${dateString}, tại địa điểm: ${deliveryAddress}. Chúng tôi gồm có:</p>
            <p style="margin-top: 10px;"><b><u>BÊN GIAO (BÊN B)</u> : CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ KB</b></p><p>Đại diện: <b>Ông LÊ TUẤN HẢI</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: Giám đốc</p>
            <p style="margin-top: 10px;"><b><u>BÊN NHẬN (BÊN A)</u> : ${bName}</b></p><p>Đại diện: <b>${bRep}</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: ${bRole}</p>
            <p style="margin-top: 15px;">Hai bên cùng thống nhất tiến hành bàn giao và nghiệm thu các hạng mục thiết bị/dịch vụ sau:</p>
            <table><tr><th style="width: 5%; border: 1px solid black; padding: 6px;">STT</th><th style="width: 45%; border: 1px solid black; padding: 6px;">TÊN HÀNG HÓA / DỊCH VỤ</th><th style="width: 10%; border: 1px solid black; padding: 6px;">ĐVT</th><th style="width: 10%; border: 1px solid black; padding: 6px;">SL</th><th style="width: 30%; border: 1px solid black; padding: 6px;">TÌNH TRẠNG</th></tr>${tbodyNT}</table>
            <p><b>Kết luận:</b></p><p>- Bên B đã tiến hành bàn giao đầy đủ số lượng thiết bị, phụ kiện và hoàn tất các dịch vụ triển khai theo đúng Hợp đồng.</p><p>- Hàng hóa mới 100%, hoạt động ổn định, đủ điều kiện đưa vào sử dụng thực tế.</p><p>- Bên A đồng ý nghiệm thu toàn bộ hệ thống kể từ ngày ký biên bản này.</p><p>Biên bản được lập thành hai (02) bản có giá trị như nhau, mỗi bên giữ một (01) bản để làm cơ sở thanh lý hợp đồng.</p>
            <table style="border: none; width: 100%; margin-top: 20px;"><tr><td style="border: none; text-align: center; width: 50%;"><b>ĐẠI DIỆN BÊN NHẬN (BÊN A)</b></td><td style="border: none; text-align: center; width: 50%;"><b>ĐẠI DIỆN BÊN GIAO (BÊN B)</b></td></tr><tr><td style="border: none; height: 100px;"></td><td style="border: none; height: 100px;"></td></tr><tr><td style="border: none; text-align: center;"><b>${bRep}</b></td><td style="border: none; text-align: center;"><b>LÊ TUẤN HẢI</b></td></tr></table>
        </div>
    `;
    
    const docPreview = document.getElementById('documentPreview');
    if (docPreview) {
        docPreview.innerHTML = html;
    }
}