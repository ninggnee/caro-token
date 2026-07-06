import { useState, useRef } from "react";

export default function DateInput({ value, onChange, style, placeholder = "dd/mm/yyyy", className }) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Format YYYY-MM-DD to DD/MM/YYYY
  const formatToDisplay = (dateVal) => {
    if (!dateVal) return "";
    const parts = dateVal.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateVal;
  };

  const displayValue = isFocused ? (value || "") : formatToDisplay(value);

  const handleFocus = () => {
    setIsFocused(true);
    // Auto show native picker in modern browsers if supported
    setTimeout(() => {
      if (inputRef.current && typeof inputRef.current.showPicker === "function") {
        try {
          inputRef.current.showPicker();
        } catch (err) {
          // Fallback if browser blocks it
        }
      }
    }, 50);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <input
      ref={inputRef}
      type={isFocused ? "date" : "text"}
      className={className}
      style={style}
      value={displayValue}
      placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={onChange}
    />
  );
}
