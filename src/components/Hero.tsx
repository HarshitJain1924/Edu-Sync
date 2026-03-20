import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-learning.jpg";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      
      {/* Animated circles */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] animate-pulse delay-700" />

      <div className="container mx-auto px-4 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left Content */}
          <div className="space-y-8 text-left">
            <div className="inline-flex items-center gap-2 px-6 py-2 bg-primary/10 border border-primary/20 rounded-full shadow-glow backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm font-medium text-primary-foreground">AI-Powered Learning Platform</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight text-white">
              Learn Together. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400 text-glow">
                Smarter.
              </span>
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
              Connect with students and teachers in real-time. Collaborate seamlessly with AI-powered 
              tools that make learning more engaging and effective.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="group relative px-8 py-6 text-lg rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:shadow-glow transition-all duration-300 border-none"
              >
                <span className="relative z-10 flex items-center">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate("/dashboard")}
                className="px-8 py-6 text-lg rounded-xl border-white/10 bg-white/5 hover:bg-white/10 transition-all backdrop-blur-md"
              >
                Play & Prepare
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-8">
              <div className="glass-panel p-4 rounded-xl text-center min-w-[120px]">
                <div className="text-3xl font-bold text-primary">10K+</div>
                <div className="text-sm text-gray-400">Active Students</div>
              </div>
              <div className="glass-panel p-4 rounded-xl text-center min-w-[120px]">
                <div className="text-3xl font-bold text-primary">500+</div>
                <div className="text-sm text-gray-400">Expert Teachers</div>
              </div>
              <div className="glass-panel p-4 rounded-xl text-center min-w-[120px]">
                <div className="text-3xl font-bold text-primary">95%</div>
                <div className="text-sm text-gray-400">Success Rate</div>
              </div>
            </div>
          </div>

          {/* Right Image */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10 glass-card p-2">
              <div className="rounded-xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
                  <img 
                    src={heroImage} 
                    alt="AI-Powered Collaborative Learning" 
                    className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700"
                  />
              </div>
            </div>
            {/* Floating elements */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-500" />
            
            <div className="absolute top-10 -right-6 glass-panel p-4 rounded-xl shadow-glow animate-bounce delay-700 flex items-center gap-3">
                 <div className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
                 <span className="text-sm font-medium">Live Class Active</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
