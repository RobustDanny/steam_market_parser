// "use client"

// import { ChevronUp, ChevronDown, Pause, Play, Eye, EyeOff } from "lucide-react"
// import { useState } from "react"
// import { cn } from "@/lib/utils"

// interface ScrollControlsProps {
//     onScrollUp: () => void
//     onScrollDown: () => void
// }

// export function ScrollControls({ onScrollUp, onScrollDown }: ScrollControlsProps) {
//     const [isPaused, setIsPaused] = useState(false)
//     const [isVisible, setIsVisible] = useState(true)

//     return (
//         <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2">
//             {/* Toggle visibility button - always shown */}
//             <button
//                 onClick={() => setIsVisible(!isVisible)}
//                 className="flex h-8 w-8 items-center justify-center rounded-full bg-card/60 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
//                 aria-label={isVisible ? "Hide controls" : "Show controls"}
//             >
//                 {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
//             </button>

//             {/* Scroll controls - hideable */}
//             <div className={cn(
//                 "flex flex-col items-center gap-2 transition-all duration-200",
//                 isVisible ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none h-0"
//             )}>
//                 <button
//                     onClick={onScrollUp}
//                     className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
//                     aria-label="Scroll up"
//                 >
//                     <ChevronUp className="h-5 w-5" />
//                 </button>
//                 <button
//                     onClick={() => setIsPaused(!isPaused)}
//                     className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
//                     aria-label={isPaused ? "Resume" : "Pause"}
//                 >
//                     {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
//                 </button>
//                 <button
//                     onClick={onScrollDown}
//                     className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
//                     aria-label="Scroll down"
//                 >
//                     <ChevronDown className="h-5 w-5" />
//                 </button>
//             </div>
//         </div>
//     )
// }
