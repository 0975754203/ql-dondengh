const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'orders.json');
const DEPARTMENTS_FILE = path.join(ROOT, 'data', 'departments.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

const departments = JSON.parse(fs.readFileSync(DEPARTMENTS_FILE, 'utf8'));
const departmentIds = new Set(departments.map((d) => d.id));

function readOrders() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${id}${ext}`);
  },
});

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, webp, gif)'));
    }
    cb(null, true);
  },
});

const app = express();
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/api/departments', (req, res) => {
  const orders = readOrders();
  const counts = {};
  for (const o of orders) {
    if (!counts[o.departmentId]) counts[o.departmentId] = { hoan_thanh: 0, chua_hoan_thanh: 0 };
    counts[o.departmentId][o.status] += 1;
  }
  const result = departments.map((d) => {
    const c = counts[d.id] || { hoan_thanh: 0, chua_hoan_thanh: 0 };
    return {
      ...d,
      hoanThanh: c.hoan_thanh,
      chuaHoanThanh: c.chua_hoan_thanh,
      total: c.hoan_thanh + c.chua_hoan_thanh,
    };
  });
  res.json(result);
});

const departmentById = new Map(departments.map((d) => [d.id, d]));

app.get('/api/orders', (req, res) => {
  let orders = readOrders();
  const { departmentId, status, from, to } = req.query;

  if (departmentId) {
    orders = orders.filter((o) => o.departmentId === departmentId);
  }
  if (status && ['hoan_thanh', 'chua_hoan_thanh'].includes(status)) {
    orders = orders.filter((o) => o.status === status);
  }
  if (from) {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    orders = orders.filter((o) => new Date(o.createdAt).getTime() >= fromTime);
  }
  if (to) {
    const toTime = new Date(`${to}T23:59:59.999`).getTime();
    orders = orders.filter((o) => new Date(o.createdAt).getTime() <= toTime);
  }

  orders = orders
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => ({ ...o, departmentName: departmentById.get(o.departmentId)?.name || '' }));

  res.json(orders);
});

app.post('/api/orders', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
  if (!req.body.departmentId || !departmentIds.has(req.body.departmentId)) {
    return res.status(400).json({ error: 'Thiếu hoặc sai Khoa/Phòng' });
  }
  const orders = readOrders();
  const order = {
    id: crypto.randomUUID(),
    departmentId: req.body.departmentId,
    note: (req.body.note || '').slice(0, 500),
    reason: '',
    imagePath: `/uploads/${req.file.filename}`,
    status: 'chua_hoan_thanh',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  writeOrders(orders);
  res.status(201).json(order);
});

app.patch('/api/orders/:id', (req, res) => {
  const orders = readOrders();
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn' });
  if (req.body.status && ['hoan_thanh', 'chua_hoan_thanh'].includes(req.body.status)) {
    order.status = req.body.status;
  }
  if (typeof req.body.note === 'string') {
    order.note = req.body.note.slice(0, 500);
  }
  if (typeof req.body.reason === 'string') {
    order.reason = req.body.reason.slice(0, 500);
  }
  writeOrders(orders);
  res.json(order);
});

app.delete('/api/orders/:id', (req, res) => {
  const orders = readOrders();
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy đơn' });
  const [order] = orders.splice(idx, 1);
  writeOrders(orders);
  const filePath = path.join(ROOT, order.imagePath.replace(/^\//, ''));
  fs.unlink(filePath, () => {});
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  res.status(400).json({ error: err.message || 'Lỗi không xác định' });
});

app.listen(PORT, () => {
  console.log(`Quan ly don dang chay tai http://localhost:${PORT}`);
});
