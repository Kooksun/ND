import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Node, Edge, Connection, addEdge, NodeChange, applyNodeChanges, EdgeChange, applyEdgeChanges } from "reactflow";

export const useMindMap = () => {
    const { user } = useAuth();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const nodesRef = collection(db, "users", user.uid, "nodes");
        const edgesRef = collection(db, "users", user.uid, "edges");

        const unsubscribeNodes = onSnapshot(nodesRef, (snapshot) => {
            const fetchedNodes = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Node[];
            setNodes(fetchedNodes);
        });

        const unsubscribeEdges = onSnapshot(edgesRef, (snapshot) => {
            const fetchedEdges = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Edge[];
            setEdges(fetchedEdges);
        });

        setLoading(false);

        return () => {
            unsubscribeNodes();
            unsubscribeEdges();
        };
    }, [user]);

    const onNodesChange = (changes: NodeChange[]) => {
        setNodes((nds) => applyNodeChanges(changes, nds));
        // Here we should also debounce save to Firestore for position updates
        // For MVP, we can save on drag end provided by React Flow, or specific save calls
    };

    const onEdgesChange = (changes: EdgeChange[]) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    };

    const onConnect = (connection: Connection) => {
        setEdges((eds) => addEdge(connection, eds));
        // Persist edge to firestore
        if (user && connection.source && connection.target) {
            addDoc(collection(db, "users", user.uid, "edges"), {
                source: connection.source,
                target: connection.target,
                id: `e${connection.source}-${connection.target}` // optional simple ID logic or let firestore gen
            });
        }
    };

    const addNode = async (label: string, position: { x: number, y: number }) => {
        if (!user) return null;
        try {
            const docRef = await addDoc(collection(db, "users", user.uid, "nodes"), {
                label,
                position,
                data: { label },
                type: 'diary',
                createdAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding node:", error);
            return null;
        }
    };

    const addNewEdge = async (source: string, target: string) => {
        if (!user) return;
        await addDoc(collection(db, "users", user.uid, "edges"), {
            source,
            target,
            id: `e${source}-${target}`
        });
    }

    const updateNodePosition = async (nodeId: string, position: { x: number, y: number }) => {
        if (!user) return;
        const nodeRef = doc(db, "users", user.uid, "nodes", nodeId);
        await updateDoc(nodeRef, { position });
    }

    // Helper to sync local changes to DB (could be better handling)
    const syncNode = async (node: Node) => {
        if (!user) return;
        const nodeRef = doc(db, "users", user.uid, "nodes", node.id);
        await setDoc(nodeRef, { ...node }, { merge: true });
    }

    const updateNodeContent = async (nodeId: string, label: string, content: string) => {
        if (!user) return;
        const nodeRef = doc(db, "users", user.uid, "nodes", nodeId);
        await updateDoc(nodeRef, {
            label,
            content,
            data: { label, preview: content.slice(0, 30) + (content.length > 30 ? "..." : "") } // Update display data
        });
    };

    return {
        nodes,
        edges,
        onNodesChange, // Local state update
        onEdgesChange,
        onConnect,
        addNode,
        addNewEdge,
        updateNodePosition,
        updateNodeContent,
        syncNode,
        setNodes,
        setEdges
    };
};
