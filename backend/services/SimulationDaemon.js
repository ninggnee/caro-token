import db from '../config/db.js';

const LOGISTICS_FLOW = [
  'PENDING_PICKUP',
  'IN_TRANSIT',
  'DELIVERED',
  'STANDARDIZED',
  'STORED',
  'INSPECTED'
];

function getRandomFloat(min, max, decimals = 1) {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
}

function generateInspectionData() {
  // 60% Hạng 1 (CR1), 30% Hạng 2 (CR2), 10% Hạng 3 (CR3)
  const rand = Math.random();
  let qualityGrade = 'CR1';
  let defectRate, foreignMatter, moistureContent;
  let gradeCode = 'R118a';

  if (rand < 0.6) {
    // Hạng 1: Defect <= 10%, Foreign <= 0.1%, Moisture <= 12.5%
    qualityGrade = 'CR1';
    gradeCode = 'R118a';
    defectRate = getRandomFloat(1, 9);
    foreignMatter = getRandomFloat(0, 0.1);
    moistureContent = getRandomFloat(11.0, 12.4);
  } else if (rand < 0.9) {
    // Hạng 2: Defect <= 24%, Foreign <= 1.0%
    qualityGrade = 'CR2';
    gradeCode = 'R213a';
    defectRate = getRandomFloat(10, 23);
    foreignMatter = getRandomFloat(0.2, 0.9);
    moistureContent = getRandomFloat(12.0, 13.5);
  } else {
    // Hạng 3: Defect <= 70%, Foreign <= 5.0%
    qualityGrade = 'CR3';
    gradeCode = 'R3';
    defectRate = getRandomFloat(25, 60);
    foreignMatter = getRandomFloat(1.1, 4.5);
    moistureContent = getRandomFloat(12.5, 15.0);
  }

  return { qualityGrade, gradeCode, defectRate, foreignMatter, moistureContent };
}

async function processBatches() {
  try {
    const [batches] = await db.execute(`
      SELECT id, batch_id, farmer_id, logistics_status, quantity, batch_description 
      FROM asset_batches 
      WHERE status = 'PENDING_MINT_APPROVAL' 
        AND logistics_status != 'INSPECTED'
    `);

    for (const batch of batches) {
      const currentIndex = LOGISTICS_FLOW.indexOf(batch.logistics_status);
      if (currentIndex === -1 || currentIndex >= LOGISTICS_FLOW.length - 1) continue;

      const nextStatus = LOGISTICS_FLOW[currentIndex + 1];
      
      // Generate varying sensor data for all active stages
      const temp = getRandomFloat(20, 28, 1);
      const humidity = getRandomFloat(50, 75, 1);
      
      let updates = [];
      let params = [];

      updates.push('logistics_status = ?');
      params.push(nextStatus);

      updates.push('temperature_sensor = ?');
      params.push(temp);

      updates.push('humidity_sensor = ?');
      params.push(humidity);

      // Mass balance simulation
      if (nextStatus === 'STANDARDIZED') {
        const netQty = Number((Number(batch.quantity) * 0.98).toFixed(2));
        updates.push('quantity = ?');
        params.push(netQty);
        updates.push('batch_description = ?');
        params.push(`${batch.batch_description || ''}\n[Mass Balance] Đã sấy lọc & trừ 2% hao hụt. Khối lượng ròng: ${netQty} kg.`);
      }

      if (nextStatus === 'STORED') {
        const fakeCid = "Qm" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await db.execute(`
          INSERT INTO warehouse_documents (uploaded_by, document_type, document_name, file_size, cid, status)
          VALUES (?, 'warehouse_receipt', ?, 102400, ?, 'active')
        `, [
          batch.farmer_id,
          `Biên bản bàn giao và nhập kho - ${batch.batch_id}.pdf`,
          fakeCid
        ]);
      }

      // Inspection logic
      if (nextStatus === 'INSPECTED') {
        const ins = generateInspectionData();
        updates.push('moisture_content = ?');
        params.push(ins.moistureContent);
        updates.push('defect_rate = ?');
        params.push(ins.defectRate);
        updates.push('quality_grade = ?');
        params.push(ins.qualityGrade);
        updates.push('batch_description = ?');
        const desc = `${batch.batch_description || ''}\n[Kiểm định TCVN 4193:20] Phân loại: ${ins.qualityGrade === 'CR1' ? 'Hạng 1 (Cao cấp)' : ins.qualityGrade === 'CR2' ? 'Hạng 2 (Tiêu chuẩn)' : 'Hạng 3 (Phổ thông)'} - Mã: ${ins.gradeCode}. Tạp chất: ${ins.foreignMatter}%.`;
        params.push(desc);

        // Generate fake warehouse document
        const fakeCid = "Qm" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        await db.execute(`
          INSERT INTO warehouse_documents (uploaded_by, document_type, document_name, file_size, cid, status)
          VALUES (?, 'quality_inspection', ?, 102400, ?, 'active')
        `, [
          batch.farmer_id,
          `Báo cáo kiểm định chất lượng - ${ins.gradeCode}.pdf`,
          fakeCid
        ]);
      }

      params.push(batch.id);
      await db.execute(
        `UPDATE asset_batches SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
      console.log(`🔄 [Daemon] Batch ${batch.batch_id} advanced to ${nextStatus}`);
    }
  } catch (err) {
    console.error("❌ Daemon Error processing batches:", err);
  }
}

export const startDaemon = async () => {
  console.log("⚙️ Starting Simulation Daemon...");
  
  // Run immediately once, then every 30 seconds
  processBatches();
  setInterval(processBatches, 30000);
};

export default { startDaemon };
