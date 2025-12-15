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
import DiaryEditor from "./DiaryEditor";
import { Plus } from "lucide-react";

const defaultViewport = { x: 0, y: 0, zoom: 1.5 };

function MindMapContent() {
    const {
        nodes,
        edges,
        onNodesChange: hookOnNodesChange,
        onEdgesChange: hookOnEdgesChange,
        onConnect: hookOnConnect,
        addNode,
        addNewEdge,
        updateNodePosition,
        updateNodeContent
    } = useMindMap();

    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const reactFlowInstance = useReactFlow();

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
                onAddChild: () => handleAddNode(node.id, node.position)
            }
        }));
    }, [nodes, handleAddNode]);

    const onNodeClick = useCallback((event: any, node: Node) => {
        setEditingNodeId(node.id);
    }, []);

    const handleSave = async (id: string, title: string, content: string) => {
        await updateNodeContent(id, title, content);
    };

    const editingNode = useMemo(() => nodes.find(n => n.id === editingNodeId) || null, [nodes, editingNodeId]);

    const onNodeDragStop = useCallback((event: any, node: Node) => {
        updateNodePosition(node.id, node.position);
    }, [updateNodePosition]);

    return (
        <div style={{ width: "100%", height: "100%" }}>
            <ReactFlow
                nodes={extendedNodes}
                edges={edges}
                onNodesChange={hookOnNodesChange}
                onEdgesChange={hookOnEdgesChange}
                onConnect={hookOnConnect}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
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
            <DiaryEditor
                node={editingNode}
                isOpen={!!editingNodeId}
                onClose={() => setEditingNodeId(null)}
                onSave={handleSave}
            />
        </div>
    );
}

export default function MindMap() {
    return (
        <ReactFlowProvider>
            <MindMapContent />
        </ReactFlowProvider>
    );
}
