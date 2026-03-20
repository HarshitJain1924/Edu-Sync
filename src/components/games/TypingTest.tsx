import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  paused?: boolean;
  onFinish: (result: { score: number; xp: number }) => void;
  onScoreChange?: (score: number) => void;
};

const WORDS = "the quick brown fox jumps over the lazy dog practice makes perfect typing speed accuracy challenge keyboard monitor student engineer develop code javascript react typescript tailwind layout component state hook function variable constant solution problem logic algorithm structure optimize performance memory cache compute random sequence window array object string number equality focus input field test timer".split(" ");

export default function TypingTest({ paused, onFinish, onScoreChange }: Props) {
  const [duration, setDuration] = useState(60);
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [input, setInput] = useState("");
  const [index, setIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [typed, setTyped] = useState(0);
  const words = useMemo(() => generateWords(20 + Math.floor(Math.random()*21)), []);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeLeft(duration); }, [duration]);

  useEffect(() => {
    if (!started || paused) return;
    if (timeLeft <= 0) {
      const wpm = Math.round((typed / 5) * (60 / (duration)));
      const accuracy = typed === 0 ? 0 : Math.max(0, Math.round(((typed - errors) / typed) * 100));
      const score = Math.max(0, wpm * 2 + accuracy);
      const xp = Math.max(10, Math.round(wpm * 1.5));
      onFinish({ score, xp });
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [started, paused, timeLeft, typed, errors, duration]);

  useEffect(() => { onScoreChange?.(Math.max(0, Math.round((typed/5) * 2))); }, [typed]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInput(val);
    if (!started) setStarted(true);
    if (val.endsWith(" ")) {
      checkWord(val.trim());
      setInput("");
    }
  }

  function checkWord(val: string) {
    const expected = words[index] || "";
    setTyped((t) => t + Math.max(val.length, expected.length));
    if (val !== expected) {
      // count differing chars
      const len = Math.max(val.length, expected.length);
      let diff = 0;
      for (let i = 0; i < len; i++) if (val[i] !== expected[i]) diff++;
      setErrors((e) => e + diff);
    }
    setIndex((i) => i + 1);
  }

  function reset() {
    setStarted(false);
    setTimeLeft(duration);
    setInput("");
    setIndex(0);
    setErrors(0);
    setTyped(0);
    onScoreChange?.(0);
    inputRef.current?.focus();
  }

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Timer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30s</SelectItem>
            <SelectItem value="60">60s</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">Time Left: <span className="font-semibold">{timeLeft}s</span></div>
        <div className="text-sm text-muted-foreground">Errors: <span className="font-semibold">{errors}</span></div>
        <Button variant="ghost" onClick={reset}>Restart</Button>
      </div>

      <div className="max-w-2xl w-full space-y-4">
        <div className="p-4 rounded-lg border bg-card leading-8">
          {words.map((w, i) => (
            <span key={i} className={["mr-2", i === index ? "bg-primary/20 rounded px-1" : i < index ? "text-muted-foreground line-through" : ""].join(" ")}>{w}</span>
          ))}
        </div>
        <input
          ref={inputRef}
          value={input}
          onChange={onChange}
          className="w-full p-3 rounded-md border bg-background outline-none"
          placeholder="Start typing here..."
        />
      </div>
    </div>
  );
}

function generateWords(n: number): string[] {
  const arr: string[] = [];
  for (let i = 0; i < n; i++) arr.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
  return arr;
}
