import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Play, Pause, X, Trophy } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import GameHeader from "@/components/games/GameHeader";
import SudokuBoard from "@/components/games/SudokuBoard";
import QueensBoard from "@/components/games/QueensBoard";
import MemoryGame from "@/components/games/MemoryGame";
import PatternGame from "@/components/games/PatternGame";
import TypingTest from "@/components/games/TypingTest";
import ZipMatch from "@/components/games/ZipMatch";
import AptitudeRun from "@/components/games/AptitudeRun";
import NBackGame from "@/components/games/NBackGame";
import GridMemory from "@/components/games/GridMemory";
import DeductiveLogic from "@/components/games/DeductiveLogic";
import MazeKeyDoor from "@/components/games/MazeKeyDoor";
import BubbleMath from "@/components/games/BubbleMath";
import PipeConnect from "@/components/games/PipeConnect";
import CognitiveAssessment from "@/components/games/CognitiveAssessment";
import { addXP, getTotalXP } from "@/lib/xp";

const GameTemplate = () => {
  useRequireAuth();
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(0);
  const [lives, setLives] = useState(3);
  const [xpEarned, setXpEarned] = useState(0);
  const [totalXP, setTotalXP] = useState(getTotalXP());

  const gameInfo: Record<string, any> = {
    sudoku: { title: "Sudoku", description: "Fill the grid with numbers 1-9" },
    queens: { title: "Queens Puzzle", description: "Place queens without conflicts" },
    pattern: { title: "Pattern Matching", description: "Match the patterns quickly" },
    zip: { title: "Zip Match", description: "Connect matching pairs" },
    memory: { title: "Memory Flip", description: "Find all matching pairs" },
    speed: { title: "Brain Speed Test", description: "Solve as many as you can" },
    typing: { title: "Typing Speed Test", description: "Type the text accurately" },
    aptitude: { title: "Aptitude Speed Run", description: "Quick aptitude questions" },
    nback: { title: "N-Back Challenge", description: "Test your working memory" },
    grid: { title: "Spatial Grid", description: "Memorize the sequence pattern" },
    logic: { title: "Deductive Logic", description: "Solve algebraic symbol equations" },
    maze: { title: "Maze Escape", description: "Find the key and reach the door" },
    bubble: { title: "Bubble Math", description: "Pop bubbles in ascending order" },
    pipe: { title: "Pipe Connect", description: "Connect the pipes to flow" },
    assessment: { title: "Cognitive Assessment", description: "Full 15-minute corporate prep test" }
  };

  const currentGame = gameInfo[gameId || ""] || gameInfo.sudoku;

  const handleStart = () => {
    setIsPlaying(true);
    setShowResults(false);
    setScore(0);
    setTimer(0);
    setLives(3);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleExit = () => {
    navigate("/games");
  };

  const handleFinish = () => {
    setIsPlaying(false);
    setShowResults(true);
  };

  // simple timer tied to play/pause
  useEffect(() => {
    if (!isPlaying || isPaused) return;
    const t = window.setInterval(() => setTimer((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isPlaying, isPaused]);

  if (showResults) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full shadow-glow">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-4 bg-gradient-hero rounded-full w-fit">
              <Trophy className="h-12 w-12 text-primary-foreground" />
            </div>
            <CardTitle className="text-3xl mb-2">Game Complete! 🎉</CardTitle>
            <CardDescription className="text-lg">{currentGame.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-6">
              <div className="text-6xl font-bold text-primary mb-2">
                {xpEarned}
              </div>
              <p className="text-muted-foreground">XP Earned</p>
              <div className="mt-2 text-sm text-muted-foreground">Total XP: <span className="font-semibold">{totalXP}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-primary">{score}</div>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div className="text-center p-4 bg-card rounded-lg border">
                <div className="text-2xl font-bold text-primary">{timer}s</div>
                <p className="text-sm text-muted-foreground">Time</p>
              </div>
            </div>

            <div className="flex gap-4">
              <Button 
                size="lg" 
                className="flex-1"
                onClick={handleStart}
              >
                <Play className="mr-2 h-5 w-5" />
                Play Again
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="flex-1"
                onClick={handleExit}
              >
                Exit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isPlaying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <Card className="max-w-2xl w-full shadow-elegant">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-4 bg-gradient-hero rounded-full w-fit">
              <Brain className="h-12 w-12 text-primary-foreground" />
            </div>
            <CardTitle className="text-3xl mb-2">{currentGame.title}</CardTitle>
            <CardDescription className="text-lg">{currentGame.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-6 rounded-lg space-y-2">
              <h3 className="font-semibold mb-3">How to Play:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Complete the game to earn XP points</li>
                <li>• You have 3 lives to complete the challenge</li>
                <li>• Try to beat your high score!</li>
                <li>• Compete with friends on the leaderboard</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <Button 
                size="lg" 
                className="flex-1"
                onClick={handleStart}
              >
                <Play className="mr-2 h-5 w-5" />
                Start Game
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleExit}
              >
                <X className="mr-2 h-5 w-5" />
                Exit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Game Header */}
      <GameHeader score={score} time={timer} lives={lives} onExit={handleExit} onPause={handlePause} />

      {/* Game Board */}
      <main className="p-8">
        <div className="max-w-6xl mx-auto">
          <Card className="shadow-elegant">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
                {gameId === "sudoku" && (
                  <SudokuBoard
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "nback" && (
                  <NBackGame
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "grid" && (
                  <GridMemory
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "logic" && (
                  <DeductiveLogic
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "maze" && (
                  <MazeKeyDoor
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "bubble" && (
                  <BubbleMath
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "pipe" && (
                  <PipeConnect
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "assessment" && (
                  <CognitiveAssessment
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "queens" && (
                  <QueensBoard
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "memory" && (
                  <MemoryGame
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "pattern" && (
                  <PatternGame
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "typing" && (
                  <TypingTest
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "zip" && (
                  <ZipMatch
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {gameId === "aptitude" && (
                  <AptitudeRun
                    onScoreChange={setScore}
                    paused={isPaused}
                    onFinish={({ score, xp }) => {
                      setScore(score);
                      const total = addXP(xp);
                      setXpEarned(xp);
                      setTotalXP(total);
                      setIsPlaying(false);
                      setShowResults(true);
                    }}
                  />
                )}
                {!["sudoku","queens","memory","pattern","typing","zip","aptitude", "nback", "grid", "logic", "maze", "bubble", "pipe", "assessment"].includes(String(gameId)) && (
                  <div className="text-muted-foreground">Game coming soon.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Pause Modal */}
      {isPaused && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <CardHeader className="text-center">
              <CardTitle>Game Paused</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                size="lg" 
                className="w-full"
                onClick={handlePause}
              >
                <Play className="mr-2 h-5 w-5" />
                Resume
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full"
                onClick={handleExit}
              >
                Exit Game
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GameTemplate;
