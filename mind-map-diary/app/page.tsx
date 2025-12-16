"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import MindMap from "@/components/MindMap";
import Sidebar from "@/components/Sidebar";
import { useMaps } from "@/hooks/useMaps";
import { Edit2, ListTree, Trash2 } from "lucide-react";
import { buildMarkdownSummary } from "@/lib/summarizeMap";

export default function Home() {
  const { user, loading } = useAuth();
  const { maps, createMap, updateMapTitle, deleteMap } = useMaps();
  const router = useRouter();
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleTitleEdit = async () => {
    if (!currentMapId) return;
    const currentTitle = maps.find(m => m.id === currentMapId)?.title || "";
    const nextTitle = prompt("새 제목을 입력하세요.", currentTitle);
    if (nextTitle && nextTitle.trim().length > 0 && nextTitle !== currentTitle) {
      await updateMapTitle(currentMapId, nextTitle.trim());
    }
  };

  const handleSummary = async () => {
    if (!user || !currentMapId) return;
    setIsSummarizing(true);
    const mapTitle = maps.find(m => m.id === currentMapId)?.title || "제목 없음";
    try {
      const summaryBody = await buildMarkdownSummary(user.uid, currentMapId);
      if (!summaryBody || summaryBody.trim().length === 0) {
        alert("요약할 노드가 없습니다.");
        return;
      }
      const summaryText = `# ${mapTitle}\n\n${summaryBody}`;
      try {
        await navigator.clipboard.writeText(summaryText);
        alert(`${mapTitle} 정리 내용을 클립보드에 복사했어요.\n\n${summaryText}`);
      } catch {
        alert(`${mapTitle} 정리 내용입니다.\n\n${summaryText}`);
      }
    } catch (error) {
      console.error("Failed to summarize map:", error);
      alert("요약을 불러오지 못했습니다. 다시 시도해주세요.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDelete = async () => {
    if (!currentMapId || isDeleting) return;
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setIsDeleting(true);
    try {
      const currentIndex = maps.findIndex(m => m.id === currentMapId);
      let nextMapId: string | null = null;
      if (currentIndex < maps.length - 1) {
        nextMapId = maps[currentIndex + 1].id;
      } else if (currentIndex > 0) {
        nextMapId = maps[currentIndex - 1].id;
      }
      await deleteMap(currentMapId);
      setCurrentMapId(nextMapId);
    } finally {
      setIsDeleting(false);
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
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
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
          {currentMapId && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleTitleEdit}
                style={{ padding: '8px', borderRadius: 8, border: '1px solid #e1e1e1', background: 'white', cursor: 'pointer' }}
                title="제목 수정"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={handleSummary}
                style={{ padding: '8px', borderRadius: 8, border: '1px solid #e1e1e1', background: 'white', cursor: isSummarizing ? 'progress' : 'pointer', opacity: isSummarizing ? 0.7 : 1 }}
                disabled={isSummarizing}
                title="정리 보기"
              >
                <ListTree size={14} />
              </button>
              <button
                onClick={handleDelete}
                style={{ padding: '8px', borderRadius: 8, border: '1px solid #e1e1e1', background: 'white', cursor: isDeleting ? 'progress' : 'pointer', opacity: isDeleting ? 0.7 : 1 }}
                disabled={isDeleting}
                title="삭제"
              >
                <Trash2 size={14} color="#d63031" />
              </button>
            </div>
          )}
        </div>
        <MindMap mapId={currentMapId} key={currentMapId || "empty"} />
      </div>
    </main>
  );
}
