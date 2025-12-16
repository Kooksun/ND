"use client";
import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    useReactFlow,
    ReactFlowProvider,
    Panel
} from "reactflow";
import "reactflow/dist/style.css";
import { useMindMap } from "@/hooks/useMindMap";
import DiaryNode from "./DiaryNode";
import { Plus } from "lucide-react";

const defaultViewport = { x: 0, y: 0, zoom: 1.5 };

function MindMapContent({ mapId }: { mapId: string | null }) {
    const {
        nodes,
        edges,
        onNodesChange: hookOnNodesChange,
        onEdgesChange: hookOnEdgesChange,
        onConnect: hookOnConnect,
        addNode,
        addNewEdge,
        updateNodePosition,
        updateNodeContent,
        updateNodeVisibility,
        deleteNode
    } = useMindMap(mapId);

    const reactFlowInstance = useReactFlow();

    const handleDeleteNode = useCallback(async (nodeId: string) => {
        // Confirmation is handled in DiaryEditor for button click,
        // but for keyboard we might want a simple confirm or just do it.
        // Let's rely on the caller to handle confirmation if needed.
        await deleteNode(nodeId);
    }, [deleteNode]);

    const nodeTypes = useMemo(() => ({
        diary: DiaryNode,
        default: DiaryNode // Use DiaryNode as default too for now
    }), []);

    const handleAddNode = useCallback(async (parentId: string | null = null, parentPos: { x: number, y: number } | null = null) => {
        // Calculate position
        let position = { x: 0, y: 0 };
        if (parentId && parentPos) {
            // Smart layout: Find a free horizontal slot below the parent
            const VERTICAL_GAP = 120;
            const HORIZONTAL_SLOT = 180;

            // 1. Find all existing siblings (children of this parent)
            const childEdges = edges.filter(e => e.source === parentId);
            const childIds = new Set(childEdges.map(e => e.target));
            // Only consider visible siblings for collision detection
            const siblings = nodes.filter(n => childIds.has(n.id) && !n.hidden);

            // 2. Search for the nearest free slot
            // Slots: 0 (center), 1 (right), -1 (left), 2, -2, etc.
            let slotFound = false;
            let offsetIndex = 0;
            let finalX = parentPos.x;

            // Check slots in order: 0, 1, -1, 2, -2, 3, -3...
            const checkIndices = [0];
            for (let i = 1; i < 100; i++) {
                checkIndices.push(i, -i);
            }

            for (const idx of checkIndices) {
                const candidateX = parentPos.x + (idx * HORIZONTAL_SLOT);

                // Check if this slot is occupied by any sibling
                // We consider a slot occupied if a sibling is within half a slot width
                const isOccupied = siblings.some(sibling =>
                    Math.abs(sibling.position.x - candidateX) < (HORIZONTAL_SLOT / 2)
                );

                if (!isOccupied) {
                    finalX = candidateX;
                    slotFound = true;
                    break;
                }
            }

            // Fallback (should theoretically rarely happen unless huge number of children)
            if (!slotFound) {
                finalX = parentPos.x + (siblings.length * HORIZONTAL_SLOT);
            }

            position = { x: finalX, y: parentPos.y + VERTICAL_GAP };
        } else if (reactFlowInstance) {
            // Center of view
            const center = reactFlowInstance.project({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2
            });
            position = center;
        }

        const newNodeId = await addNode(parentId ? "새로운 생각" : "나의 다이어리", position);

        if (newNodeId && parentId) {
            await addNewEdge(parentId, newNodeId);
        }
    }, [addNode, addNewEdge, reactFlowInstance]);

    // Extended nodes with handlers
    const extendedNodes = useMemo(() => {
        const hasConnections = new Map<string, boolean>();
        edges.forEach(edge => {
            hasConnections.set(edge.source, true);
            hasConnections.set(edge.target, true);
        });

        return nodes.map(node => ({
            ...node,
            type: 'diary',
            data: {
                ...node.data,
                hasConnections: hasConnections.get(node.id) ?? false,
                onAddChild: () => handleAddNode(node.id, node.position),
                onUpdateContent: updateNodeContent,
                onDelete: handleDeleteNode
            }
        }));
    }, [nodes, handleAddNode, updateNodeContent, handleDeleteNode]);

    const edgesWithAutoHandles = useMemo(() => {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        return edges.map(edge => {
            if (edge.sourceHandle && edge.targetHandle) {
                return edge;
            }

            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);

            if (!sourceNode || !targetNode) return edge;

            const dx = targetNode.position.x - sourceNode.position.x;
            const dy = targetNode.position.y - sourceNode.position.y;

            let sourceHandle = edge.sourceHandle;
            let targetHandle = edge.targetHandle;

            const horizontalBias = Math.abs(dx) > Math.abs(dy) * 1.5; // need noticeably more horizontal distance

            if (horizontalBias) {
                if (dx > 0) {
                    sourceHandle ??= 'source-right';
                    targetHandle ??= 'target-left';
                } else {
                    sourceHandle ??= 'source-left';
                    targetHandle ??= 'target-right';
                }
            } else {
                if (dy > 0) {
                    sourceHandle ??= 'source-bottom';
                    targetHandle ??= 'target-top';
                } else {
                    sourceHandle ??= 'source-top';
                    targetHandle ??= 'target-bottom';
                }
            }

            return { ...edge, sourceHandle, targetHandle };
        });
    }, [edges, nodes]);

    const onNodeDragStop = useCallback((event: any, node: Node) => {
        updateNodePosition(node.id, node.position);
    }, [updateNodePosition]);

    const onSelectionChange = useCallback(async ({ nodes: selectedNodes }: { nodes: Node[] }) => {
        // Feature: Daily Mode Choice Logic
        // Triggered when selection changes. We only care if a SINGLE node is selected and it's a choice node.
        if (selectedNodes.length === 1) {
            const node = selectedNodes[0];
            if (node.data && node.data.isChoice && node.data.parentId) {
                // Find siblings
                const siblings = nodes.filter(n =>
                    n.id !== node.id &&
                    n.data?.parentId === node.data.parentId &&
                    n.data?.isChoice
                );

                if (siblings.length > 0) {
                    const anyVisible = siblings.some(n => !n.hidden);

                    if (anyVisible) {
                        try {
                            // Hide all siblings
                            await Promise.all(siblings.map(sibling => updateNodeVisibility(sibling.id, true)));

                            // Ensure selected is visible
                            if (node.hidden) {
                                await updateNodeVisibility(node.id, false);
                            }
                        } catch (error) {
                            console.error("Failed to update node visibility:", error);
                        }
                    }
                }
            }
        }
    }, [nodes, updateNodeVisibility]);

    if (!mapId) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-500">
                <div className="text-center">
                    <h3 className="text-xl font-medium mb-2"></h3>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <ReactFlow
                nodes={extendedNodes}
                edges={edgesWithAutoHandles}
                onNodesChange={hookOnNodesChange}
                onEdgesChange={hookOnEdgesChange}
                onConnect={hookOnConnect}
                onNodeDragStop={onNodeDragStop}
                onSelectionChange={onSelectionChange}
                onNodesDelete={(nodes) => {
                    nodes.forEach(node => handleDeleteNode(node.id));
                }}
                nodeTypes={nodeTypes}
                fitView
                defaultViewport={defaultViewport}
                snapToGrid={true}
                snapGrid={[20, 20]}
            >
                <Background gap={20} />
                <Controls />
                <MiniMap />
                {nodes.length === 0 && (
                    <Panel position="top-center">
                        <button
                            onClick={() => handleAddNode()}
                            style={{
                                padding: '12px 24px',
                                fontSize: '1.2rem',
                                borderRadius: '30px',
                                border: 'none',
                                background: '#0984e3',
                                color: 'white',
                                cursor: 'pointer',
                                boxShadow: '0 4px 15px rgba(9, 132, 227, 0.4)',
                                marginTop: '20vh'
                            }}
                        >
                            첫 번째 기록 시작하기
                        </button>
                    </Panel>
                )}
            </ReactFlow>
        </div>
    );
}

export default function MindMap({ mapId }: { mapId: string | null }) {
    return (
        <ReactFlowProvider>
            <MindMapContent mapId={mapId} />
        </ReactFlowProvider>
    );
}
