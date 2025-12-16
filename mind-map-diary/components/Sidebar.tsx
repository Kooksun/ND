"use client";

import { useMaps, MapData } from "@/hooks/useMaps";
import { Plus, Map, Trash2, Edit2, PanelLeft } from "lucide-react";
import { useState, useEffect } from "react";
import styles from "./Sidebar.module.css";

interface SidebarProps {
    currentMapId: string | null;
    onSelectMap: (mapId: string | null) => void;
    onNewMap: (type: 'blank' | 'daily') => void;
}

export default function Sidebar({ currentMapId, onSelectMap, onNewMap }: SidebarProps) {
    const { maps, loading, deleteMap, updateMapTitle } = useMaps();
    const [editingMapId, setEditingMapId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [hoveredMapId, setHoveredMapId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

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
                    >
                        <Plus size={18} />
                        <span className={styles.buttonText}>새 페이지</span>
                    </button>
                    <button
                        onClick={() => onNewMap('daily')}
                        className={`${styles.newButton} ${styles.dailyButton}`}
                        title="데일리 모드"
                        style={isCollapsed ? { marginTop: '5px', backgroundColor: '#e17055' } : { marginLeft: '5px', backgroundColor: '#e17055' }}
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
                        >
                            <div className={styles.itemLeft}>
                                <Map size={18} color={currentMapId === map.id ? "#0984e3" : "#b2bec3"} />
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
                                        <span className={styles.mapTitle}>{map.title}</span>
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
