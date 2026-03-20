import { Button } from "@/components/ui/button";
import { Trophy, Clock, Heart, X } from "lucide-react";

type Props = {
  score: number;
  time: number;
  lives?: number;
  onExit: () => void;
  onPause?: () => void;
  pauseLabel?: string;
};

export default function GameHeader({ score, time, lives, onExit, onPause, pauseLabel = "Pause" }: Props) {
  return (
    <div className="bg-card border-b border-border px-8 py-4 shadow-soft">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Button variant="ghost" onClick={onExit}>
          <X className="mr-2 h-5 w-5" />
          Exit
        </Button>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold">{score}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-mono font-semibold">{time}s</span>
          </div>
          {typeof lives === "number" && (
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <span className="font-semibold">×{lives}</span>
            </div>
          )}
        </div>

        {onPause ? (
          <Button variant="outline" onClick={onPause}>
            {pauseLabel}
          </Button>
        ) : (
          <div className="w-24" />
        )}
      </div>
    </div>
  );
}
