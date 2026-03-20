import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, FileText, Layers, Users, Gamepad2, LayoutDashboard } from "lucide-react";

const items = [
  { icon: FileText, title: "AI Summaries", desc: "Summarize notes and lectures instantly." },
  { icon: Brain, title: "AI Quiz Generator", desc: "Create quizzes from your study material." },
  { icon: Layers, title: "Flashcards", desc: "Spaced repetition decks for faster recall." },
  { icon: Users, title: "Study Rooms", desc: "Collaborate live with peers and teachers." },
  { icon: Gamepad2, title: "Gamified Prep Games", desc: "Play to strengthen aptitude and logic." },
  { icon: LayoutDashboard, title: "Dashboards", desc: "Track progress and insights over time." },
];

export default function Highlights() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">Highlights</h2>
          <p className="text-muted-foreground mt-2">Quick tools that power up your learning flow.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it, i) => (
            <Card key={i} className="hover:shadow-elegant transition-all">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                  <it.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{it.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{it.desc}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
