"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useModal } from "@/contexts/ModalContext";
import MindMap from "@/components/MindMap";
import Sidebar from "@/components/Sidebar";
import { useMaps } from "@/hooks/useMaps";
import { useReports } from "@/hooks/useReports";
import ReportViewer from "@/components/ReportViewer";
import { Edit2, ListTree, Trash2 } from "lucide-react";
import { buildMarkdownSummary } from "@/lib/summarizeMap";
import { summarizeDiary } from "@/utils/gemini";
import { toDateValue } from "@/utils/date";

export default function Home() {
  const { user, loading } = useAuth();
  const { maps, createMap, updateMapTitle, deleteMap, updateMapMetadata } = useMaps();
  const { reports, loadingReports, deleteReport } = useReports(maps);
  const router = useRouter();
  const modal = useModal();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'map' | 'report'>('map');

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Effect to select the most recent item on load
  useEffect(() => {
    if (!selectedId && !loading && !loadingReports) {
      // Find the most recent among maps and reports
      const latestMap = maps[0];
      const latestReport = reports[0];

      if (!latestMap && !latestReport) return;

      const mapTime = latestMap?.createdAt?.seconds || 0;
      const reportTime = latestReport?.createdAt?.seconds || 0;

      if (reportTime > mapTime) {
        setSelectedId(latestReport.id);
        setSelectedType('report');
      } else if (latestMap) {
        setSelectedId(latestMap.id);
        setSelectedType('map');
      }
    }
  }, [maps, reports, loading, loadingReports, selectedId]);

  const handleSelect = (id: string | null, type: 'map' | 'report') => {
    setSelectedId(id);
    setSelectedType(type);
  };

  const handleNewMap = async (type: 'blank' | 'daily' = 'blank') => {
    const newId = await createMap(undefined, type);
    if (newId) {
      handleSelect(newId, 'map');
    }
  };

  const handleTitleEdit = async () => {
    if (!selectedId || selectedType !== 'map') return;
    const currentTitle = maps.find(m => m.id === selectedId)?.title || "";
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
      await updateMapTitle(selectedId, trimmed);
    }
  };

  const handleSummary = async (forceRegenerate = false) => {
    if (!user || !selectedId || selectedType !== 'map') return;
    const map = maps.find(m => m.id === selectedId);
    if (!map) return;
    const mapTitle = map.title || "제목 없음";

    const updatedAt = toDateValue(map.updatedAt)?.getTime() || 0;
    const summarizedAt = toDateValue(map.summarizedAt)?.getTime() || 0;
    const hasNewChanges = updatedAt > summarizedAt;

    if (map.summary && !forceRegenerate && !hasNewChanges) {
      const wantRegenerate = await modal.confirm({
        title: `${map.emotion || "📝"} ${mapTitle} 정리`,
        message: map.summary,
        confirmText: "다시 정리하기",
        cancelText: "닫기",
        tone: "success",
        showCancel: true
      });
      if (wantRegenerate) handleSummary(true);
      return;
    }

    setIsSummarizing(true);
    modal.show({
      title: "AI 정리 중",
      message: "AI가 소중한 기록들을 따뜻하게 정리하고 있어요. 잠시만 기다려 주세요.",
      tone: "loading",
      allowDismiss: false
    });

    try {
      const markdownBody = await buildMarkdownSummary(user.uid, selectedId);
      if (!markdownBody || markdownBody.trim().length === 0) {
        setIsSummarizing(false);
        await modal.alert({
          title: "정리할 노드가 없어요",
          message: "노드 내용이 비어 있어 정리할 수 없습니다.",
          tone: "warning",
          confirmText: "확인"
        });
        return;
      }

      const { summary, emotion } = await summarizeDiary(markdownBody);
      await updateMapMetadata(selectedId, { summary, emotion });

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
    if (!selectedId || isDeleting) return;
    const typeLabel = selectedType === 'map' ? '페이지를' : '보고서를';
    const confirmed = await modal.confirm({
      title: `${typeLabel} 삭제할까요?`,
      message: "삭제 후에는 복구가 어려워요.",
      confirmText: "삭제하기",
      cancelText: "취소",
      tone: "danger"
    });
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      if (selectedType === 'map') {
        const currentIndex = maps.findIndex(m => m.id === selectedId);
        let nextId: string | null = null;
        if (currentIndex < maps.length - 1) {
          nextId = maps[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          nextId = maps[currentIndex - 1].id;
        }
        await deleteMap(selectedId);
        handleSelect(nextId, 'map');
      } else {
        const currentIndex = reports.findIndex(r => r.id === selectedId);
        let nextId: string | null = null;
        if (currentIndex < reports.length - 1) {
          nextId = reports[currentIndex + 1].id;
        } else if (currentIndex > 0) {
          nextId = reports[currentIndex - 1].id;
        }
        await deleteReport(selectedId);
        handleSelect(nextId, 'report');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || loadingReports) return <div>Loading...</div>;
  if (!user) return null;

  const currentMap = selectedType === 'map' ? maps.find(m => m.id === selectedId) : null;
  const currentReport = selectedType === 'report' ? reports.find(r => r.id === selectedId) : null;

  return (
    <main style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <Sidebar
        selectedId={selectedId}
        selectedType={selectedType}
        onSelect={handleSelect}
        onNewMap={handleNewMap}
        reports={reports}
        deleteReport={deleteReport}
      />
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
        {selectedType === 'map' && (
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
              {currentMap?.emotion && <span style={{ marginRight: 8 }}>{currentMap.emotion}</span>}
              {currentMap?.title || "Mind Map Diary"}
            </h1>
            {selectedId && (
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
        )}

        {selectedType === 'map' ? (
          <MindMap mapId={selectedId} key={selectedId || "empty"} />
        ) : (
          currentReport && <ReportViewer report={currentReport} />
        )}
      </div>
    </main>
  );
}
