# Caro Token

Nền tảng quản lý và giao dịch tài sản số hóa (Real World Asset - RWA) dựa trên mô hình token hóa sản phẩm cà phê.

## Giới thiệu

Caro Token là hệ thống mô phỏng nền tảng token hóa tài sản thực (RWA), cho phép:

- Đăng ký và xác thực người dùng thông qua giao diện VNeID mô phỏng.
- Quản lý tài sản cà phê được token hóa.
- Theo dõi danh mục đầu tư.
- Mua bán và chuyển nhượng token.
- Theo dõi giá trị tài sản theo thời gian.
- Quản trị hệ thống thông qua Dashboard quản lý.

Dự án được xây dựng nhằm nghiên cứu và trình diễn mô hình ứng dụng Blockchain trong lĩnh vực nông nghiệp và tài sản thực.

---

## Công nghệ sử dụng

### Frontend

- ReactJS
- React Router DOM
- Tailwind CSS
- Vite
- Axios

### Backend

- Node.js
- ExpressJS
- JWT Authentication
- MySQL

### Blockchain (Mô phỏng)

- Smart Contract Architecture
- Tokenized Asset Model
- Wallet & Transaction Flow Simulation

---

## Chức năng chính

### Người dùng

- Đăng ký tài khoản
- Đăng nhập
- Xác thực VNeID (mô phỏng QR Code)
- Xem danh mục token
- Mua token
- Bán token
- Theo dõi lịch sử giao dịch
- Quản lý hồ sơ cá nhân

### Quản trị viên

- Quản lý người dùng
- Quản lý tài sản RWA
- Quản lý đợt phát hành token
- Quản lý giao dịch
- Thống kê hệ thống

---

## Kiến trúc hệ thống

```text
Frontend (React)
        │
        ▼
REST API (ExpressJS)
        │
 ┌──────┼──────┐
 ▼      ▼      ▼
MySQL  Auth  Asset Service
               │
               ▼
      Tokenization Engine
```

---

## Cài đặt

### Clone source

```bash
git clone git@github.com:ninggnee/caro-token.git
cd caro-token
```

### Cài đặt Frontend

```bash
npm install
npm run dev
```

### Cài đặt Backend

```bash
cd backend
npm install
npm run dev
```

---

## Cấu hình môi trường

Sao chép `backend/.env.example` thành `backend/.env` rồi điền giá trị thật.
File `.env` **không bao giờ** được commit.

```env
PORT=5000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=caro_token
DB_USER=root
DB_PASSWORD=password

# Bắt buộc — server không khởi động nếu để trống
JWT_SECRET=your_secret_key

# Bắt buộc cho KYC — mã hoá AES-256-GCM ảnh CCCD khi lưu trên đĩa
# Tạo: openssl rand -hex 32
KYC_ENCRYPTION_KEY=your_64_hex_char_key

# Origin được phép gọi API (phân tách bằng dấu phẩy)
CORS_ORIGINS=http://localhost:5173
```

### Bảo mật hồ sơ KYC

Ảnh CCCD được mã hoá AES-256-GCM trước khi ghi xuống đĩa và **không** được phục
vụ qua `/uploads`. Cách duy nhất để xem là `GET /api/kyc/image/:id/:side`, yêu
cầu token hợp lệ và chỉ cho phép chính chủ hồ sơ hoặc admin.

Nếu đã có ảnh cũ lưu dạng plaintext, chạy migration một lần:

```bash
cd backend
node scripts/encryptExistingKyc.js --dry-run   # xem trước
node scripts/encryptExistingKyc.js             # thực hiện
```

> ⚠️ Mất `KYC_ENCRYPTION_KEY` đồng nghĩa mất toàn bộ hồ sơ KYC đã lưu. Hãy sao
> lưu khoá ở nơi an toàn, ngoài git.

---

## Tài khoản Demo

### Admin

```text
Email: admin@caro.vn
Password: Admin123!
```

---

## Lưu ý

- Chức năng VNeID trong dự án chỉ mang tính chất mô phỏng giao diện và luồng xác thực.
- Không kết nối với hệ thống VNeID thực tế.
- Không thực hiện giao dịch Blockchain thực tế.

---

## Roadmap

- [ ] Tích hợp ví blockchain
- [ ] Smart Contract ERC-20
- [ ] Token Marketplace
- [ ] KYC điện tử
- [ ] Kết nối dữ liệu tài sản thực
- [ ] Dashboard phân tích đầu tư

---

## Tác giả

Developed by Ninggnee

GitHub:
https://github.com/ninggnee
