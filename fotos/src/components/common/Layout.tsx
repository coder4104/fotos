"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { LogOut, Menu, Clock, Crown, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "../../components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "../../components/ui/sonner";
import Logo from "/assets/monotype-black.svg";
import NavLinks from "../../components/common/NavLinks";
import { PageLoader } from "./loaders";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  emailVerified?: boolean;
  token: string;
  image?: string;
  trialStart?: string;
  subscriptionEnd?: string | null;
}

declare global {
  interface Window {
    electronAPI?: {
      loadUser: () => Promise<{
        success: boolean;
        user?: User;
        error?: string;
      }>;
      openExternal: (url: string) => Promise<void>;
    };
  }
}

const addDays = (date: string | Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showTrialPopup, setShowTrialPopup] = useState<boolean>(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUserFromFile = async () => {
      if (!window.electronAPI?.loadUser) {
        toast.error("Electron APIs not available.");
        navigate("/login");
        return;
      }

      try {
        const result = await window.electronAPI.loadUser();

        if (!result.success || !result.user) {
          throw new Error(result.error || "User not found in file");
        }

        const userData = result.user;
        const now = new Date();

        const trialEnd = userData.trialStart
          ? addDays(userData.trialStart, 7)
          : null;
        const hasTrial = userData.trialStart && trialEnd && now <= trialEnd;
        const hasSubscription =
          userData.subscriptionEnd &&
          userData.subscriptionEnd !== null &&
          now <= new Date(userData.subscriptionEnd);

        console.log("Trial Debug:", {
          trialStart: userData.trialStart,
          trialEnd: trialEnd,
          now: now,
          hasTrial: hasTrial,
          hasSubscription: hasSubscription,
          subscriptionEnd: userData.subscriptionEnd,
        });

        if (!hasTrial && !hasSubscription) {
          toast.error("Trial expired and no active subscription");
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }

        setUser(userData);

        if (hasTrial && !hasSubscription && trialEnd) {
          const daysLeft = Math.ceil(
            (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          setTrialDaysLeft(daysLeft);

          console.log("Trial popup logic:", {
            daysLeft: daysLeft,
            showPopup: true,
          });
          setShowTrialPopup(true);
        }

        setLoading(false);
      } catch (error) {
        console.error("Failed to load user from file:", error);
        localStorage.removeItem("token");
        toast.error("Failed to authenticate. Please login again.");
        navigate("/login");
      }
    };

    loadUserFromFile();
  }, [navigate]);

  const handleSignOut = async() => {
      await window.electronAPI?.deleteUser(); 
    localStorage.removeItem("token");
    localStorage.removeItem("lastTrialPopup");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const handleUpgradeClick = async() => {
    setShowTrialPopup(false);
    const url = 'https://getfotos.gumroad.com/l/waitlist'
    await window.electronAPI?.openExternal(url as string);
  };

  const getTrialStatus = () => {
    if (!user?.trialStart) return null;

    const now = new Date();
    const trialEnd = addDays(user.trialStart, 7);
    const hasSubscription =
      user.subscriptionEnd &&
      user.subscriptionEnd !== null &&
      now <= new Date(user.subscriptionEnd);

    console.log("getTrialStatus:", {
      trialStart: user.trialStart,
      trialEnd: trialEnd,
      hasSubscription: hasSubscription,
      subscriptionEnd: user.subscriptionEnd,
    });

    if (hasSubscription) return null;

    const daysLeft = Math.ceil(
      (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    console.log("Days left calculated:", daysLeft);
    return daysLeft > 0 ? daysLeft : 0;
  };

  const trialStatus = getTrialStatus();

  const getTrialStyling = (days: number) => {
    if (days <= 1) {
      return {
        bgColor: "bg-gradient-to-r from-red-50 to-red-100",
        borderColor: "border-red-200",
        iconColor: "text-red-600",
        textColor: "text-red-800",
        buttonColor: "bg-red-600 hover:bg-red-700",
      };
    } else if (days <= 3) {
      return {
        bgColor: "bg-gradient-to-r from-orange-50 to-orange-100",
        borderColor: "border-orange-200",
        iconColor: "text-orange-600",
        textColor: "text-orange-800",
        buttonColor: "bg-orange-600 hover:bg-orange-700",
      };
    } else {
      return {
        bgColor: "bg-gradient-to-r from-gray-50 to-gray-100",
        borderColor: "border-gray-300",
        iconColor: "text-gray-700",
        textColor: "text-gray-800",
        buttonColor: "bg-black hover:bg-gray-800",
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const trialStyling = trialStatus !== null ? getTrialStyling(trialStatus) : null;

  return (
    <div className="w-full overflow-x-hidden">
      <div className="hidden md:block fixed top-0 left-0 bottom-0 bg-white text-black h-screen w-[220px] lg:w-[280px] z-40 border-r border-gray-200">
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex h-14 w-full items-center px-4 lg:h-[60px] lg:px-6 border-b border-gray-200">
              <Link to="/dashboard" className="flex items-center gap-2">
                <img
                  src={Logo}
                  alt="Fotos Logo"
                  className="object-contain w-[90px] h-[30px]"
                />
              </Link>
            </div>

            {trialStatus !== null && trialStatus >= 0 && trialStyling && (
              <div className={`mx-4 mt-4 p-4 rounded-xl ${trialStyling.bgColor} ${trialStyling.borderColor} border-2 shadow-sm`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-white ${trialStyling.iconColor} shadow-sm`}>
                    {trialStatus <= 1 ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-sm mb-1 ${trialStyling.textColor}`}>
                      Free Trial
                    </h3>
                    <p className={`text-xs mb-3 ${trialStyling.textColor} opacity-90`}>
                      {trialStatus === 0 ? (
                        "Trial expires today"
                      ) : trialStatus === 1 ? (
                        "Trial expires tomorrow"
                      ) : (
                        `${trialStatus} days remaining`
                      )}
                    </p>
                    <Button
                      size="sm"
                      className={`w-full h-8 text-xs font-medium text-white ${trialStyling.buttonColor} shadow-sm transition-all duration-200 hover:shadow-md`}
                      onClick={handleUpgradeClick}
                    >
                      <Crown className="mr-1.5 h-3 w-3" />
                      Upgrade Now
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <nav className="grid items-start gap-3 px-2 mt-5 lg:px-4">
              <NavLinks />
            </nav>
          </div>
          <div>
            <div className="flex items-center gap-3 p-4 border-t border-gray-200">
              <div className="rounded-full object-cover w-[40px] h-[40px]">
                <div className="w-full h-full bg-black flex items-center justify-center rounded-full text-white">
                  {user.name.charAt(0)}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user.name || "User"}
                </span>
                <span className="text-xs text-gray-600">
                  {user.email || "No email"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center w-full flex-1">
              <Button
                className="w-11/12 mb-5 cursor-pointer mx-auto text-center rounded-lg bg-black text-white hover:bg-gray-800 transition-colors duration-200"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="md:ml-[220px] lg:ml-[280px]">
        <header className="hidden max-md:h-14 h-0 max-md:flex items-center gap-4 bg-gray-100 px-4 max-lg:h-[60px] lg:px-6 sticky top-0 z-30">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                className="md:hidden shrink-0"
                size="icon"
                variant="outline"
              >
                <Menu className="size-5 text-black" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex flex-col bg-black text-white"
            >
              <div className="flex h-14 -ml-2 w-full items-center px-4 lg:h-[60px] lg:px-6">
                <Link to="/" className="flex items-center gap-2">
                  <img
                    src={Logo}
                    alt="Fotos Logo"
                    className="object-contain w-[24px] h-[24px] filter invert"
                  />
                  <p className="text-xl font-bold text-white">Fotos</p>
                </Link>
              </div>

              {trialStatus !== null && trialStatus >= 0 && (
                <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-r from-gray-800 to-gray-700 border border-gray-600 shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/10 text-orange-400 backdrop-blur-sm">
                      {trialStatus <= 1 ? (
                        <AlertCircle className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1 text-white">
                        Free Trial
                      </h3>
                      <p className="text-xs mb-3 text-gray-300">
                        {trialStatus === 0 ? (
                          "Trial expires today"
                        ) : trialStatus === 1 ? (
                          "Trial expires tomorrow"
                        ) : (
                          `${trialStatus} days remaining`
                        )}
                      </p>
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs font-medium bg-white text-black hover:bg-gray-100 shadow-sm transition-all duration-200"
                        onClick={handleUpgradeClick}
                      >
                        <Crown className="mr-1.5 h-3 w-3" />
                        Upgrade Now
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <nav className="grid gap-3 flex-1 mt-4">
                <NavLinks />
              </nav>
              <div className="flex items-center gap-3 p-4 border-t border-white/10">
                <img
                  src={user.image || "/default-avatar.png"}
                  alt={user.name || "User"}
                  className="rounded-full object-cover w-[40px] h-[40px]"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">
                    {user.name || "User"}
                  </span>
                  <span className="text-xs text-white/70">
                    {user.email || "No email"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center w-full flex-1">
                <Button
                  className="w-11/12 mb-5 cursor-pointer mx-auto text-center rounded-lg bg-white text-black hover:bg-gray-100 transition-colors duration-200"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="min-h-screen bg-[#F5F2ED] w-full">{children}</main>
      </div>

      <Toaster richColors closeButton />
    </div>
  );
};

export default DashboardLayout;