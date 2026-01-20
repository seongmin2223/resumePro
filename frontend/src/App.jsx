import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

const api = axios.create({
    baseURL: 'http://localhost:8080',
    withCredentials: true
});

function App() {
    // --- 상태 관리 ---
    const [resume, setResume] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputChat, setInputChat] = useState('');
    const [stompClient, setStompClient] = useState(null);

    // 인증 관련 상태
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        return localStorage.getItem('isLoggedIn') === 'true';
    });
    const [currentUser, setCurrentUser] = useState(() => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [authMode, setAuthMode] = useState('login');
    const [authData, setAuthData] = useState({ email: '', password: '', nickname: '' });

    const chatEndRef = useRef(null);

    // --- 인증 관련 함수 ---
    const handleAuthChange = (e) => {
        setAuthData({ ...authData, [e.target.name]: e.target.value });
    };

    const handleSignup = async () => {
        try {
            // 경로 앞에 / 를 반드시 붙여주세요 (/api/auth/signup)
            await api.post('/api/auth/signup', authData);
            alert("회원가입 성공! 로그인해주세요.");
            setAuthMode('login');
        } catch (error) {
            // [object Object] 방지를 위해 상세 에러 로그 확인
            console.error("회원가입 상세 에러:", error.response);
            const errorMsg = error.response?.data?.message || error.response?.data || "서버 연결 오류";
            alert("회원가입 실패 : " + errorMsg);
        }
    };

    const handleLogin = async () => {
        try {
            // 백엔드 응답에 유저 정보를 포함하도록 수정했다면 data를 사용
            const response = await api.post('/api/auth/login', {
                email: authData.email,
                password: authData.password
            });

            alert("로그인 성공!");

            const userObj = {
                email: authData.email,
                nickname: response.data.nickname || authData.nickname || "테스트"
            };

            setIsLoggedIn(true);
            setCurrentUser(userObj);

            // 로컬 스토리지에 저장 (새로고침 대비)
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify(userObj));

            fetchHistory();
        } catch (error) {
            alert("로그인 실패: " + (error.response?.data || "정보를 확인하세요."));
        }
    };

    const handleLogout = () => {
        setIsLoggedIn(false);
        setCurrentUser(null);
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');
        alert("로그아웃 되었습니다.");
    };

    const handleWithdraw = async () => {
        if (!window.confirm("정말로 탈퇴하시겠습니까? 데이터가 모두 삭제됩니다.")) return;
        try {
            await api.delete(`/api/auth/withdraw?email=${currentUser.email}`);
            alert("탈퇴 처리가 완료되었습니다.");
            handleLogout();
        } catch (error) {
            alert("탈퇴 실패: " + (error.response?.data || "오류 발생"));
        }
    };

    // --- 기존 분석 기능 함수 ---
    const fetchHistory = async () => {
        try {
            const { data } = await api.get('/api/ai/history');
            setHistory(data);
        } catch (error) {
            console.error("이력 로드 실패:", error);
        }
    };

    useEffect(() => {
        if (isLoggedIn) fetchHistory();
    }, [isLoggedIn]);

    useEffect(() => {
        if (selectedId) {
            setMessages([]);
            const socket = new SockJS('http://localhost:8080/ws-chat');
            const client = Stomp.over(socket);
            client.debug = null;
            client.connect({}, () => {
                client.subscribe(`/topic/messages/${selectedId}`, (sdkEvent) => {
                    const newMessage = JSON.parse(sdkEvent.body);
                    setMessages(prev => [...prev, newMessage]);
                });
            });
            setStompClient(client);
            return () => { if (client) client.disconnect(); };
        }
    }, [selectedId]);

    useEffect(() => {
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleCheck = async () => {
        if (!resume.trim()) return alert("이력서 내용을 입력해주세요.");
        setLoading(true);
        try {
            const { data } = await api.post('/api/ai/resume-check', { resume });
            setResult(data.content);
            fetchHistory();
        } catch (error) { alert("분석 중 오류 발생"); } finally { setLoading(false); }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);
        try {
            const { data } = await api.post('/api/ai/upload-resume', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(data.content);
            fetchHistory();
        } catch (error) { alert("업로드 실패"); } finally { setLoading(false); }
    };

    const sendChatMessage = () => {
        if (stompClient && inputChat.trim()) {
            const myMsg = { sender: 'User', content: inputChat };
            setMessages(prev => [...prev, myMsg]);
            stompClient.send(`/app/chat/${selectedId}`, {}, inputChat);
            setInputChat('');
        }
    };

    // --- 조건부 렌더링 ---

    // 1. 로그인 전 화면
    if (!isLoggedIn) {
        return (
            <div style={styles.authContainer}>
                <div style={styles.authCard}>
                    <h2 style={{ color: '#4CAF50', marginBottom: '20px' }}>{authMode === 'login' ? '로그인' : '회원가입'}</h2>
                    <input name="email" placeholder="이메일" onChange={handleAuthChange} style={styles.authInput} />
                    <input name="password" type="password" placeholder="비밀번호" onChange={handleAuthChange} style={styles.authInput} />
                    {authMode === 'signup' && (
                        <input name="nickname" placeholder="닉네임" onChange={handleAuthChange} style={styles.authInput} />
                    )}
                    <button onClick={authMode === 'login' ? handleLogin : handleSignup} style={styles.authBtn}>
                        {authMode === 'login' ? '로그인' : '가입하기'}
                    </button>
                    <p onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} style={styles.authToggle}>
                        {authMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
                    </p>
                </div>
            </div>
        );
    }

    // 2. 메인 화면 (로그인 후)
    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>🚀 AI 이력서 검토 시스템</h1>
                <div style={styles.userSection}>
                    <span style={styles.userInfo}>{currentUser?.nickname}님 환영합니다!</span>
                    <button onClick={handleLogout} style={styles.miniBtn}>로그아웃</button>
                    <button onClick={handleWithdraw} style={{ ...styles.miniBtn, backgroundColor: '#c62828' }}>탈퇴</button>
                </div>
            </header>

            <main style={styles.main}>
                <section style={styles.leftPanel}>
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>📝 분석 시작</h3>
                        <label style={styles.fileButton}>
                            📁 PDF 업로드
                            <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                        <textarea style={styles.textarea} placeholder="내용 입력..." value={resume} onChange={(e) => setResume(e.target.value)} />
                        <button onClick={handleCheck} disabled={loading} style={styles.actionButton}>{loading ? '분석 중...' : '정밀 분석 실행'}</button>
                    </div>
                    <div style={styles.historyCard}>
                        <h3 style={styles.cardTitle}>🕒 검토 히스토리</h3>
                        <div style={styles.historyList}>
                            {history.map((item) => (
                                <div key={item.id} onClick={() => { setResult(item.aiResponse); setResume(item.userResume); setSelectedId(item.id); }}
                                     style={{ ...styles.historyItem, backgroundColor: selectedId === item.id ? '#2e7d32' : '#2a2a2a' }}>
                                    <span style={styles.historyDate}>{new Date(item.createdAt).toLocaleString()}</span>
                                    <p style={styles.historyText}>{item.userResume.substring(0, 35)}...</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section style={styles.middlePanel}>
                    <div style={styles.reportHeader}>
                        <h3 style={{ ...styles.cardTitle, color: '#fff', margin: 0 }}>📋 분석 리포트</h3>
                        {selectedId && <button onClick={() => window.location.href=`http://localhost:8080/api/ai/download-pdf/${selectedId}`} style={styles.downloadButton}>PDF 저장</button>}
                    </div>
                    <div style={styles.reportContent}>
                        {result ? <div style={styles.markdownArea}><ReactMarkdown>{result}</ReactMarkdown></div> : <div style={styles.emptyState}>분석 내역을 선택하세요.</div>}
                    </div>
                </section>

                <section style={styles.rightPanel}>
                    <h3 style={styles.cardTitle}>💬 AI 실시간 상담</h3>
                    <div style={styles.chatWindow}>
                        {messages.map((msg, i) => (
                            <div key={i} style={msg.sender === 'AI' ? styles.aiMsgBox : styles.userMsgBox}>
                                <div style={msg.sender === 'AI' ? styles.aiMsg : styles.userMsg}>{msg.content}</div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div style={styles.chatInputBox}>
                        <input style={styles.chatInput} value={inputChat} onChange={(e) => setInputChat(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()} placeholder="질문 입력..." disabled={!selectedId} />
                        <button onClick={sendChatMessage} disabled={!selectedId} style={styles.sendBtn}>전송</button>
                    </div>
                </section>
            </main>
        </div>
    );
}

const styles = {
    // --- 수정된 인증 관련 스타일 ---
    authContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw', // 화면 전체 너비 확보
        backgroundColor: '#121212',
        position: 'fixed', // 다른 요소에 방해받지 않도록 고정
        top: 0,
        left: 0
    },
    authCard: {
        backgroundColor: '#1e1e1e',
        padding: '40px',
        borderRadius: '16px', // 조금 더 부드러운 곡선
        width: '380px', // 너비 약간 확대
        textAlign: 'center',
        border: '1px solid #333',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)' // 입체감 추가
    },
    authInput: {
        width: '100%',
        padding: '14px',
        marginBottom: '15px',
        backgroundColor: '#2a2a2a',
        border: '1px solid #444',
        borderRadius: '8px',
        color: 'white',
        boxSizing: 'border-box',
        fontSize: '14px',
        outline: 'none'
    },
    authBtn: {
        width: '100%',
        padding: '14px',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '16px',
        marginTop: '10px',
        transition: 'background-color 0.2s'
    },
    authToggle: {
        marginTop: '25px',
        fontSize: '14px',
        color: '#888',
        cursor: 'pointer',
        textDecoration: 'none'
    },

    // --- 나머지 기존 스타일 유지 (userSection부터 동일) ---
    userSection: { display: 'flex', alignItems: 'center', gap: '10px' },
    userInfo: { fontSize: '13px', color: '#ccc' },
    miniBtn: { padding: '5px 10px', fontSize: '11px', backgroundColor: '#444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: '#eee', padding: '20px', boxSizing: 'border-box' },
    header: { marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    title: { margin: 0, fontSize: '22px', color: '#4CAF50' },
    main: { display: 'flex', flex: 1, gap: '20px', overflow: 'hidden' },
    leftPanel: { flex: '0.8', display: 'flex', flexDirection: 'column', gap: '15px' },
    middlePanel: { flex: '1.4', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', borderRadius: '12px', border: '1px solid #333', overflow: 'hidden' },
    rightPanel: { flex: '1', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '15px', border: '1px solid #333' },
    card: { backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '15px', border: '1px solid #333' },
    historyCard: { backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '15px', border: '1px solid #333', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    cardTitle: { marginTop: 0, marginBottom: '15px', fontSize: '14px', color: '#aaa', fontWeight: 'bold' },
    textarea: { width: '100%', height: '100px', backgroundColor: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: '8px', padding: '12px', marginTop: '10px', marginBottom: '10px', resize: 'none', fontSize: '13px', boxSizing: 'border-box' },
    fileButton: { backgroundColor: '#1976d2', color: '#fff', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    actionButton: { width: '100%', padding: '12px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    historyList: { flex: 1, overflowY: 'auto' },
    historyItem: { padding: '12px', marginBottom: '10px', borderRadius: '8px', cursor: 'pointer' },
    historyDate: { fontSize: '10px', color: '#888' },
    historyText: { margin: '5px 0 0 0', fontSize: '13px' },
    reportHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #333' },
    downloadButton: { backgroundColor: '#e53935', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' },
    reportContent: { flex: 1, backgroundColor: '#ffffff', color: '#333', padding: '30px', overflowY: 'auto' },
    markdownArea: { fontSize: '15px', lineHeight: '1.7' },
    chatWindow: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', backgroundColor: '#121212', borderRadius: '8px', marginBottom: '10px' },
    aiMsgBox: { display: 'flex', justifyContent: 'flex-start' },
    userMsgBox: { display: 'flex', justifyContent: 'flex-end' },
    aiMsg: { backgroundColor: '#333', color: '#eee', padding: '10px 14px', borderRadius: '15px 15px 15px 0', maxWidth: '85%', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' },
    userMsg: { backgroundColor: '#4CAF50', color: '#fff', padding: '8px 12px', borderRadius: '15px 15px 0 15px', maxWidth: '80%', fontSize: '13px' },
    chatInputBox: { display: 'flex', gap: '8px' },
    chatInput: { flex: 1, backgroundColor: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: '6px', padding: '10px', outline: 'none' },
    sendBtn: { backgroundColor: '#4CAF50', color: '#fff', border: 'none', padding: '0 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
    emptyChat: { textAlign: 'center', color: '#444', marginTop: '50%', fontSize: '13px' },
    emptyState: { textAlign: 'center', color: '#999', marginTop: '100px' }
};

export default App;