import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Highlights from "@/components/home/Highlights";
import GamesPreview from "@/components/home/GamesPreview";
import TeacherAdmin from "@/components/home/TeacherAdmin";
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
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <Highlights />
      <GamesPreview />
      <TeacherAdmin />
      <Footer />
    </div>
  );
};

export default Index;
