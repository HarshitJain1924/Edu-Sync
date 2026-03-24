import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eraser, Trash2, Undo, Palette } from "lucide-react";

interface WhiteboardProps {
  roomId: string;
  userId: string;
  isReadOnly?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
}

const COLORS = ["#ffffff", "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

export default function Whiteboard({ roomId, userId, isReadOnly = false }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [isEraser, setIsEraser] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const channelRef = useRef<any>(null);

  // Resize Listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
         setDimensions({ width: parent.clientWidth, height: parent.clientHeight });
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Initialize and subscribe to realtime drawing events
  useEffect(() => {
    fetchExistingStrokes();

    const channel = supabase.channel(`whiteboard:${roomId}`, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'draw_stroke' }, ({ payload }) => {
      setStrokes(prev => [...prev, payload.stroke]);
    });

    channel.on('broadcast', { event: 'clear_board' }, () => {
      setStrokes([]);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const fetchExistingStrokes = async () => {
    try {
      const { data, error } = await supabase
        .from('room_whiteboard_events')
        .select('stroke')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setStrokes(data.map(d => d.stroke as unknown as Stroke));
      }
    } catch (e) {
      console.warn('Could not fetch existing strokes (table might not exist yet)', e);
    }
  };

  // Redraw canvas when strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all completed strokes
    strokes.forEach(s => drawStroke(ctx, s));
    
    // Draw currently active stroke
    if (currentStroke) {
      drawStroke(ctx, currentStroke);
    }
  }, [strokes, currentStroke, dimensions]);

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    
    ctx.strokeStyle = stroke.isEraser ? "#000000" : stroke.color; // Assuming dark bg
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    if (stroke.isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = stroke.width * 3; // Eraser is thicker
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }
    
    ctx.stroke();
    // Reset
    ctx.globalCompositeOperation = "source-over";
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Scale coordinates based on actual canvas size vs display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getCoordinates(e);
    setIsDrawing(true);
    setCurrentStroke({
      points: [pos],
      color,
      width: 3,
      isEraser
    });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !currentStroke) return;
    
    const pos = getCoordinates(e);
    setCurrentStroke(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        points: [...prev.points, pos]
      };
    });
  };

  const stopDrawing = async () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    
    const finalStroke = currentStroke;
    setStrokes(prev => [...prev, finalStroke]);
    setCurrentStroke(null);

    // Broadcast in real-time
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw_stroke',
      payload: { stroke: finalStroke }
    });

    // Try persisting to DB
    try {
      await supabase.from('room_whiteboard_events').insert({
        room_id: roomId,
        user_id: userId,
        stroke: finalStroke as any,
        color: finalStroke.color
      });
    } catch (e) {
      // Silently fail if table doesn't exist yet
    }
  };

  const clearBoard = async () => {
    setStrokes([]);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'clear_board'
    });
    
    try {
      await supabase.from('room_whiteboard_events').delete().eq('room_id', roomId);
    } catch {}
  };

  const undo = () => {
    if (strokes.length === 0) return;
    setStrokes(prev => prev.slice(0, -1));
    // Complex to sync undo perfectly without an edit log, for now applies locally + could broadcast a full state sync
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-[#0a0a0a] rounded-[2rem] overflow-hidden ring-1 ring-slate-200 dark:ring-white/5 relative group shadow-[0_0_40px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-colors">
        {/* Toolbar - hidden when read-only for students */}
       <div className={`absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/80 dark:bg-[#1a1919]/80 backdrop-blur-3xl p-2.5 rounded-full ring-1 ring-slate-200 dark:ring-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-10 transition-all duration-500 ease-in-out ${isReadOnly ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-40 hover:opacity-100 hover:scale-100'}`}>
         
         <div className="flex items-center gap-2 pr-3 mr-1 relative after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-px after:h-6 after:bg-white/10">
           {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setIsEraser(false); }}
                className={`w-7 h-7 rounded-full transition-all duration-300 shadow-inner 
                           ${color === c && !isEraser ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#1a1919] z-10' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: c }}
              />
           ))}
         </div>

         <Button 
           size="icon" 
           variant={isEraser ? "secondary" : "ghost"} 
           onClick={() => setIsEraser(true)}
           className={`h-9 w-9 rounded-full transition-colors ${isEraser ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
           title="Eraser"
         >
           <Eraser className="h-4.5 w-4.5" />
         </Button>

         <Button 
           size="icon" 
           variant="ghost" 
           onClick={undo}
           className="h-9 w-9 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
           title="Undo"
         >
           <Undo className="h-4.5 w-4.5" />
         </Button>

         <div className="w-[1px] h-6 bg-white/10 mx-1" />

         <Button 
           size="icon" 
           variant="ghost" 
           onClick={clearBoard}
           className="h-9 w-9 rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
           title="Clear Board"
         >
           <Trash2 className="h-4.5 w-4.5" />
         </Button>
       </div>

       {/* Canvas */}
       <div className="flex-1 w-full h-full relative cursor-crosshair">
         {isReadOnly && (
           <div className="absolute inset-0 z-10 flex items-end justify-center pb-8 pointer-events-none">
             <div className="bg-[#0e0e0e]/80 backdrop-blur-xl ring-1 ring-white/10 px-5 py-2.5 rounded-full text-xs font-medium tracking-wide text-gray-400 flex items-center gap-2 shadow-2xl">
               <span className="text-[#3b82f6]">🔒</span> Whiteboard is read-only — host controls drawing
             </div>
           </div>
         )}
         <canvas
           ref={canvasRef}
           width={dimensions.width}
           height={dimensions.height}
           className={`w-full h-full object-contain touch-none ${isReadOnly ? 'pointer-events-none' : 'cursor-crosshair'}`}
           onMouseDown={isReadOnly ? undefined : startDrawing}
           onMouseMove={isReadOnly ? undefined : draw}
           onMouseUp={isReadOnly ? undefined : stopDrawing}
           onMouseOut={isReadOnly ? undefined : stopDrawing}
           onTouchStart={isReadOnly ? undefined : startDrawing}
           onTouchMove={isReadOnly ? undefined : draw}
           onTouchEnd={isReadOnly ? undefined : stopDrawing}
         />
       </div>
    </div>
  );
}
