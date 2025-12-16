"use client";

import { useMaps, MapData } from "@/hooks/useMaps";
import { Plus, Map as MapIcon, Trash2, Edit2, PanelLeft, ListTree } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./Sidebar.module.css";
import { buildMarkdownSummary } from "@/lib/summarizeMap";

interface SidebarProps {
    currentMapId: string | null;
    onSelectMap: (mapId: string | null) => void;
    onNewMap: (type: 'blank' | 'daily') => void;
}

export default function Sidebar({ currentMapId, onSelectMap, onNewMap }: SidebarProps) {
    const { maps, loading, deleteMap, updateMapTitle } = useMaps();
    const { user } = useAuth();
    const [editingMapId, setEditingMapId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [summarizingMapId, setSummarizingMapId] = useState<string | null>(null);

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

    const summarizeMap = async (mapId: string, mapTitle: string) => {
        if (!user) return;
        setSummarizingMapId(mapId);
        try {
            const summaryBody = await buildMarkdownSummary(user.uid, mapId);
            if (!summaryBody || summaryBody.trim().length === 0) {
                alert("요약할 노드가 없습니다.");
                return;
            }
            const summaryText = `# ${mapTitle}\\n\\n${summaryBody}`;

            try {
                await navigator.clipboard.writeText(summaryText);
                alert(`${mapTitle} 정리 내용을 클립보드에 복사했어요.\\n${summaryText}`);
            } catch {
                alert(`${mapTitle} 정리 내용입니다.\\n${summaryText}`);
            }
        } catch (error) {
            console.error("Failed to summarize map:", error);
            alert("요약을 불러오지 못했습니다. 다시 시도해주세요.");
        } finally {
            setSummarizingMapId(null);
        }
    };

    if (loading) return <div style={{ width: isCollapsed ? 60 : 250, padding: 20 }}>...</div>;

    return (
        <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    {!isCollapsed && <h2 className={styles.title}>내 다이어리</h2>}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={styles.toggleButton}
                        title={isCollapsed ? "펼치기" : "접기"}
                    >
                        {isCollapsed ? <PanelLeft size={20} /> : <PanelLeft size={20} />}
                    </button>
                </div>

                <div className={styles.buttonGroup}>
                    <button
                        onClick={() => onNewMap('blank')}
                        className={styles.newButton}
                        title="빈 페이지"
                        data-tooltip={isCollapsed ? "새 페이지" : undefined}
                    >
                        <Plus size={18} />
                        <span className={styles.buttonText}>새 페이지</span>
                    </button>
                    <button
                        onClick={() => onNewMap('daily')}
                        className={`${styles.newButton} ${styles.dailyButton}`}
                        title="데일리 모드"
                        style={isCollapsed ? { marginTop: '5px', backgroundColor: '#e17055' } : { marginLeft: '5px', backgroundColor: '#e17055' }}
                        data-tooltip={isCollapsed ? "데일리 모드" : undefined}
                    >
                        <Plus size={18} />
                        <span className={styles.buttonText}>데일리</span>
                    </button>
                </div>
            </div>

            <div className={styles.list}>
                <div className={styles.listContent}>
                    {maps.map((map) => (
                        <div
                            key={map.id}
                            className={`${styles.item} ${currentMapId === map.id ? styles.itemActive : ''}`}
                            onClick={() => onSelectMap(map.id)}
                            onMouseEnter={() => setHoveredMapId(map.id)}
                            onMouseLeave={() => setHoveredMapId(null)}
                            title={isCollapsed ? map.title : undefined}
                            data-tooltip={isCollapsed ? map.title : undefined}
                        >
                            <div className={styles.itemLeft}>
                                <MapIcon size={18} color={currentMapId === map.id ? "#0984e3" : "#b2bec3"} />
                                {!isCollapsed && (
                                    editingMapId === map.id ? (
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            onBlur={() => handleEditSave(map.id)}
                                            onKeyDown={(e) => handleKeyDown(e, map.id)}
                                            className={styles.input}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <div className={styles.mapTitleWrapper}>
                                            {currentMapId === map.id ? (
                                                <div className={styles.tickerTrack}>
                                                    <div className={styles.tickerSequence}>
                                                        <span className={styles.tickerText}>{map.title}</span>
                                                    </div>
                                                    <div className={styles.tickerSequence}>
                                                        <span className={styles.tickerText}>{map.title}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={styles.mapTitle}>{map.title}</span>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>

                            {!isCollapsed && (hoveredMapId === map.id || currentMapId === map.id) && (
                                <div className={styles.actions}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditStart(map);
                                        }}
                                        className={styles.actionButton}
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            summarizeMap(map.id, map.title);
                                        }}
                                        className={styles.actionButton}
                                        disabled={summarizingMapId === map.id}
                                        title="정리 보기"
                                    >
                                        <ListTree size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm("정말 삭제하시겠습니까?")) {
                                                if (currentMapId === map.id) {
                                                    const currentIndex = maps.findIndex(m => m.id === map.id);
                                                    let nextMapId = null;
                                                    if (currentIndex < maps.length - 1) {
                                                        nextMapId = maps[currentIndex + 1].id;
                                                    } else if (currentIndex > 0) {
                                                        nextMapId = maps[currentIndex - 1].id;
                                                    }
                                                    onSelectMap(nextMapId);
                                                }
                                                deleteMap(map.id);
                                            }
                                        }}
                                        className={styles.actionButton}
                                        style={{ color: '#d63031' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
