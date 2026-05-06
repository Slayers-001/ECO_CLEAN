import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { io } from 'socket.io-client';
import HUD from './HUD';

// Dummy game component since Game.jsx isn't fully written yet
function Game() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}

// Connect to Node.js backend
const socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:3000");

export default function App() {
  const [gameState, setGameState] = useState(null);
  const [ecoScore, setEcoScore] = useState(0);

  useEffect(() => {
    socket.on('init', (data) => setGameState(data));
    socket.on('sync_state', (data) => setGameState(data));
    socket.on('eco_update', (score) => setEcoScore(score));
    return () => socket.off();
  }, []);

  if (!gameState) return <div className="text-white">Connecting to Eco-Nexus...</div>;

  // Skybox logic: Grey (Toxic) to Blue (Clear)
  const skyColor = `hsl(210, ${Math.min(100, ecoScore / 10)}%, ${Math.max(20, ecoScore / 10)}%)`;

  return (
    <div className="w-screen h-screen relative bg-black">
      {/* 3D Render Loop */}
      <Canvas style={{ background: skyColor }}>
        <ambientLight intensity={0.5} />
        <Game socket={socket} ecoScore={ecoScore} status={gameState.status} />
      </Canvas>

      {/* 2D Glassmorphism Overlay */}
      <HUD state={gameState} socket={socket} />
    </div>
  );
}
