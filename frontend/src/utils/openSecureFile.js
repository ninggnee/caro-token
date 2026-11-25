import axios from "./axiosClient";

/**
 * Opens an uploaded file that lives behind an authenticated API route.
 *
 * `/uploads/...` is no longer served publicly, so a plain <a href> can't reach
 * these files — the Bearer token has to be attached. The file is fetched as a
 * blob and shown in a tab opened synchronously (opening it after the await
 * would be treated as a popup and blocked).
 *
 * @param {string} category one of "deposits" | "batches" | "warehouse-docs"
 * @param {string} filePath stored path or bare filename; only the basename is used
 */
export default async function openSecureFile(category, filePath) {
  const fileName = String(filePath).replace(/\\/g, "/").split("/").pop();
  if (!fileName) return;

  const tab = window.open("", "_blank");

  try {
    const res = await axios.get(`/files/${category}/${encodeURIComponent(fileName)}`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(res.data);
    if (tab) {
      tab.location = url;
      // Give the tab time to load before dropping our reference to the blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (tab) tab.close();
    const status = err?.response?.status;
    alert(
      status === 403 ? "Bạn không có quyền xem tệp này"
      : status === 404 ? "Không tìm thấy tệp"
      : "Không mở được tệp, vui lòng thử lại"
    );
  }
}
