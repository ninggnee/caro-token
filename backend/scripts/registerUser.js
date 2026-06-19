import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import db from "../config/db.js";
import fs from "fs";
import path from "path";

dotenv.config();

const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = argv.indexOf(`--${name}`);
  return idx >= 0 ? argv[idx + 1] : fallback;
};

const email = getArg("email", "testuser@example.com");
const password = getArg("password", "Password123!");
const full_name = getArg("full_name", "Test User");
const role = getArg("role", "trader");
const imagePath = getArg("image", null);

const getOcrName = async (filePath) => {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      console.error("Image file not found at path:", absolutePath);
      return null;
    }
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      console.error("Specified path is not a file:", absolutePath);
      return null;
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const blob = new Blob([fileBuffer], { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("image", blob, path.basename(absolutePath));

    console.log("Calling FPT.AI ID Recognition API for file:", absolutePath);
    const response = await fetch("https://api.fpt.ai/vision/idr/vnm", {
      method: "POST",
      headers: {
        "api-key": process.env.OCR_API_KEY || "***REMOVED-OCR-KEY***"
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.errorCode === 0 && result.data && result.data.length > 0) {
      const info = result.data[0];
      console.log("----------------------------------------");
      console.log("FPT.AI OCR EXTRACTED SUCCESSFULLY:");
      console.log("ID Number:  ", info.id);
      console.log("Full Name:  ", info.name);
      console.log("DOB:        ", info.dob);
      console.log("Gender:     ", info.sex);
      console.log("Address:    ", info.address);
      console.log("Nationality:", info.nationality);
      console.log("----------------------------------------");
      return info.name || null;
    } else {
      console.error("FPT.AI API error:", result.errorMessage || "Unknown error");
      return null;
    }
  } catch (err) {
    console.error("Error calling FPT.AI API:", err.message);
    return null;
  }
};

const run = async () => {
  try {
    let finalName = full_name;
    if (imagePath) {
      const extractedName = await getOcrName(imagePath);
      if (extractedName) {
        finalName = extractedName;
        console.log(`Using extracted name from CCCD: "${finalName}"`);
      } else {
        console.log(`Failed to extract name. Fallback to: "${finalName}"`);
      }
    }

    const [existing] = await db.execute(
      `SELECT id FROM users WHERE email = ?`,
      [email]
    );

    if (existing.length > 0) {
      console.log("User already exists:", email);
      process.exit(0);
    }

    const password_hash = await bcrypt.hash(password, 10);

    await db.execute(
      `
      INSERT INTO users
      (email, password_hash, full_name, role, kyc_status)
      VALUES (?, ?, ?, ?, 'pending')
      `,
      [email, password_hash, finalName, role]
    );

    console.log("Inserted user:", email);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
