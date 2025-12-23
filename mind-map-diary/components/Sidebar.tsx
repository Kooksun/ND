"use client";

import { useMaps, MapData } from "@/hooks/useMaps";
import {
    Plus, Search, Calendar, Settings, LogOut, ChevronLeft, ChevronRight,
    Edit2, ListTree, Trash2, Map as MapIcon, FileText, X
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useModal } from "@/contexts/ModalContext";
import { useTheme } from "@/contexts/ThemeContext";
import styles from "./Sidebar.module.css";
import { buildMarkdownSummary } from "@/lib/summarizeMap";
import { summarizeDiary } from "@/utils/gemini";
import { ReportData } from "@/hooks/useReports";
import { toDateValue } from "@/utils/date";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Logo = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
        <path d="M16 24V8C16 8 13 7 9 7C5 7 4 9 4 9V23C4 23 5 21 9 21C13 21 16 22 16 22C16 22 19 21 23 21C27 21 28 23 28 23V9C28 9 27 7 23 7C19 7 16 8 16 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="8" x2="16" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0984e3" />
                <stop offset="1" stopColor="#6c5ce7" />
            </linearGradient>
        </defs>
    </svg>
);

interface SidebarProps {
    selectedId: string | null;
    selectedType: 'map' | 'report';
    onSelect: (id: string | null, type: 'map' | 'report') => void;
    onNewMap: (type?: 'blank' | 'daily' | 'note') => void;
    reports: ReportData[];
    deleteReport: (id: string) => Promise<void>;
}

export default function Sidebar({ selectedId, selectedType, onSelect, onNewMap, reports, deleteReport }: SidebarProps) {
    const { maps, loading, deleteMap, updateMapTitle, updateMapMetadata } = useMaps();
    const { user, logout } = useAuth();
    const modal = useModal();
    const [editingMapId, setEditingMapId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [summarizingMapId, setSummarizingMapId] = useState<string | null>(null);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    });
    const [isDateSummarizing, setIsDateSummarizing] = useState(false);
    const { theme, toggleTheme } = useTheme();

    // Search state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<MapData[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Auto-collapse on mobile devices
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsCollapsed(true);
            } else {
                setIsCollapsed(false);
            }
        };

        // Set initial state
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleEditStart = (map: MapData) => {
        if (isCollapsed) return; // Prevent editing in collapsed mode
        setEditingMapId(map.id);
        setEditTitle(map.title);
    };

    const handleEditSave = async (mapId: string) => {
        if (editTitle.trim()) {
            await updateMapTitle(mapId, editTitle);
        }
        setEditingMapId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent, mapId: string) => {
        if (e.key === 'Enter') {
            handleEditSave(mapId);
        } else if (e.key === 'Escape') {
            setEditingMapId(null);
        }
    };

    const summarizeMap = async (mapId: string, mapTitle: string, forceRegenerate = false) => {
        if (!user) return;
        const map = maps.find(m => m.id === mapId);
        if (!map) return;

        const updatedAt = toDateValue(map.updatedAt)?.getTime() || 0;
        const summarizedAt = toDateValue(map.summarizedAt)?.getTime() || 0;
        const hasNewChanges = updatedAt > summarizedAt;

        // If summary exists and not forcing regeneration, show it first
        // UNLESS there are new changes since the last summary
        if (map.summary && !forceRegenerate && !hasNewChanges) {
            const wantRegenerate = await modal.confirm({
                title: `${map.emotion || "📝"} ${mapTitle} 정리`,
                message: map.summary,
                confirmText: "다시 정리하기",
                cancelText: "닫기",
                tone: "success",
                showCancel: true
            });

            // If user clicked "다시 정리하기" (confirmText returns true)
            if (wantRegenerate) {
                summarizeMap(mapId, mapTitle, true);
            }
            return;
        }

        setSummarizingMapId(mapId);
        // Show a non-blocking loading modal
        modal.show({
            title: "AI 정리 중",
            message: "AI가 소중한 기록들을 따뜻하게 정리하고 있어요. 잠시만 기다려 주세요.",
            tone: "loading",
            allowDismiss: false
        });

        try {
            let markdownBody = "";
            if (map.type === 'note') {
                markdownBody = map.content || "";
            } else {
                markdownBody = await buildMarkdownSummary(user.uid, mapId);
            }

            if (!markdownBody || markdownBody.trim().length === 0) {
                await modal.alert({
                    title: "정리할 노드가 없어요",
                    message: "노드 내용이 비어 있어 정리할 수 없습니다.",
                    tone: "warning",
                    confirmText: "확인"
                });
                return;
            }

            const { summary, emotion, financials } = await summarizeDiary(markdownBody);
            await updateMapMetadata(mapId, { summary, emotion, financials });

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
            setSummarizingMapId(null);
        }
    };


    const formatDateKey = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };

    const extractDateFromTitle = (title?: string) => {
        if (!title) return null;
        const match = title.match(/(\d{2,4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        if (!match) return null;
        const rawYear = Number(match[1]);
        const year = rawYear < 100 ? 2000 + rawYear : rawYear;
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const candidate = new Date(year, month, day);
        return isNaN(candidate.getTime()) ? null : candidate;
    };

    const getMapDateKey = (map: MapData) => {
        const createdAtDate = toDateValue(map.createdAt);
        if (createdAtDate) return formatDateKey(createdAtDate);
        const updatedAtDate = toDateValue(map.updatedAt);
        if (updatedAtDate) return formatDateKey(updatedAtDate);
        const titleDate = extractDateFromTitle(map.title);
        return titleDate ? formatDateKey(titleDate) : null;
    };

    const isDailyMap = (map: MapData) => {
        if (map.type === "daily") return true;
        return /일의 기록/.test(map.title || "");
    };

    const findMapsByDate = (dateKey: string) => {
        return maps.filter((map) => isDailyMap(map) && getMapDateKey(map) === dateKey);
    };

    const getMapTimestamp = (map: MapData) => {
        const updated = toDateValue(map.updatedAt);
        const created = toDateValue(map.createdAt);
        if (updated) return updated.getTime();
        if (created) return created.getTime();
        return 0;
    };

    const handleViewByDate = async () => {
        if (!selectedDate) return;
        const matches = findMapsByDate(selectedDate);
        if (matches.length === 0) {
            await modal.alert({
                title: "데일리 기록이 없어요",
                message: "선택한 날짜에 작성된 데일리 모드 기록을 찾지 못했습니다.",
                tone: "info",
                confirmText: "확인"
            });
            return;
        }
        const latest = [...matches].sort((a, b) => getMapTimestamp(b) - getMapTimestamp(a))[0];
        onSelect(latest.id, 'map');
        setIsDateModalOpen(false);
        setIsCollapsed(false);
    };

    const handleSummarizeByDate = async () => {
        if (!user || !selectedDate) return;
        const matches = findMapsByDate(selectedDate);
        if (matches.length === 0) {
            await modal.alert({
                title: "데일리 기록이 없어요",
                message: "선택한 날짜에 작성된 데일리 모드 기록을 찾지 못했습니다.",
                tone: "info",
                confirmText: "확인"
            });
            return;
        }

        // If only one map found, use the standard individual summary process
        if (matches.length === 1) {
            summarizeMap(matches[0].id, matches[0].title || "제목 없음");
            setIsDateModalOpen(false);
            return;
        }

        setIsDateSummarizing(true);
        // Show a non-blocking loading modal for unified summary
        modal.show({
            title: "통합 정리 중",
            message: "여러 개의 기록들을 하나로 아름답게 엮고 있어요. 잠시만 기다려 주세요.",
            tone: "loading",
            allowDismiss: false
        });

        try {
            const ordered = [...matches].sort((a, b) => getMapTimestamp(a) - getMapTimestamp(b));
            const summaries: string[] = [];

            for (const map of ordered) {
                const summaryBody = await buildMarkdownSummary(user.uid, map.id);
                if (!summaryBody || summaryBody.trim().length === 0) continue;
                const title = map.title || "제목 없음";
                summaries.push(`# ${title}\n\n${summaryBody}`);
            }

            if (summaries.length === 0) {
                await modal.alert({
                    title: "정리할 노드가 없어요",
                    message: "선택한 날짜의 노드 내용이 비어 있습니다.",
                    tone: "warning",
                    confirmText: "확인"
                });
                return;
            }

            const combinedMarkdown = summaries.join("\n\n");
            const { summary, emotion, financials } = await summarizeDiary(combinedMarkdown);

            await modal.alert({
                title: `${emotion} ${selectedDate} 통합 정리 완료`,
                message: summary,
                tone: "success",
                confirmText: "확인"
            });
            // Financials are currently not saved in unified summary by date, 
            // since it's just an alert. If needed, we could save it to a separate report.
            setIsDateModalOpen(false);
        } catch (error) {
            console.error("Failed to summarize maps by date:", error);
            await modal.alert({
                title: "정리를 불러오지 못했어요",
                message: "잠시 후 다시 시도해주세요.",
                tone: "danger",
                confirmText: "확인"
            });
        } finally {
            setIsDateSummarizing(false);
        }
    };


    const handleLogout = async () => {
        const confirmed = await modal.confirm({
            title: "로그아웃 하시겠어요?",
            message: "언제든 다시 로그인할 수 있습니다.",
            confirmText: "로그아웃",
            cancelText: "계속 이용",
            tone: "warning"
        });
        if (!confirmed) return;
        try {
            await logout();
        } catch (error) {
            console.error("Failed to logout:", error);
            await modal.alert({
                title: "로그아웃에 실패했어요",
                message: "잠시 후 다시 시도해주세요.",
                tone: "danger",
                confirmText: "확인"
            });
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim() || !user) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        const queryStr = searchTerm.toLowerCase();

        try {
            // 1. Initial filter based on map-level metadata (FAST)
            const mapResults = maps.filter(map => {
                const inTitle = map.title?.toLowerCase().includes(queryStr);
                const inSummary = map.summary?.toLowerCase().includes(queryStr);
                const inMapContent = map.content?.toLowerCase().includes(queryStr);
                return inTitle || inSummary || inMapContent;
            });

            const foundMapIds = new Set(mapResults.map(r => r.id));
            const nodeMatchMaps: MapData[] = [];

            // 2. Search nodes for maps not already found (SLOWER)
            const remainingMaps = maps.filter(m => !foundMapIds.has(m.id) && m.type !== 'note');

            await Promise.all(remainingMaps.map(async (map) => {
                const nodesRef = collection(db, "users", user.uid, "maps", map.id, "nodes");
                const snapshot = await getDocs(nodesRef);
                const hasMatch = snapshot.docs.some(doc => {
                    const data = doc.data();
                    const label = (data.label || data.data?.label || "").toLowerCase();
                    const content = (data.content || data.data?.content || "").toLowerCase();
                    return label.includes(queryStr) || content.includes(queryStr);
                });

                if (hasMatch) {
                    nodeMatchMaps.push(map);
                }
            }));

            setSearchResults([...mapResults, ...nodeMatchMaps].sort((a, b) => {
                const timeA = toDateValue(a.updatedAt)?.getTime() || 0;
                const timeB = toDateValue(b.updatedAt)?.getTime() || 0;
                return timeB - timeA;
            }));
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleLogoutFromSettings = async () => {
        setIsSettingsOpen(false);
        await handleLogout();
    };

    const mergedList = [
        ...maps.map(m => ({ ...m, sidebarType: 'map' as const })),
        ...reports.map(r => ({ ...r, sidebarType: 'report' as const, title: r.periodDisplay, emotion: r.emotion }))
    ].sort((a, b) => {
        const timeA = toDateValue(a.createdAt)?.getTime() || 0;
        const timeB = toDateValue(b.createdAt)?.getTime() || 0;
        return timeB - timeA;
    });

    if (loading) return <div style={{ width: isCollapsed ? 60 : 250, padding: 20 }}>...</div>;

    return (
        <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    {!isCollapsed && (
                        <div className={styles.logoWrapper}>
                            <Logo />
                        </div>
                    )}
                    <div className={styles.headerActions}>
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className={styles.iconButton}
                            title="설정"
                            data-tooltip={isCollapsed ? "설정" : undefined}
                        >
                            <Settings size={18} />
                        </button>
                        {!isCollapsed && (
                            <>
                                <button
                                    onClick={() => setIsDateModalOpen(true)}
                                    className={styles.iconButton}
                                    title="날짜로 이동"
                                >
                                    <Calendar size={18} />
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSearchOpen(true);
                                        setSearchTerm("");
                                        setSearchResults([]);
                                    }}
                                    className={styles.iconButton}
                                    title="검색"
                                >
                                    <Search size={18} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className={styles.toggleButton}
                            title={isCollapsed ? "펼치기" : "접기"}
                        >
                            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                        </button>
                    </div>
                </div>

                <div className={styles.buttonGroup}>
                    <button
                        onClick={() => onNewMap('note')}
                        className={styles.newButton}
                        title="새 페이지"
                        data-tooltip={isCollapsed ? "새 페이지" : undefined}
                    >
                        <Plus size={18} />
                        <span className={styles.buttonText}>새 페이지</span>
                    </button>
                    <button
                        onClick={() => onNewMap('daily')}
                        className={`${styles.newButton} ${styles.dailyButton}`}
                        title="새 마인드맵"
                        style={isCollapsed ? { marginTop: '5px', backgroundColor: '#e17055' } : { marginLeft: '5px', backgroundColor: '#e17055' }}
                        data-tooltip={isCollapsed ? "새 마인드맵" : undefined}
                    >
                        <Plus size={18} />
                        <span className={styles.buttonText}>새 마인드맵</span>
                    </button>
                </div>
            </div>

            <div className={styles.list}>
                <div className={styles.listContent}>
                    {mergedList.map((item) => (
                        <div
                            key={item.id}
                            className={`${styles.item} ${selectedId === item.id ? styles.itemActive : ''}`}
                            onClick={() => onSelect(item.id, item.sidebarType)}
                            onMouseEnter={() => setHoveredMapId(item.id)}
                            onMouseLeave={() => setHoveredMapId(null)}
                            title={isCollapsed ? item.title : undefined}
                            data-tooltip={isCollapsed ? item.title : undefined}
                        >
                            <div className={styles.itemLeft}>
                                <div className={styles.iconContainer}>
                                    {item.emotion ? (
                                        <span className={styles.emotionEmoji}>{item.emotion}</span>
                                    ) : (
                                        item.sidebarType === 'report' ? (
                                            <FileText size={18} color={selectedId === item.id ? "#6c5ce7" : "#b2bec3"} />
                                        ) : (
                                            <MapIcon size={18} color={selectedId === item.id ? "#0984e3" : "#b2bec3"} />
                                        )
                                    )}
                                </div>
                                {!isCollapsed && (
                                    item.sidebarType === 'map' && editingMapId === item.id ? (
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={() => handleEditSave(item.id)}
                                            onKeyDown={(e) => handleKeyDown(e, item.id)}
                                            className={styles.input}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <div className={styles.mapTitleWrapper}>
                                            {selectedId === item.id ? (
                                                <div className={styles.tickerTrack}>
                                                    <div className={styles.tickerSequence}>
                                                        <span className={styles.tickerText}>{item.title}</span>
                                                    </div>
                                                    <div className={styles.tickerSequence}>
                                                        <span className={styles.tickerText}>{item.title}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={styles.mapTitle}>{item.title}</span>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>

                            {!isCollapsed && (hoveredMapId === item.id || selectedId === item.id) && (
                                <div className={styles.actions}>
                                    {item.sidebarType === 'map' ? (
                                        <>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditStart(item as MapData);
                                                }}
                                                className={styles.actionButton}
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    summarizeMap(item.id, item.title!);
                                                }}
                                                className={styles.actionButton}
                                                disabled={summarizingMapId === item.id}
                                                title="정리 보기"
                                            >
                                                <ListTree size={12} />
                                            </button>
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const confirmed = await modal.confirm({
                                                        title: "페이지를 삭제할까요?",
                                                        message: "삭제 후에는 복구가 어려워요.",
                                                        confirmText: "삭제하기",
                                                        cancelText: "취소",
                                                        tone: "danger"
                                                    });
                                                    if (!confirmed) return;
                                                    if (selectedId === item.id) {
                                                        const currentIndex = maps.findIndex(m => m.id === item.id);
                                                        let nextId = null;
                                                        if (currentIndex < maps.length - 1) {
                                                            nextId = maps[currentIndex + 1].id;
                                                        } else if (currentIndex > 0) {
                                                            nextId = maps[currentIndex - 1].id;
                                                        }
                                                        onSelect(nextId, 'map');
                                                    }
                                                    deleteMap(item.id);
                                                }}
                                                className={styles.actionButton}
                                                style={{ color: '#d63031' }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                const confirmed = await modal.confirm({
                                                    title: "보고서를 삭제할까요?",
                                                    message: "삭제 후에는 복구가 어려워요.",
                                                    confirmText: "삭제하기",
                                                    cancelText: "취소",
                                                    tone: "danger"
                                                });
                                                if (!confirmed) return;
                                                if (selectedId === item.id) {
                                                    const currentIndex = reports.findIndex(r => r.id === item.id);
                                                    let nextId = null;
                                                    if (currentIndex < reports.length - 1) {
                                                        nextId = reports[currentIndex + 1].id;
                                                    } else if (currentIndex > 0) {
                                                        nextId = reports[currentIndex - 1].id;
                                                    }
                                                    onSelect(nextId, 'report');
                                                }
                                                deleteReport(item.id);
                                            }}
                                            className={styles.actionButton}
                                            style={{ color: '#d63031' }}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {isDateModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsDateModalOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitle}>날짜 선택</div>
                            <button
                                onClick={() => setIsDateModalOpen(false)}
                                className={styles.iconButton}
                                title="닫기"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <label className={styles.modalLabel} htmlFor="date-picker">달력에서 날짜를 선택하세요</label>
                            <input
                                id="date-picker"
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className={styles.dateInput}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                className={styles.modalActionButton}
                                onClick={handleViewByDate}
                                disabled={!selectedDate}
                            >
                                보기
                            </button>
                            <button
                                className={styles.modalActionButton}
                                onClick={handleSummarizeByDate}
                                disabled={!selectedDate || isDateSummarizing}
                                style={{ backgroundColor: "#6c5ce7" }}
                            >
                                {isDateSummarizing ? "정리 중..." : "정리"}
                            </button>
                            <button
                                className={styles.modalActionButton}
                                onClick={() => setIsDateModalOpen(false)}
                                style={{ backgroundColor: "#b2bec3", color: "#2d3436" }}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSettingsOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsSettingsOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitle}>설정</div>
                        </div>
                        <div className={styles.settingsBody}>
                            <div className={styles.settingsRow}>
                                <div className={styles.settingsText}>
                                    <div className={styles.settingsLabel}>테마</div>
                                    <div className={styles.settingsHint}>일반 / 다크</div>
                                </div>
                                <button
                                    className={`${styles.switch} ${theme === "dark" ? styles.switchOn : ""}`}
                                    onClick={toggleTheme}
                                    aria-label="테마 전환"
                                >
                                    <span className={styles.switchKnob}>{theme === "dark" ? "D" : "L"}</span>
                                </button>
                            </div>

                            <div className={styles.settingsDivider} />

                            <div className={styles.settingsRow}>
                                <div className={styles.settingsText}>
                                    <div className={styles.settingsLabel}>계정</div>
                                    <div className={styles.settingsHint}>로그아웃 후 언제든 다시 로그인할 수 있어요.</div>
                                </div>
                                <button className={styles.logoutAction} onClick={handleLogoutFromSettings}>
                                    <LogOut size={14} />
                                    로그아웃
                                </button>
                            </div>
                        </div>
                        <div className={styles.modalActions} style={{ justifyContent: "center" }}>
                            <button
                                className={styles.modalActionButton}
                                onClick={() => setIsSettingsOpen(false)}
                                style={{ width: '120px', flex: 'none' }}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSearchOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsSearchOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div className={styles.modalTitle}>기록 검색</div>
                            <button
                                onClick={() => setIsSearchOpen(false)}
                                className={styles.iconButton}
                                title="닫기"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.searchBox}>
                                <input
                                    type="text"
                                    placeholder="제목, 요약, 또는 노트 내용 검색..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    className={styles.searchInput}
                                    autoFocus
                                />
                                <button className={styles.searchButton} onClick={handleSearch} disabled={isSearching}>
                                    {isSearching ? <div className={styles.spinner} /> : <Search size={18} />}
                                </button>
                            </div>

                            <div className={styles.searchResults}>
                                {isSearching ? (
                                    <div className={styles.loadingResults}>전체 기록을 꼼꼼히 찾고 있어요...</div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(result => (
                                        <div
                                            key={result.id}
                                            className={styles.searchResultItem}
                                            onClick={() => {
                                                onSelect(result.id, 'map');
                                                setIsSearchOpen(false);
                                            }}
                                        >
                                            <div className={styles.resultEmoji}>{result.emotion || (result.type === 'note' ? "📄" : "🗺️")}</div>
                                            <div className={styles.resultInfo}>
                                                <div className={styles.resultTitle}>{result.title}</div>
                                                {result.summary && (
                                                    <div className={styles.resultSummary}>{result.summary.slice(0, 60)}...</div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    searchTerm && <div className={styles.noResults}>검색 결과가 없습니다.</div>
                                )}
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                className={styles.modalActionButton}
                                onClick={() => setIsSearchOpen(false)}
                                style={{ backgroundColor: "#b2bec3", color: "#2d3436" }}
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
