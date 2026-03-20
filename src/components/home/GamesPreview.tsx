import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Grid3x3, Puzzle, Keyboard, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const previews = [
  { id: "sudoku", title: "Sudoku", desc: "Logic grid challenge", icon: Grid3x3, color: "from-blue-500 to-cyan-500" },
  { id: "queens", title: "Queens", desc: "Chessboard placement puzzle", icon: Puzzle, color: "from-purple-500 to-pink-500" },
  { id: "typing", title: "Typing Test", desc: "Speed and accuracy", icon: Keyboard, color: "from-teal-500 to-cyan-500" },
  { id: "zip", title: "Zip Match", desc: "Pair matching", icon: Zap, color: "from-yellow-500 to-orange-500" },
];

export default function GamesPreview() {
  const navigate = useNavigate();
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Gamified Prep</h2>
            <p className="text-muted-foreground">Train faster with bite-sized games</p>
          </div>
          <Button onClick={() => navigate("/games")}>Play Now</Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {previews.map((g) => (
            <Card key={g.id} className="hover:shadow-elegant transition-all cursor-pointer" onClick={() => navigate(`/games/${g.id}`)}>
              <CardHeader>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${g.color} w-fit mb-4`}>
                  <g.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle>{g.title}</CardTitle>
                <CardDescription>{g.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm">Open</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
