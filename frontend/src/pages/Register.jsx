import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { LineChart, AlertCircle, CheckCircle, Loader2, Eye, EyeOff, Check, X } from "lucide-react";

export const Register = ({ onNavigate }) => {
  const { register } = useAuth();

  // Form fields empty by default
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status indicators & Toast notifications
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "error" });
  
  // Validation error alerts
  const [errors, setErrors] = useState({});

  // Password requirements state
  const [requirements, setRequirements] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false
  });
  const [strengthScore, setStrengthScore] = useState(0);

  // Explicitly clear all fields on mount to bypass browser form cache recovery
  useEffect(() => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }, []);

  const showToast = (message, type = "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type });
    }, 4000);
  };

  // Monitor password value changes to update requirements/strength
  useEffect(() => {
    const uppercaseRegex = /[A-Z]/;
    const numberRegex = /[0-9]/;
    const specialRegex = /[!@#$%^&*(),.?":{}|<>]/;

    const reqs = {
      length: password.length >= 8,
      uppercase: uppercaseRegex.test(password),
      number: numberRegex.test(password),
      special: specialRegex.test(password)
    };
    
    setRequirements(reqs);

    const score = Object.values(reqs).filter(Boolean).length;
    setStrengthScore(score);
  }, [password]);

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!firstName.trim()) newErrors.firstName = "First name is required.";
    if (!lastName.trim()) newErrors.lastName = "Last name is required.";
    
    if (!email) {
      newErrors.email = "Email address is required.";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email format.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (strengthScore < 4) {
      newErrors.password = "Password must meet all security guidelines.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast("Please correct the form fields.");
      return;
    }

    setLoading(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await register(email, password, fullName);
      
      showToast("Workspace created successfully! Redirecting to login...", "success");
      
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      
      setTimeout(() => {
        onNavigate("login");
      }, 1500);
    } catch (err) {
      console.error(err);
      showToast(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStrengthConfig = () => {
    if (password.length === 0) return { label: "None", color: "bg-gray-700", text: "text-gray-500", width: "w-0" };
    if (strengthScore <= 1) return { label: "Weak", color: "bg-red-500", text: "text-red-400", width: "w-1/4" };
    if (strengthScore <= 3) return { label: "Medium", color: "bg-orange-500", text: "text-orange-400", width: "w-3/4" };
    return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-400", width: "w-full" };
  };

  const strength = getStrengthConfig();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0B0F19]">
      {/* Full-screen immersive 3D background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/trading_desk_bg.png')" }}
      />
      {/* Immersive overlay for premium dark theme and depth-of-field blur */}
      <div className="absolute inset-0 bg-[#080B11]/88 backdrop-blur-[1.5px]" />

      {/* Floating Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-2xl transition-all duration-300 max-w-sm ${
          toast.type === "success" 
            ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/25 backdrop-blur-md" 
            : "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/25 backdrop-blur-md"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-xs font-semibold leading-tight">{toast.message}</span>
        </div>
      )}

      {/* Decorative Glow Blobs for financial highlights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Glassmorphic Card */}
      <div className="w-full max-w-md auth-glass-card rounded-3xl p-7 md:p-9 relative z-10">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-5">
          <div className="bg-blue-600/10 p-2.5 rounded-2xl border border-blue-500/20 shadow-inner">
            <LineChart className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-widest text-white uppercase">
              QuantLens AI
            </h1>
            <p className="text-[9px] text-blue-400/90 font-bold uppercase tracking-wider mt-1">
              AI-Powered Stock Market Research Platform
            </p>
            <p className="text-[9px] text-gray-400/80 font-medium tracking-wide mt-1.5 max-w-[260px] mx-auto leading-relaxed">
              Create your account and start exploring financial markets with AI-powered research tools.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          
          {/* First Name & Last Name Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* First Name */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  First Name
                </label>
                {errors.firstName && (
                  <span className="text-[9px] text-red-400 font-semibold">{errors.firstName}</span>
                )}
              </div>
              <input
                type="text"
                name="quantlens_first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                autoComplete="off"
                className={`w-full auth-glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 outline-none placeholder:text-gray-400/80 font-medium ${
                  errors.firstName ? "border-red-500/40 focus:border-red-500/50 focus:shadow-[0_0_15px_rgba(239,68,68,0.12)]" : ""
                }`}
              />
            </div>

            {/* Last Name */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Last Name
                </label>
                {errors.lastName && (
                  <span className="text-[9px] text-red-400 font-semibold">{errors.lastName}</span>
                )}
              </div>
              <input
                type="text"
                name="quantlens_last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                autoComplete="off"
                className={`w-full auth-glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 outline-none placeholder:text-gray-400/80 font-medium ${
                  errors.lastName ? "border-red-500/40 focus:border-red-500/50 focus:shadow-[0_0_15px_rgba(239,68,68,0.12)]" : ""
                }`}
              />
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Email Address
              </label>
              {errors.email && (
                <span className="text-[9px] text-red-400 font-semibold">{errors.email}</span>
              )}
            </div>
            <input
              type="text"
              name="quantlens_register_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.doe@example.com"
              autoComplete="off"
              className={`w-full auth-glass-input rounded-xl px-4 py-2.5 text-xs text-gray-200 outline-none placeholder:text-gray-400/80 font-medium ${
                errors.email ? "border-red-500/40 focus:border-red-500/50 focus:shadow-[0_0_15px_rgba(239,68,68,0.12)]" : ""
              }`}
            />
          </div>

          {/* Password Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Password
              </label>
              {errors.password && (
                <span className="text-[9px] text-red-400 font-semibold">{errors.password}</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="quantlens_register_password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                className={`w-full auth-glass-input rounded-xl pl-4 pr-11 py-2.5 text-xs text-gray-200 outline-none placeholder:text-gray-400/80 font-medium ${
                  errors.password ? "border-red-500/40 focus:border-red-500/50 focus:shadow-[0_0_15px_rgba(239,68,68,0.12)]" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Password Strength Checklist & Bar */}
            {password.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[9px] font-bold">
                  <span className="text-gray-500 uppercase">Password Security Strength:</span>
                  <span className={strength.text}>{strength.label}</span>
                </div>
                <div className="h-1 w-full bg-[#0B0F19] rounded-full overflow-hidden">
                  <div className={`h-full ${strength.width} ${strength.color} transition-all duration-300`}></div>
                </div>
                
                {/* Requirements Checklist */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] text-gray-500 font-medium mt-0.5">
                  <div className={`flex items-center gap-1 ${requirements.length ? "text-emerald-400" : ""}`}>
                    {requirements.length ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                    <span>Min. 8 Characters</span>
                  </div>
                  <div className={`flex items-center gap-1 ${requirements.uppercase ? "text-emerald-400" : ""}`}>
                    {requirements.uppercase ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                    <span>One Uppercase Letter</span>
                  </div>
                  <div className={`flex items-center gap-1 ${requirements.number ? "text-emerald-400" : ""}`}>
                    {requirements.number ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                    <span>One Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1 ${requirements.special ? "text-emerald-400" : ""}`}>
                    {requirements.special ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                    <span>One Special Symbol</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Confirm Password
              </label>
              {errors.confirmPassword && (
                <span className="text-[9px] text-red-400 font-semibold">{errors.confirmPassword}</span>
              )}
            </div>
            
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="quantlens_register_confirm_password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className={`w-full auth-glass-input rounded-xl pl-4 pr-11 py-2.5 text-xs text-gray-200 outline-none placeholder:text-gray-400/80 font-medium ${
                  errors.confirmPassword ? "border-red-500/40 focus:border-red-500/50 focus:shadow-[0_0_15px_rgba(239,68,68,0.12)]" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:via-blue-400 hover:to-indigo-500 text-white font-bold text-xs tracking-wider uppercase py-3.5 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2 mt-5"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Profile...</span>
              </>
            ) : (
              <span>Sign Up</span>
            )}
          </button>
        </form>

        {/* Navigation Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <span>Already have an account? </span>
          <button
            onClick={() => onNavigate("login")}
            className="text-blue-400 hover:text-blue-300 font-bold hover:underline bg-transparent"
          >
            Sign In Here
          </button>
        </div>
      </div>
    </div>
  );
};
