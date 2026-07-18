require('dotenv').config();

const dns = require('dns');
// Một số máy Windows không phân giải được bản ghi SRV của MongoDB Atlas
// qua DNS mặc định của hệ thống dù DNS vẫn hoạt động bình thường (lỗi
// "querySrv ECONNREFUSED"). Chuyển sang DNS công cộng để tránh lỗi này.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;

const ROOT = __dirname;
const DEPARTMENTS_FILE = path.join(ROOT, 'data', 'departments.json');
const PORT = process.env.PORT || 3000;

const REQUIRED_ENV = [
  'MONGODB_URI',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Thiếu biến môi trường: ${missingEnv.join(', ')}. Xem file .env.example.`);
  process.exit(1);
}

const departments = JSON.parse(fs.readFileSync(DEPARTMENTS_FILE, 'utf8'));
const departmentIds = new Set(departments.map((d) => d.id));
const departmentById = new Map(departments.map((d) => [d.id, d]));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, webp, gif)'));
    }
    cb(null, true);
  },
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'ql-don', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

function serializeOrder(doc) {
  return {
    id: doc._id.toString(),
    departmentId: doc.departmentId,
    departmentName: departmentById.get(doc.departmentId)?.name || '',
    note: doc.note || '',
    reason: doc.reason || '',
    imagePath: doc.imageUrl,
    status: doc.status,
    createdAt: doc.createdAt,
  };
}

async function main() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  await mongoClient.connect();
  const ordersCollection = mongoClient.db('ql_don').collection('orders');
  console.log('Da ket noi MongoDB.');

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(ROOT, 'public')));

  app.get('/api/departments', async (req, res) => {
    const docs = await ordersCollection
      .find({}, { projection: { departmentId: 1, status: 1 } })
      .toArray();

    const counts = {};
    for (const o of docs) {
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

  app.get('/api/orders', async (req, res) => {
    const { departmentId, status, from, to } = req.query;
    const filter = {};

    if (departmentId) filter.departmentId = departmentId;
    if (status && ['hoan_thanh', 'chua_hoan_thanh'].includes(status)) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00`).toISOString();
      if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999`).toISOString();
    }

    const docs = await ordersCollection.find(filter).sort({ createdAt: -1 }).toArray();
    res.json(docs.map(serializeOrder));
  });

  app.post('/api/orders', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
    if (!req.body.departmentId || !departmentIds.has(req.body.departmentId)) {
      return res.status(400).json({ error: 'Thiếu hoặc sai Khoa/Phòng' });
    }

    try {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      const doc = {
        departmentId: req.body.departmentId,
        note: (req.body.note || '').slice(0, 500),
        reason: '',
        imageUrl: uploadResult.secure_url,
        imagePublicId: uploadResult.public_id,
        status: 'chua_hoan_thanh',
        createdAt: new Date().toISOString(),
      };
      const { insertedId } = await ordersCollection.insertOne(doc);
      doc._id = insertedId;
      res.status(201).json(serializeOrder(doc));
    } catch (err) {
      res.status(500).json({ error: 'Lỗi tải ảnh lên: ' + err.message });
    }
  });

  app.patch('/api/orders/:id', async (req, res) => {
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(404).json({ error: 'Không tìm thấy đơn' });
    }

    const update = {};
    if (req.body.status && ['hoan_thanh', 'chua_hoan_thanh'].includes(req.body.status)) {
      update.status = req.body.status;
    }
    if (typeof req.body.note === 'string') update.note = req.body.note.slice(0, 500);
    if (typeof req.body.reason === 'string') update.reason = req.body.reason.slice(0, 500);

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Không có gì để cập nhật' });
    }

    await ordersCollection.updateOne({ _id: objectId }, { $set: update });
    const doc = await ordersCollection.findOne({ _id: objectId });
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    res.json(serializeOrder(doc));
  });

  app.delete('/api/orders/:id', async (req, res) => {
    let objectId;
    try {
      objectId = new ObjectId(req.params.id);
    } catch {
      return res.status(404).json({ error: 'Không tìm thấy đơn' });
    }

    const doc = await ordersCollection.findOne({ _id: objectId });
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy đơn' });
    if (doc.status === 'hoan_thanh') {
      return res.status(400).json({ error: 'Không thể xóa đơn đã hoàn thành' });
    }

    await ordersCollection.deleteOne({ _id: objectId });
    if (doc.imagePublicId) {
      cloudinary.uploader.destroy(doc.imagePublicId).catch(() => {});
    }
    res.json({ ok: true });
  });

  app.use((err, req, res, next) => {
    res.status(400).json({ error: err.message || 'Lỗi không xác định' });
  });

  app.listen(PORT, () => {
    console.log(`Quan ly don dang chay tai http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Khong the khoi dong server:', err);
  process.exit(1);
});
