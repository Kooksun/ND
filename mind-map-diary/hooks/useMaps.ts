import { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface MapData {
    id: string;
    title: string;
    createdAt: any;
    updatedAt: any;
}

export const useMaps = () => {
    const { user } = useAuth();
    const [maps, setMaps] = useState<MapData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setMaps([]);
            setLoading(false);
            return;
        }

        const mapsRef = collection(db, "users", user.uid, "maps");
        const q = query(mapsRef, orderBy("updatedAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMaps = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MapData[];
            setMaps(fetchedMaps);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const createMap = async (requestedTitle?: string, type: 'blank' | 'daily' = 'blank') => {
        if (!user) return null;
        try {
            let title = requestedTitle;

            if (!title) {
                const now = new Date();
                const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일의 기록`;

                // Add suffix for Daily Mode to distinguish
                const baseTitle = type === 'daily' ? `${dateStr} (데일리)` : dateStr;

                // Check for duplicates
                let candidateTitle = baseTitle;
                let counter = 1;

                while (maps.some(m => m.title === candidateTitle)) {
                    counter++;
                    candidateTitle = `${baseTitle} #${counter}`;
                }
                title = candidateTitle;
            }

            const mapDocRef = await addDoc(collection(db, "users", user.uid, "maps"), {
                title,
                type, // Store the type just in case
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // If Daily Mode, create the initial node structure
            if (type === 'daily') {
                const batch = writeBatch(db);
                const nodesCollection = collection(db, "users", user.uid, "maps", mapDocRef.id, "nodes");
                const edgesCollection = collection(db, "users", user.uid, "maps", mapDocRef.id, "edges");

                // 1. Root Node: "I today..."
                const rootNodeRef = doc(nodesCollection);
                batch.set(rootNodeRef, {
                    label: "나는 오늘...",
                    position: { x: 0, y: 0 },
                    data: { label: "나는 오늘..." }, // Initial data needed for ReactFlow
                    type: 'diary',
                    createdAt: serverTimestamp(),
                });

                // 2. Child Nodes: "Worked", "Studied", "Played Games"
                // Distributed horizontally below the root (0,0)
                const children = [
                    { label: "일을 했다", x: -180, color: '#ff7675' },
                    { label: "공부를 했다", x: 0, color: '#74b9ff' },
                    { label: "게임을 했다", x: 180, color: '#55efc4' }
                ];

                children.forEach((child) => {
                    const childNodeRef = doc(nodesCollection);
                    batch.set(childNodeRef, {
                        label: child.label,
                        position: { x: child.x, y: 130 },
                        data: {
                            label: child.label,
                            isChoice: true, // Special flag for choice nodes
                            parentId: rootNodeRef.id // Helper for logic
                        },
                        type: 'diary',
                        createdAt: serverTimestamp(),
                    });

                    // Edge from Root to Child
                    const edgeRef = doc(edgesCollection);
                    batch.set(edgeRef, {
                        source: rootNodeRef.id,
                        target: childNodeRef.id,
                        id: `e${rootNodeRef.id}-${childNodeRef.id}`
                    });
                });

                await batch.commit();
            }

            return mapDocRef.id;
        } catch (error) {
            console.error("Error creating map:", error);
            return null;
        }
    };

    const updateMapTitle = async (mapId: string, title: string) => {
        if (!user) return;
        const mapRef = doc(db, "users", user.uid, "maps", mapId);
        await updateDoc(mapRef, {
            title,
            updatedAt: serverTimestamp()
        });
    };

    const deleteMap = async (mapId: string) => {
        if (!user) return;
        await deleteDoc(doc(db, "users", user.uid, "maps", mapId));
    }

    return {
        maps,
        loading,
        createMap,
        updateMapTitle,
        deleteMap
    };
};
