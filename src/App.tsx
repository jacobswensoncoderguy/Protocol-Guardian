// Protocol Guardian
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Invite from "./pages/Invite";
import InviteCard from "./pages/InviteCard";
import InviteEmail from "./pages/InviteEmail";
import InviteWhatsApp from "./pages/InviteWhatsApp";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Preserve ref param through redirect to auth
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    return <Navigate to={ref ? `/auth?ref=${ref}` : '/auth'} replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <Index />
              </AuthGuard>
            }
          />
          <Route path="/invite-card" element={<AuthGuard><InviteCard /></AuthGuard>} />
          <Route path="/invite-email" element={<AuthGuard><InviteEmail /></AuthGuard>} />
          <Route path="/invite-whatsapp" element={<AuthGuard><InviteWhatsApp /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
          <Route path="*" element={<AuthGuard><NotFound /></AuthGuard>} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
