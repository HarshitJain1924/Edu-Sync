import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020202] text-slate-900 dark:text-slate-100 font-body selection:bg-indigo-300/40 selection:text-white relative transition-colors duration-500">
      <div className="relative z-10">
        <Navbar />
        <main className="relative overflow-hidden w-full">
          <Hero />
          <Features />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Index;
