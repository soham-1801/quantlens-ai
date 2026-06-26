/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { LineChart, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "react-hot-toast";

export const Login = ({ onNavigate }) => {
  const { login } = useAuth();
  
  // Fields empty on load
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Validations
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Explicitly clear fields on mount to override browser form caching/restoration
  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  const validateForm = () => {
    let isValid = true;
    setEmailError("");
    setPasswordError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email) {
      setEmailError("Email address is required.");
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email format.");
      isValid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the validation errors below.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Access authorized! Loading workspace...");
      setTimeout(() => {
        onNavigate("dashboard");
      }, 800);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0B0F19]">
      {/* Full-screen immersive 3D background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/trading_desk_bg.png')" }}
      />
      {/* Immersive overlay for premium dark theme and depth-of-field blur */}
      <div className="absolute inset-0 bg-[#080B11]/88 backdrop-blur-[1.5px]" />

      {/* Decorative Glow Blobs for financial highlights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Glassmorphic Card */}
      <div className="w-full max-w-md auth-glass-card rounded-3xl p-7 md:p-9 relative z-10 flex flex-col justify-between">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2 mb-6">
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
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {/* Email Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Email Address
              </label>
              {emailError && (
                <span className="text-[9px] text-red-400 font-semibold">{emailError}</span>
              )}
            </div>
            <input
              type="email"
              name="quantlens_login_email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              autoComplete="off"
              className={`w-full auth-glass-input rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none placeholder:text-gray-400/80 font-medium ${
                emailError ? "border-red-500/40 focus:border-red-500/50 focus:shadow-[0_0_15px_rgba(239,68,68,0.12)]" : ""
              }`}
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Password
              </label>
              {passwordError && (
                <span className="text-[9px] text-red-400 font-semibold">{passwordError}</span>
              )}
            </div>
            
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="quantlens_login_password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="new-password"
                className={`w-full auth-glass-input rounded-xl pl-4 pr-11 py-2.5 text-sm text-gray-200 outline-none placeholder:text-gray-400/80 font-medium ${
                  passwordError ? "border-red-500/40 focus:border-red-500/50 focus:shadow-[0_0_15px_rgba(239,68,68,0.12)]" : ""
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
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Demo Credentials Card */}
        <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-1.5 text-center">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Demo Account</p>
          <div className="text-xs text-gray-500 font-medium space-y-0.5">
            <p>User: <span className="text-gray-300 font-semibold">demo@quantlens.ai</span></p>
            <p>Pass: <span className="text-gray-300 font-semibold">password123</span></p>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <span>Don't have an account? </span>
          <button
            onClick={() => onNavigate("register")}
            className="text-blue-400 hover:text-blue-300 font-bold hover:underline bg-transparent"
          >
            Register Here
          </button>
        </div>
      </div>
    </div>
  );
};
