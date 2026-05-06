import React, { useState } from 'react';

export default function HUD({ state, socket }) {
  const [cmd, setCmd] = useState("");
  const fillPct = (state.currentTrash / state.bagCapacity) * 100;

  // Color transitions based on fullness
  const barColor = fillPct > 90 ? "bg-red-500" : fillPct > 50 ? "bg-yellow-400" : "bg-emerald-500";

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
      
      {/* Top Left: Coins */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl w-48 pointer-events-auto shadow-[0_0_15px_rgba(255,255,255,0.1)]">
        <h1 className="text-yellow-400 font-bold text-2xl">🪙 {state.coins}</h1>
      </div>

      {/* Bottom Center: Dynamic Bag Capacity */}
      <div className="self-center mb-10 w-96 pointer-events-auto">
        <div className="bg-black/40 backdrop-blur-xl border border-white/20 p-3 rounded-2xl">
          <div className="flex justify-between text-white text-xs mb-2 font-bold tracking-widest uppercase">
            <span>Storage Tier</span>
            <span>{state.currentTrash} / {state.bagCapacity}</span>
          </div>
          <div className="h-4 bg-gray-900 rounded-full overflow-hidden border border-white/10">
            <div 
              className={`h-full ${barColor} transition-all duration-300 shadow-[0_0_10px_currentColor]`}
              style={{ width: `${Math.min(100, fillPct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Command Input for Passwords */}
      <form className="absolute bottom-6 left-6 pointer-events-auto" onSubmit={(e) => {
        e.preventDefault();
        socket.emit('chat_command', cmd);
        setCmd("");
      }}>
        <input 
          value={cmd}
          onChange={e => setCmd(e.target.value)}
          placeholder="Admin Command..."
          className="bg-black/50 text-white px-3 py-2 rounded-lg border border-white/20 backdrop-blur-md outline-none focus:border-emerald-400 transition"
        />
      </form>

    </div>
  );
}
