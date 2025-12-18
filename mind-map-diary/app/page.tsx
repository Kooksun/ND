"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useModal } from "@/contexts/ModalContext";
import MindMap from "@/components/MindMap";
import Sidebar from "@/components/Sidebar";
import { useMaps } from "@/hooks/useMaps";
import { Edit2, ListTree, Trash2 } from "lucide-react";
import { buildMarkdownSummary } from "@/lib/summarizeMap";
import { summarizeDiary } from "@/utils/gemini";

export default function Home() {
  const { user, loading } = useAuth();
  const { maps, createMap, updateMapTitle, deleteMap, updateMapMetadata } = useMaps();
  const router = useRouter();
  const modal = useModal();
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
    const nextTitle = await modal.prompt({
      title: "제목을 바꿀까요?",
      message: "새 제목을 입력해 주세요.",
      initialValue: currentTitle,
      confirmText: "저장",
      cancelText: "취소",
      inputPlaceholder: "새 페이지 제목",
      tone: "info"
    });
    if (!nextTitle) return;
    const trimmed = nextTitle.trim();
    if (trimmed.length > 0 && trimmed !== currentTitle) {
      await updateMapTitle(currentMapId, trimmed);
    }
  };

  const handleSummary = async (forceRegenerate = false) => {
    if (!user || !currentMapId) return;
    const map = maps.find(m => m.id === currentMapId);
    const mapTitle = map?.title || "제목 없음";

    // If summary exists and not forcing regeneration, show it first
    if (map?.summary && !forceRegenerate) {
      const wantRegenerate = await modal.confirm({
        title: `${map.emotion || "📝"} ${mapTitle} 정리`,
        message: map.summary,
        confirmText: "닫기",
        cancelText: "다시 정리하기",
        tone: "success",
        showCancel: true
      });

      // If user clicked "다시 정리하기" (cancelText returns false in modal.confirm)
      if (!wantRegenerate) {
        handleSummary(true);
      }
      return;
    }

    setIsSummarizing(true);
    // Show a non-blocking loading modal
    const loadingModal = modal.show({
      title: "AI 정리 중",
      message: "AI가 소중한 기록들을 따뜻하게 정리하고 있어요. 잠시만 기다려 주세요.",
      tone: "loading",
      allowDismiss: false
    });

    try {
      // 1. Build Markdown from nodes
      const markdownBody = await buildMarkdownSummary(user.uid, currentMapId);
      if (!markdownBody || markdownBody.trim().length === 0) {
        setIsSummarizing(false);
        // Important: we need to dismiss the loading modal before showing the alert
        // But since we can't easily dismiss it with the current useModal, 
        // I will assume the next modal will replace it.
        await modal.alert({
          title: "정리할 노드가 없어요",
          message: "노드 내용이 비어 있어 정리할 수 없습니다.",
          tone: "warning",
          confirmText: "확인"
        });
        return;
      }

      // 2. AI Summarization & Emotion Analysis
      const { summary, emotion } = await summarizeDiary(markdownBody);

      // 3. Save result back to map metadata
      await updateMapMetadata(currentMapId, { summary, emotion });

      // 4. Show final result (this will replace the loading modal)
      await modal.alert({
        title: `${emotion} ${mapTitle} 정리 완료`,
        message: summary,
        tone: "success",
        confirmText: "확인"
      });

    } catch (error) {
      console.error("Failed to summarize map:", error);
      await modal.alert({
        title: "정리를 불러오지 못했어요",
        message: "잠시 후 다시 시도해주세요.",
        tone: "danger",
        confirmText: "확인"
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDelete = async () => {
    if (!currentMapId || isDeleting) return;
    const confirmed = await modal.confirm({
      title: "페이지를 삭제할까요?",
      message: "삭제 후에는 복구가 어려워요.",
      confirmText: "삭제하기",
      cancelText: "취소",
      tone: "danger"
    });
    if (!confirmed) return;
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
            {maps.find(m => m.id === currentMapId)?.emotion && <span style={{ marginRight: 8 }}>{maps.find(m => m.id === currentMapId)?.emotion}</span>}
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
                onClick={() => handleSummary()}
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
