import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import BGonboarding from "/assets/bg-onboarding.png";
import OnBoardingSVG from "/assets/onboarding.svg";
import Logo from "/assets/monotype-white.svg";
import { Link } from "react-router-dom";
import axiosInstance from "../utils/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

interface ElectronAPI {
  saveUser: (user: any) => Promise<{ success: boolean; error?: string }>;
  loadUser: () => Promise<{
    id: any;
    success: boolean;
    user?: any;
    error?: string;
  }>;
  ping: () => Promise<string>;
  shell?: {
    openExternal: (url: string) => Promise<void>;
  };
  login: (
    email: string,
    password: string
  ) => Promise<{
    success: boolean;
    user?: any;
    token?: string;
    error?: string;
    status?: number;
  }>;
  register: (userData: any) => Promise<{
    success: boolean;
    user?: any;
    token?: string;
    error?: string;
  }>;
  forgotPassword: (
    email: string,
    otp: string,
    newPassword: string
  ) => Promise<{
    success: boolean;
    user?: any;
    token?: string;
    error?: string;
    message?: string;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
  phone: string;
  emailVerified: boolean;
}

const Login = () => {
  const [step, setStep] = useState<
    "login" | "register1" | "register2" | "forgot1" | "forgot2"
  >("login");
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    otp: "",
    password: "",
    confirmPassword: "",
    phone: "",
    emailVerified: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const checkTrialAndSubscription = (userData: any): boolean => {
    const now = new Date();
    const trialEnd = userData.trialStart
      ? addDays(userData.trialStart, 7)
      : null;
    const hasTrial = userData.trialStart && trialEnd && now <= trialEnd;
    const hasSubscription =
      userData.subscriptionEnd &&
      userData.subscriptionEnd !== null &&
      now <= new Date(userData.subscriptionEnd);

    console.log("Trial/Subscription check:", {
      trialStart: userData.trialStart,
      trialEnd,
      hasTrial,
      hasSubscription,
      subscriptionEnd: userData.subscriptionEnd,
      now,
    });

    return hasTrial || hasSubscription;
  };

  const addDays = (date: string | Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  useEffect(() => {
    console.log("Current route:", location.pathname);
    console.log("Login component rendered with step:", step);
    const checkAuth = async () => {
      const data = await window.electronAPI?.loadUser();
      console.log("Loaded user:", data?.user);
      if (data?.user?.token) {
        console.log(data.user);
        if (checkTrialAndSubscription(data.user)) {
          navigate("/dashboard", { replace: true });
        } else {
          console.warn("No valid trial or subscription. Staying on login.");
          localStorage.removeItem("token");
          setShowTrialExpiredModal(true);
        }
      }
    };
    checkAuth();
  }, [location.pathname]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string) => {
    return /^\+?[\d\s-]{10,}$/.test(phone);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleVerifyEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError("Please fill in all fields");
      return;
    }
    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setIsLoading(true);
      const response = await window.electronAPI.sendEmailOtp(
        formData.email.trim()
      );
      if (response.success) {
        setShowOtp(true);
        toast.success("OTP sent to your email");
      } else {
        throw new Error(response.error || "Failed to send OTP");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

const handleRegisterStep1 = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.otp) {
      setError("Please enter OTP");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    try {
      setIsLoading(true);
      const response = await window.electronAPI.verifyEmailOtp(
        formData.email.trim(),
        formData.otp.trim()
      );
      if (response.success) {
        setFormData({ ...formData, emailVerified: true });
        setStep("register2");
        setShowOtp(false);
        toast.success(response.message || "Email verified successfully");
      } else {
        throw new Error(response.error || "Invalid OTP or verification failed");
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP or verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterStep2 = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.phone) {
      setError("Please enter phone number");
      return;
    }
    if (!validatePhone(formData.phone)) {
      setError("Please enter a valid phone number");
      return;
    }

    try {
      setIsLoading(true);
      const userData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password.trim(),
        phone: formData.phone.trim(),
        emailVerified: formData.emailVerified,
      };

      console.log(window.electronAPI?.register);
      if (window.electronAPI?.register) {
        const response = await window.electronAPI.register(userData);

        if (response.success && response.user) {
          localStorage.setItem("token", response.token || "");
          toast.success("Registration Successful");
          console.log("Navigating to /dashboard after registration");
          navigate("/dashboard");
        } else {
          throw new Error(response.error || "Registration failed");
        }
      } else {
        if (navigator.onLine) {
          const response = await axiosInstance.post(
            "/api/auth/register",
            userData
          );

          if (window.electronAPI) {
            const saveResult = await window.electronAPI.saveUser({
              id: response.data.user.id,
              name: response.data.user.name,
              email: response.data.user.email,
              phone: response.data.user.phone,
              emailVerified: !!response.data.user.emailVerified,
              token: response.data.token,
              trialStart: response.data.trialStart,
              subscriptionEnd: response.data.subscriptionEnd,
            });
            if (!saveResult.success) {
              console.error(
                "Failed to save user data locally:",
                saveResult.error
              );
            }
          }

          localStorage.setItem("token", response.data.token);
          toast.success("Registration Successful");
          console.log("Navigating to /dashboard after registration");
          navigate("/dashboard");
        } else {
          throw new Error(
            "Offline registration not supported without Electron API"
          );
        }
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error || err.message || "Registration failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setIsLoading(true);

      if (window.electronAPI.login) {
        const response = await window.electronAPI.login(
          formData.email.trim(),
          formData.password.trim()
        );

        console.log("Login response:", response);

        if (response.success && response.user) {
          localStorage.setItem("token", response.token || "");
          console.log("Token stored:", response.token);
          toast.success("Login Successful");
          navigate("/dashboard", { replace: true });
        } else {
          if (response.status === 403) {
            setShowTrialExpiredModal(true);
          } else {
            throw new Error(response.error || "Login failed");
          }
        }
      } else {
        const response = await axiosInstance.post("/api/auth/login", {
          email: formData.email.trim(),
          password: formData.password.trim(),
        });
        console.log("Login response:", response);

        if (window.electronAPI) {
          const saveResult = await window.electronAPI.saveUser({
            id: response.data.user.id,
            name: response.data.user.name,
            email: response.data.user.email,
            phone: response.data.user.phone,
            emailVerified: !!response.data.user.emailVerified,
            token: response.data.token,
            trialStart: response.data.user.trialStart,
            subscriptionEnd: response.data.user.subscriptionEnd,
          });
          console.log("Save user result:", saveResult);
        }

        localStorage.setItem("token", response.data.token);
        toast.success("Login Successful");
        console.log("Navigating to /dashboard");
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.response?.status === 403) {
        setShowTrialExpiredModal(true);
      } else {
        setError(
          err.response?.data?.error ||
            err.message ||
            "Invalid email or password"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordStep1 = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError("Please enter your email");
      return;
    }
    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }
    try {
      setIsLoading(true);
      if (window.electronAPI?.sendEmailOtp) {
        const response = await window.electronAPI.sendEmailOtp(
          formData.email.trim()
        );
        console.log(response);
        if (response.success) {
          setShowOtp(true);
          toast.success(response.message || "OTP sent to your email");
          setStep("forgot2");
        } else {
          throw new Error(response.error || "Failed to send OTP");
        }
      } else {
        throw new Error("Electron API not available");
      }
    } catch (err: any) {
      console.error("Send OTP error:", err);
      setError(err.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordStep2 = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.otp) {
      setError("Please enter OTP");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Resetting password for:", {
        email: formData.email,
        otp: formData.otp,
      });
      if (window.electronAPI?.forgotPassword) {
        const response = await window.electronAPI.forgotPassword(
          formData.email.trim(),
          formData.otp.trim(),
          formData.password.trim()
        );

        if (response.success) {
          if (response.user && response.token) {
            localStorage.setItem("token", response.token);
            toast.success("Password reset successfully");
          } else {
            toast.success(
              response.message ||
                "Password reset queued. Will sync when online."
            );
          }

          setStep("login");
          setShowOtp(false);
          setFormData({
            ...formData,
            otp: "",
            password: "",
            confirmPassword: "",
          });
        } else {
          throw new Error(response.error || "Password reset failed");
        }
      } else {
        throw new Error("Electron API not available");
      }
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(err.message || "Invalid OTP or reset failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = () => {
    const subscriptionUrl = "https://getfotos.gumroad.com/l/waitlist";
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(subscriptionUrl);
    } else {
      window.open(subscriptionUrl, "_blank");
    }
    setShowTrialExpiredModal(false);
  };

  return (
    <div className="flex w-full h-screen overflow-hidden font-sans">
      <div className="w-1/2 p-20 flex flex-col justify-between">
        <div>
          <div className="text-4xl font-bold mb-2">
            Welcome <span className="inline-block transform rotate-12">✌️</span>
          </div>
          <div className="text-gray-600 mb-8">Glad to see you back</div>
          {error && (
            <div className="text-red-500 text-sm mb-4" role="alert">
              {error}
            </div>
          )}

          {step === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                aria-label="Email address"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  aria-label="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-black/85 rounded-[6px] py-2"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              <div className="text-center space-x-4">
                <button
                  type="button"
                  onClick={() => setStep("register1")}
                  className="text-blue-600 text-sm"
                >
                  Create an account
                </button>
                <button
                  type="button"
                  onClick={() => setStep("forgot1")}
                  className="text-blue-600 text-sm"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          ) : step === "register1" ? (
            <form onSubmit={handleRegisterStep1} className="space-y-4">
              <input
                type="text"
                name="firstName"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                aria-label="First name"
              />
              <input
                type="text"
                name="lastName"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                aria-label="Last name"
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                aria-label="Email address"
              />
              <Button
                type="button"
                className="w-full bg-black text-white hover:bg-black/85 rounded-[6px] py-2"
                onClick={handleVerifyEmail}
                disabled={isLoading}
              >
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>
              {showOtp && (
                <>
                  <input
                    type="text"
                    name="otp"
                    placeholder="Enter OTP"
                    value={formData.otp}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded"
                    aria-label="Email OTP"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded"
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm Password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded"
                      aria-label="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-black text-white hover:bg-black/85 rounded-[6px] py-2"
                    disabled={isLoading}
                  >
                    {isLoading ? "Submitting..." : "Submit"}
                  </Button>
                </>
              )}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="text-blue-600 text-sm"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          ) : step === "register2" ? (
            <form onSubmit={handleRegisterStep2} className="space-y-4">
              <input
                type="tel"
                name="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                aria-label="Phone number"
              />
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-black/85 rounded-[6px] py-2"
                disabled={isLoading}
              >
                {isLoading ? "Submitting..." : "Complete Registration"}
              </Button>
            </form>
          ) : step === "forgot1" ? (
            <form onSubmit={handleForgotPasswordStep1} className="space-y-4">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                aria-label="Email address"
              />
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-black/85 rounded-[6px] py-2"
                disabled={isLoading}
              >
                {isLoading ? "Sending OTP..." : "Send OTP"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="text-blue-600 text-sm"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : step === "forgot2" ? (
            <form onSubmit={handleForgotPasswordStep2} className="space-y-4">
              <input
                type="text"
                name="otp"
                placeholder="Enter OTP"
                value={formData.otp}
                onChange={handleInputChange}
                className="w-full p-2 border rounded"
                aria-label="Email OTP"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="New Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  aria-label="New password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm New Password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded"
                  aria-label="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full bg-black text-white hover:bg-black/85 rounded-[6px] py-2"
                disabled={isLoading}
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="text-blue-600 text-sm"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <div className="text-red-500" role="alert">
              Error: Invalid step state
            </div>
          )}

          <div className="text-xs text-gray-600 mt-5">
            By continuing you agree to our{" "}
            <Link to="/terms" className="text-blue-600">
              terms and conditions
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-blue-600">
              privacy policy
            </Link>
          </div>
        </div>
        <div className="text-xs text-gray-600 mt-5">
          For help, consult our{" "}
          <Link to="/docs" className="text-blue-600">
            documentation
          </Link>{" "}
          or contact{" "}
          <Link to="/support" className="text-blue-600">
            support
          </Link>
          . The docs offer step-by-step guidance on common issues. If needed,
          reach out to our support team via email, chat, or phone. Prompt
          assistance ensures a smooth experience with our product or service.
        </div>
      </div>
      <div className="w-1/2 bg-black text-white flex flex-col justify-center items-center relative">
        <div
          className="w-full h-screen bg-cover opacity-10 bg-center"
          style={{ backgroundImage: `url(${BGonboarding})` }}
        ></div>
        <div className="absolute top-0 max-h-screen w-full h-screen flex flex-col items-center justify-between">
          <img src={Logo} alt="Logo" className="my-4 w-60 px-14 py-7" />
          <div className="h-40 mb-4 flex-col justify-center items-center gap-4 inline-flex">
            <div className="text-4xl px-8 font-bold font-['Montserrat'] text-center">
              Your attendee experience
              <br /> is our utmost priority
            </div>
            <div className="text-xl font-medium font-['Montserrat']">
              Speed and safety for your creativity
            </div>
          </div>
          <img src={OnBoardingSVG} alt="Onboarding" className="w-full" />
        </div>
      </div>

      {showTrialExpiredModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          role="dialog"
          aria-labelledby="trial-expired-title"
          aria-modal="true"
        >
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h2
              id="trial-expired-title"
              className="text-xl font-bold mb-4 text-gray-800"
            >
              Trial Expired
            </h2>
            <p className="text-gray-600 mb-6">
              Your trial period has ended. Please subscribe to continue using
              our services.
            </p>
            <div className="flex justify-end space-x-4">
              <Button
                className="bg-gray-300 text-gray-800 hover:bg-gray-400 rounded-[6px] py-2 px-4"
                onClick={() => setShowTrialExpiredModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700 rounded-[6px] py-2 px-4"
                onClick={handleSubscribe}
              >
                Subscribe Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
