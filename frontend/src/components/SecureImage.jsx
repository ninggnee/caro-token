import { useEffect, useState } from "react";
import axios from "../utils/axiosClient";

/**
 * Renders an image that lives behind an authenticated API endpoint.
 *
 * A plain <img src="..."> cannot send the Bearer token, so the bytes are
 * fetched as a blob through axiosClient and handed to <img> as an object URL.
 * The object URL is revoked on unmount so decrypted CCCD data does not linger.
 *
 * @param {string} path API-relative path, e.g. "/kyc/image/12/front"
 */
export default function SecureImage({ path, alt, style, onClick, className }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) return;

    let objectUrl = null;
    let cancelled = false;

    setSrc(null);
    setError(false);

    axios
      .get(path, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  const placeholderStyle = {
    ...style,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: "#94a3b8",
    background: "#0f172a",
  };

  if (error) {
    return <div style={placeholderStyle} className={className}>Không tải được</div>;
  }
  if (!src) {
    return <div style={placeholderStyle} className={className}>Đang tải…</div>;
  }

  return <img src={src} alt={alt} style={style} onClick={onClick} className={className} />;
}
