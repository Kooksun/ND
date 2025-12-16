"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    signupWithEmail: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    loginWithEmail: async () => { },
    signupWithEmail: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setUser(user);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const loginWithEmail = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signupWithEmail = async (email: string, password: string) => {
        await createUserWithEmailAndPassword(auth, email, password);
    };

    const logout = async () => {
        await signOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginWithEmail, signupWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
