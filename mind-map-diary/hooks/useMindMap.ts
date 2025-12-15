import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, setDoc, deleteDoc, writeBatch, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Node, Edge, Connection, addEdge, NodeChange, applyNodeChanges, EdgeChange, applyEdgeChanges } from "reactflow";

export const useMindMap = (mapId: string | null) => {
    const { user } = useAuth();
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !mapId) {
            setNodes([]);
            setEdges([]);
            setLoading(false);
            return;
        }

        const nodesRef = collection(db, "users", user.uid, "maps", mapId, "nodes");
        const edgesRef = collection(db, "users", user.uid, "maps", mapId, "edges");

        const unsubscribeNodes = onSnapshot(nodesRef, (snapshot) => {
            const fetchedNodes = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    data: {
                        ...data.data,
                        content: data.content
                    }
                };
            }) as Node[];

            setNodes((prevNodes) => {
                // Merge fetched nodes with previous local state (specifically 'selected')
                return fetchedNodes.map(fetchedNode => {
                    const prevNode = prevNodes.find(n => n.id === fetchedNode.id);
                    return {
                        ...fetchedNode,
                        selected: prevNode ? prevNode.selected : false,
                        // potentially dragging or other local states could be preserved here
                    };
                });
            });
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
    }, [user, mapId]);

    const onNodesChange = (changes: NodeChange[]) => {
        setNodes((nds) => applyNodeChanges(changes, nds));
    };

    const onEdgesChange = (changes: EdgeChange[]) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    };

    const onConnect = (connection: Connection) => {
        setEdges((eds) => addEdge(connection, eds));
        if (user && mapId && connection.source && connection.target) {
            addDoc(collection(db, "users", user.uid, "maps", mapId, "edges"), {
                source: connection.source,
                target: connection.target,
                id: `e${connection.source}-${connection.target}`
            });
        }
    };

    const addNode = async (label: string, position: { x: number, y: number }) => {
        if (!user || !mapId) return null;
        try {
            const docRef = await addDoc(collection(db, "users", user.uid, "maps", mapId, "nodes"), {
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
        if (!user || !mapId) return;
        await addDoc(collection(db, "users", user.uid, "maps", mapId, "edges"), {
            source,
            target,
            id: `e${source}-${target}`
        });
    }

    const updateNodePosition = async (nodeId: string, position: { x: number, y: number }) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", nodeId);
        await updateDoc(nodeRef, { position });
    }

    const syncNode = async (node: Node) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", node.id);
        await setDoc(nodeRef, { ...node }, { merge: true });
    }

    const updateNodeContent = async (nodeId: string, label: string, content: string) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", nodeId);
        await updateDoc(nodeRef, {
            label,
            content,
            data: { label, preview: content.slice(0, 30) + (content.length > 30 ? "..." : "") }
        });

        // Also update the map's updatedAt timestamp
        const mapRef = doc(db, "users", user.uid, "maps", mapId);
        await updateDoc(mapRef, { updatedAt: serverTimestamp() });
    };

    const updateNodeVisibility = async (nodeId: string, hidden: boolean) => {
        if (!user || !mapId) return;
        const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", nodeId);
        await updateDoc(nodeRef, { hidden });
    };

    const deleteNode = async (nodeId: string) => {
        if (!user || !mapId) return;

        try {
            const batch = writeBatch(db);

            // 1. Delete the node
            const nodeRef = doc(db, "users", user.uid, "maps", mapId, "nodes", nodeId);
            batch.delete(nodeRef);

            // 2. Find and delete connected edges
            const edgesRef = collection(db, "users", user.uid, "maps", mapId, "edges");

            // Query for edges where this node is the source
            const sourceEdgesQuery = query(edgesRef, where("source", "==", nodeId));
            const sourceEdgesSnapshot = await getDocs(sourceEdgesQuery);

            sourceEdgesSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Query for edges where this node is the target
            const targetEdgesQuery = query(edgesRef, where("target", "==", nodeId));
            const targetEdgesSnapshot = await getDocs(targetEdgesQuery);

            targetEdgesSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            // Commit the batch
            await batch.commit();

            // Update map timestamp
            const mapRef = doc(db, "users", user.uid, "maps", mapId);
            await updateDoc(mapRef, { updatedAt: serverTimestamp() });

        } catch (error) {
            console.error("Error deleting node:", error);
            throw error;
        }
    };

    return {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode,
        addNewEdge,
        updateNodePosition,
        updateNodeContent,
        updateNodeVisibility,
        syncNode,
        setNodes,
        setEdges,
        deleteNode
    };
};
