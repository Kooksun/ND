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
            position = { x: parentPos.x + 250, y: parentPos.y + (Math.random() * 100 - 50) };
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
        return nodes.map(node => ({
            ...node,
            type: 'diary',
            data: {
                ...node.data,
                onAddChild: () => handleAddNode(node.id, node.position),
                onUpdateContent: updateNodeContent,
                onDelete: handleDeleteNode
            }
        }));
    }, [nodes, handleAddNode, updateNodeContent, handleDeleteNode]);

    const onNodeDragStop = useCallback((event: any, node: Node) => {
        updateNodePosition(node.id, node.position);
    }, [updateNodePosition]);

    if (!mapId) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-500">
                <div className="text-center">
                    <h3 className="text-xl font-medium mb-2">지도를 선택해주세요</h3>
                    <p>왼쪽 메뉴에서 페이지를 선택하거나 새로 만들어보세요.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <ReactFlow
                nodes={extendedNodes}
                edges={edges}
                onNodesChange={hookOnNodesChange}
                onEdgesChange={hookOnEdgesChange}
                onConnect={hookOnConnect}
                onNodeDragStop={onNodeDragStop}
                onNodesDelete={(nodes) => {
                    nodes.forEach(node => handleDeleteNode(node.id));
                }}
                nodeTypes={nodeTypes}
                fitView
                defaultViewport={defaultViewport}
            >
                <Background />
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
