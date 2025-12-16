"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import MindMap from "@/components/MindMap";
import Sidebar from "@/components/Sidebar";
import { useMaps } from "@/hooks/useMaps";

export default function Home() {
  const { user, loading } = useAuth();
  const { maps, createMap } = useMaps();
  const router = useRouter();
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Effect to select the most recent map on load if none selected
  useEffect(() => {
    if (!currentMapId && maps.length > 0) {
      setCurrentMapId(maps[0].id);
    }
  }, [maps]);

  const handleNewMap = async (type: 'blank' | 'daily' = 'blank') => {
    const newId = await createMap(undefined, type);
    if (newId) {
      setCurrentMapId(newId);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return (
    <main style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <Sidebar
        currentMapId={currentMapId}
        onSelectMap={setCurrentMapId}
        onNewMap={handleNewMap}
      />
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#2d3436',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            padding: '4px 12px',
            borderRadius: '8px',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>
            {maps.find(m => m.id === currentMapId)?.title || "Mind Map Diary"}
          </h1>
        </div>
        <MindMap mapId={currentMapId} key={currentMapId || "empty"} />
      </div>
    </main>
  );
}
