#!/bin/bash
# Setup script — tạo database caro_token và import tất cả bảng
# Chạy từ thư mục gốc: bash setup_db.sh

MYSQL_USER="root"
MYSQL_PASS="123456"
DB_NAME="caro_token"
MYSQL="mysql -u$MYSQL_USER -p$MYSQL_PASS"

echo "=== Tạo database $DB_NAME ==="
$MYSQL -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
if [ $? -ne 0 ]; then
  echo "❌ Không kết nối được MySQL. Kiểm tra password hoặc MySQL đang chạy chưa."
  exit 1
fi
echo "✅ Database tạo xong"

echo ""
echo "=== Import bảng ==="

# Thứ tự quan trọng: users trước, sau đó các bảng phụ thuộc
FILES=(
  "sql/caro_token_users.sql"
  "sql/caro_token_wallets.sql"
  "sql/caro_token_sessions.sql"
  "sql/caro_token_user_balances.sql"
  "sql/caro_token_user_wallets.sql"
  "sql/caro_token_kyc_requests.sql"
  "sql/caro_token_token_requests.sql"
  "sql/caro_token_mint_history.sql"
  "sql/caro_token_trades.sql"
  "sql/caro_token_redeem_requests.sql"
  "sql/caro_token_audit_logs.sql"
  "sql/caro_token_routines.sql"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo -n "  Importing $f ... "
    $MYSQL "$DB_NAME" < "$f"
    echo "✅"
  else
    echo "  ⚠️  File không tồn tại: $f"
  fi
done

echo ""
echo "=== Chạy migrations ==="
$MYSQL "$DB_NAME" < backend/migrations/init.sql 2>/dev/null && echo "  init.sql ✅" || echo "  init.sql ⚠️ (có thể đã tồn tại)"
$MYSQL "$DB_NAME" < sql/migrations/full_migration.sql 2>/dev/null && echo "  full_migration.sql ✅" || echo "  full_migration.sql ⚠️"

echo ""
echo "=== Kết quả ==="
$MYSQL "$DB_NAME" -e "SHOW TABLES;"
echo ""
echo "✅ Setup hoàn tất! Khởi động lại backend: npm run dev"
