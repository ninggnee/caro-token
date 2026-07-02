import { createContext, useContext, useState } from "react";

const RegisterFormContext = createContext();

export const RegisterFormProvider = ({ children }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    role: "farmer",
    agree: false,
  });

  const updateFormData = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const clearFormData = () => {
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirm: "",
      role: "farmer",
      agree: false,
    });
  };

  return (
    <RegisterFormContext.Provider value={{ formData, updateFormData, clearFormData }}>
      {children}
    </RegisterFormContext.Provider>
  );
};

export const useRegisterForm = () => {
  const context = useContext(RegisterFormContext);
  if (!context) {
    throw new Error("useRegisterForm must be used within RegisterFormProvider");
  }
  return context;
};
