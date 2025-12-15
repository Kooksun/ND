"use client";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
    const { user, login, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push("/");
        }
    }, [user, loading, router]);

    if (loading) return <div className={styles.container}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Mind Map Diary</h1>
                <p className={styles.subtitle}>마인드맵으로 정리하는 나의 하루</p>
                <button className={styles.button} onClick={login}>
                    Google 계정으로 시작하기
                </button>
            </div>
        </div>
    );
}
