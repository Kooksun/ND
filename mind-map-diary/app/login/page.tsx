"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
    const { user, login, loginWithEmail, signupWithEmail, loading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!loading && user) {
            router.push("/");
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            if (isLogin) {
                await loginWithEmail(email, password);
            } else {
                await signupWithEmail(email, password);
            }
        } catch (err: any) {
            // Translate common Firebase errors to Korean
            switch (err.code) {
                case 'auth/email-already-in-use':
                    setError("이미 사용 중인 이메일입니다.");
                    break;
                case 'auth/invalid-email':
                    setError("유효하지 않은 이메일 주소입니다.");
                    break;
                case 'auth/weak-password':
                    setError("비밀번호는 6자리 이상이어야 합니다.");
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    setError("이메일 또는 비밀번호가 올바르지 않습니다.");
                    break;
                default:
                    setError("오류가 발생했습니다: " + err.message);
            }
        }
    };

    if (loading) return <div className={styles.container}>Loading...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Mind Map Diary</h1>
                <p className={styles.subtitle}>마인드맵으로 정리하는 나의 하루</p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginBottom: '20px' }}>
                    <input
                        type="email"
                        placeholder="이메일"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
                    />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
                    />
                    {error && <p style={{ color: '#e53e3e', fontSize: '0.9rem', margin: '0' }}>{error}</p>}
                    <button type="submit" className={styles.button} style={{ marginBottom: '0' }}>
                        {isLogin ? "이메일로 로그인" : "이메일로 회원가입"}
                    </button>
                </form>

                <div style={{ width: '100%', height: '1px', backgroundColor: '#eee', margin: '20px 0' }}></div>

                <button className={styles.button} onClick={login} style={{ backgroundColor: '#fff', color: '#757575', border: '1px solid #ddd' }}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', marginRight: '10px', verticalAlign: 'middle' }} />
                    <span style={{ verticalAlign: 'middle' }}>Google 계정으로 시작하기</span>
                </button>

                <p style={{ marginTop: '20px', fontSize: '0.9rem', cursor: 'pointer', color: '#666', textDecoration: 'underline' }} onClick={() => { setIsLogin(!isLogin); setError(""); }}>
                    {isLogin ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
                </p>
            </div>
        </div>
    );
}
