const screenOrders = document.getElementById('screen-orders');
const screenSearch = document.getElementById('screen-search');
const deptGroupsEl = document.getElementById('dept-groups');
const deptSearch = document.getElementById('dept-search');
const deptTotalCount = document.getElementById('dept-total-count');
const deptNameEl = document.getElementById('dept-name');
const openSearchBtn = document.getElementById('open-search-btn');
const homeBtn = document.getElementById('home-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const menuToggleBtn = document.getElementById('menu-toggle-btn');

const form = document.getElementById('upload-form');
const imageInput = document.getElementById('image-input');
const fileDrop = document.getElementById('file-drop');
const fileLabel = document.getElementById('file-label');
const preview = document.getElementById('preview');
const noteInput = document.getElementById('note-input');
const submitBtn = document.getElementById('submit-btn');
const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const countEl = document.getElementById('count');
const filtersEl = document.getElementById('filters');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

const pagination = document.getElementById('pagination');
const pagePrev = document.getElementById('page-prev');
const pageNext = document.getElementById('page-next');
const pageInfo = document.getElementById('page-info');

const searchFrom = document.getElementById('search-from');
const searchTo = document.getElementById('search-to');
const searchStatus = document.getElementById('search-status');
const searchBtn = document.getElementById('search-btn');
const searchResetBtn = document.getElementById('search-reset-btn');
const searchGrid = document.getElementById('search-grid');
const searchEmpty = document.getElementById('search-empty');
const searchCountEl = document.getElementById('search-count');
const searchPagination = document.getElementById('search-pagination');
const searchPagePrev = document.getElementById('search-page-prev');
const searchPageNext = document.getElementById('search-page-next');
const searchPageInfo = document.getElementById('search-page-info');

const PAGE_SIZE = 10;

let departments = [];
let orders = [];
let currentDepartment = null;
let currentFilter = 'all';
let currentPage = 1;
let currentView = 'search'; // 'orders' | 'search'

let searchResults = [];
let searchPage = 1;

const STATUS_LABEL = {
  hoan_thanh: 'Hoàn thành',
  chua_hoan_thanh: 'Chưa hoàn thành',
};

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN');
}

// ---------- Sidebar: danh sách Khoa/Phòng ----------

async function loadDepartments() {
  const res = await fetch('/api/departments');
  departments = await res.json();
  renderDepartments();
}

function renderDepartments() {
  const keyword = deptSearch.value.trim().toLowerCase();
  const filtered = departments.filter((d) => d.name.toLowerCase().includes(keyword));

  deptTotalCount.textContent = `${departments.length} Khoa/Phòng`;
  deptGroupsEl.innerHTML = '';

  const groupOrder = [...new Set(filtered.map((d) => d.group))];
  for (const group of groupOrder) {
    const items = filtered.filter((d) => d.group === group);
    if (items.length === 0) continue;

    const heading = document.createElement('div');
    heading.className = 'sidebar-group-title';
    heading.textContent = group;
    deptGroupsEl.appendChild(heading);

    for (const d of items) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'sidebar-dept-item';
      if (currentView === 'orders' && currentDepartment && currentDepartment.id === d.id) {
        item.classList.add('active');
      }

      const name = document.createElement('span');
      name.className = 'sidebar-dept-name';
      name.textContent = d.name;

      const stats = document.createElement('span');
      stats.className = 'sidebar-dept-stats';
      stats.innerHTML = `
        <span class="mini-badge chua_hoan_thanh">${d.chuaHoanThanh} chưa xong</span>
        <span class="mini-badge hoan_thanh">${d.hoanThanh} hoàn thành</span>
      `;

      item.append(name, stats);
      item.addEventListener('click', () => openDepartment(d));
      deptGroupsEl.appendChild(item);
    }
  }
}

deptSearch.addEventListener('input', renderDepartments);

function showScreen(view) {
  currentView = view;
  screenOrders.hidden = view !== 'orders';
  screenSearch.hidden = view !== 'search';
  openSearchBtn.classList.toggle('active', view === 'search');
}

function openDepartment(dept) {
  currentDepartment = dept;
  currentFilter = 'all';
  currentPage = 1;
  deptNameEl.textContent = dept.name;
  showScreen('orders');
  [...filtersEl.children].forEach((b) => b.classList.toggle('active', b.dataset.filter === 'all'));
  renderDepartments();
  loadOrders();
  closeSidebar();
}

homeBtn.addEventListener('click', () => {
  currentDepartment = null;
  showScreen('search');
  renderDepartments();
  performSearch();
  closeSidebar();
});

openSearchBtn.addEventListener('click', () => {
  currentDepartment = null;
  showScreen('search');
  renderDepartments();
  performSearch();
  closeSidebar();
});

// ---------- Menu trượt (sidebar) trên màn hình nhỏ ----------

function openSidebar() {
  sidebar.classList.add('open');
  sidebar.style.transform = 'translateX(0)';
  sidebarOverlay.hidden = false;
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebar.style.transform = '';
  sidebarOverlay.hidden = true;
}

menuToggleBtn.addEventListener('click', openSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// ---------- Màn hình quản lý đơn theo Khoa/Phòng ----------

async function loadOrders() {
  if (!currentDepartment) return;
  const res = await fetch(`/api/orders?departmentId=${encodeURIComponent(currentDepartment.id)}`);
  orders = await res.json();
  render();
}

function render() {
  const filtered = currentFilter === 'all'
    ? orders
    : orders.filter((o) => o.status === currentFilter);

  countEl.textContent = `${filtered.length} đơn`;
  currentPage = renderOrderPage(filtered, currentPage, {
    gridEl: grid,
    emptyEl: empty,
    paginationEl: pagination,
    pagePrevEl: pagePrev,
    pageNextEl: pageNext,
    pageInfoEl: pageInfo,
    showDept: false,
    list: orders,
    onChange: render,
  });
}

async function saveReason(order, value) {
  const trimmed = value.slice(0, 500);
  if (trimmed === (order.reason || '')) return;
  const res = await fetch(`/api/orders/${order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: trimmed }),
  });
  if (res.ok) {
    order.reason = trimmed;
  }
}

function buildShareText(order) {
  const lines = [
    `Khoa/Phòng: ${order.departmentName || ''}`,
    `Ghi chú: ${order.note || '(không có)'}`,
  ];
  if (order.reason) lines.push(`Lý do chưa hoàn thành: ${order.reason}`);
  lines.push(`Ngày tạo: ${fmtDate(order.createdAt)}`);
  return lines.join('\n');
}

async function shareOrder(order, btn) {
  const text = buildShareText(order);
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Đang chuẩn bị...';

  try {
    const imgRes = await fetch(order.imagePath);
    const blob = await imgRes.blob();
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const file = new File([blob], `don-de-nghi.${ext}`, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
    } else if (navigator.share) {
      await navigator.share({ text, url: order.imagePath });
    } else {
      let copied = false;
      try {
        await navigator.clipboard.writeText(`${text}\nẢnh: ${order.imagePath}`);
        copied = true;
      } catch {
        // Sao chép thất bại (trình duyệt chặn) - vẫn mở ảnh để người dùng tự lưu/chia sẻ.
      }
      alert(copied
        ? 'Trình duyệt này không hỗ trợ chia sẻ trực tiếp. Đã sao chép thông tin đơn, bạn dán vào Zalo và tự đính kèm ảnh nhé.'
        : 'Trình duyệt này không hỗ trợ chia sẻ trực tiếp. Ảnh đơn sẽ mở ở tab mới, bạn tự lưu và gửi qua Zalo nhé.');
      window.open(order.imagePath, '_blank');
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      alert('Không chia sẻ được: ' + err.message);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

async function toggleStatus(order, list, onChange) {
  const nextStatus = order.status === 'hoan_thanh' ? 'chua_hoan_thanh' : 'hoan_thanh';
  const res = await fetch(`/api/orders/${order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: nextStatus }),
  });
  if (res.ok) {
    order.status = nextStatus;
    onChange();
    loadDepartments();
  }
}

async function deleteOrder(order, list, onChange) {
  if (!confirm('Xóa đơn này?')) return;
  const res = await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
  if (res.ok) {
    const idx = list.indexOf(order);
    if (idx !== -1) list.splice(idx, 1);
    onChange();
    loadDepartments();
  }
}

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.hidden = false;
}

lightbox.addEventListener('click', () => {
  lightbox.hidden = true;
  lightboxImg.src = '';
});

// ---------- Tạo 1 thẻ đơn (dùng chung cho cả 2 màn hình) ----------

function createOrderCard(order, { showDept, list, onChange }) {
  const card = document.createElement('div');
  card.className = 'order-card';

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  img.src = order.imagePath;
  img.alt = 'Ảnh đơn';
  img.addEventListener('click', () => openLightbox(order.imagePath));
  thumb.appendChild(img);

  const body = document.createElement('div');
  body.className = 'body';

  if (showDept && order.departmentName) {
    const deptTag = document.createElement('div');
    deptTag.className = 'order-dept-tag';
    deptTag.textContent = order.departmentName;
    body.appendChild(deptTag);
  }

  const badge = document.createElement('span');
  badge.className = `badge ${order.status}`;
  badge.textContent = STATUS_LABEL[order.status];

  const note = document.createElement('div');
  note.className = 'order-note';
  note.textContent = order.note || '(không có ghi chú)';

  const date = document.createElement('div');
  date.className = 'order-date';
  date.textContent = fmtDate(order.createdAt);

  const reasonLabel = document.createElement('label');
  reasonLabel.className = 'reason-label';
  reasonLabel.textContent = 'Lý do chưa hoàn thành';

  const reasonInput = document.createElement('textarea');
  reasonInput.className = 'reason-input';
  reasonInput.placeholder = 'Ghi lý do chưa hoàn thành (nếu có)...';
  reasonInput.value = order.reason || '';
  reasonInput.maxLength = 500;
  reasonInput.addEventListener('blur', () => saveReason(order, reasonInput.value));

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'toggle-btn';
  toggleBtn.textContent = order.status === 'hoan_thanh'
    ? 'Đánh dấu chưa hoàn thành'
    : 'Đánh dấu hoàn thành';
  toggleBtn.addEventListener('click', () => toggleStatus(order, list, onChange));

  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn';
  shareBtn.textContent = '📤 Chia sẻ';
  shareBtn.addEventListener('click', () => shareOrder(order, shareBtn));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-btn';
  deleteBtn.textContent = '✕';
  deleteBtn.title = 'Xóa đơn';
  deleteBtn.addEventListener('click', () => deleteOrder(order, list, onChange));

  actions.append(toggleBtn, shareBtn, deleteBtn);
  body.append(badge, note, date, reasonLabel, reasonInput, actions);
  card.append(thumb, body);
  return card;
}

// ---------- Phân trang dùng chung ----------

function renderOrderPage(filtered, page, opts) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;

  const start = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  opts.gridEl.innerHTML = '';
  opts.emptyEl.hidden = filtered.length !== 0;
  opts.paginationEl.hidden = filtered.length <= PAGE_SIZE;
  opts.pageInfoEl.textContent = `Trang ${page} / ${totalPages}`;
  opts.pagePrevEl.disabled = page <= 1;
  opts.pageNextEl.disabled = page >= totalPages;

  for (const order of pageItems) {
    opts.gridEl.appendChild(createOrderCard(order, {
      showDept: opts.showDept,
      list: opts.list,
      onChange: opts.onChange,
    }));
  }

  return page;
}

pagePrev.addEventListener('click', () => {
  currentPage -= 1;
  render();
});

pageNext.addEventListener('click', () => {
  currentPage += 1;
  render();
});

filtersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  currentPage = 1;
  [...filtersEl.children].forEach((b) => b.classList.toggle('active', b === btn));
  render();
});

// ---------- Màn hình tìm kiếm toàn cục ----------

async function performSearch() {
  const params = new URLSearchParams();
  if (searchFrom.value) params.set('from', searchFrom.value);
  if (searchTo.value) params.set('to', searchTo.value);
  if (searchStatus.value !== 'all') params.set('status', searchStatus.value);

  const res = await fetch(`/api/orders?${params.toString()}`);
  searchResults = await res.json();
  searchPage = 1;
  renderSearch();
}

function renderSearch() {
  searchCountEl.textContent = `${searchResults.length} đơn`;
  searchPage = renderOrderPage(searchResults, searchPage, {
    gridEl: searchGrid,
    emptyEl: searchEmpty,
    paginationEl: searchPagination,
    pagePrevEl: searchPagePrev,
    pageNextEl: searchPageNext,
    pageInfoEl: searchPageInfo,
    showDept: true,
    list: searchResults,
    onChange: renderSearch,
  });
}

searchBtn.addEventListener('click', performSearch);

searchResetBtn.addEventListener('click', () => {
  searchFrom.value = '';
  searchTo.value = '';
  searchStatus.value = 'all';
  performSearch();
});

searchPagePrev.addEventListener('click', () => {
  searchPage -= 1;
  renderSearch();
});

searchPageNext.addEventListener('click', () => {
  searchPage += 1;
  renderSearch();
});

// ---------- Upload ảnh đơn ----------

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  fileLabel.textContent = file.name;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
});

['dragover', 'dragenter'].forEach((ev) => {
  fileDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    fileDrop.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach((ev) => {
  fileDrop.addEventListener(ev, (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
  });
});
fileDrop.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  imageInput.files = e.dataTransfer.files;
  imageInput.dispatchEvent(new Event('change'));
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentDepartment) return;
  const file = imageInput.files[0];
  if (!file) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Đang tải lên...';

  const fd = new FormData();
  fd.append('image', file);
  fd.append('note', noteInput.value);
  fd.append('departmentId', currentDepartment.id);

  try {
    const res = await fetch('/api/orders', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Có lỗi khi tải lên');
      return;
    }
    const newOrder = await res.json();
    orders.unshift(newOrder);
    currentPage = 1;
    render();
    loadDepartments();
    form.reset();
    fileLabel.textContent = 'Chọn hoặc kéo thả ảnh đơn vào đây';
    preview.hidden = true;
    preview.src = '';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Tải lên';
  }
});

loadDepartments();
performSearch();
