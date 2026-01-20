import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

// API 인스턴스 설정
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

    // 인증 관련 상태 (로컬 스토리지 초기화 통합)
    const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
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

    // 이메일 발송
    const handleEmailSend = async () => {
        if (!result) return alert("발송할 리포트 내용이 없습니다.");

        const targetEmail = prompt("리포트를 받을 이메일 주소를 입력하세요:", currentUser?.email);

        if (!targetEmail) return;

        try {
            await api.post('/api/ai/send-email', {
                email: targetEmail,
                content: result
            });
            alert("이메일이 성공적으로 발송되었습니다.");
        } catch (error) {
            alert("이메일 발송에 실패했습니다.");
        }
    };

    // 회원가입
    const handleSignup = async () => {
        if (!authData.email || !authData.password || !authData.nickname) return alert("모든 항목을 입력해주세요.");
        try {
            await api.post('/api/auth/signup', authData);
            alert("회원가입 성공! 로그인해주세요.");
            setAuthMode('login');
        } catch (error) {
            console.error("로그인 에러 데이터:", error.response?.data);
            // [object Object] 방지를 위해 문자열인지 확인 후 출력
            const errorDetail = typeof error.response?.data === 'string'
                ? error.response.data
                : (error.response?.data?.message || "로그인 정보를 확인하세요.");
            alert("로그인 실패: " + errorDetail);
        }
    };

    // 로그인
    const handleLogin = async () => {
        try {
            const response = await api.post('/api/auth/login', {
                email: authData.email,
                password: authData.password
            });

            alert("로그인 성공!");

            // 서버 응답에서 닉네임 추출 (서버에서 넘겨주는 key값 확인 필요)
            const userObj = {
                email: authData.email,
                nickname: response.data.nickname || authData.nickname || "테스트"
            };

            setIsLoggedIn(true);
            setCurrentUser(userObj);
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user', JSON.stringify(userObj));

            fetchHistory();
        } catch (error) {
            console.error("로그인 에러 데이터:", error.response?.data);
            // [object Object] 방지를 위해 문자열인지 확인 후 출력
            const errorDetail = typeof error.response?.data === 'string'
                ? error.response.data
                : (error.response?.data?.message || "로그인 정보를 확인하세요.");
            alert("로그인 실패: " + errorDetail);
        }
    };

    // 로그아웃
    const handleLogout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch (e) {}

        setIsLoggedIn(false);
        setCurrentUser(null);
        setHistory([]);
        setResult('');
        setSelectedId(null);

        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('user');

        alert("로그아웃 되었습니다.");
    };


    // 회원 탈퇴
    const handleWithdraw = async () => {
        if (!currentUser?.email) return alert("로그인 정보가 없습니다.");
        if (!window.confirm("정말로 탈퇴하시겠습니까? 데이터가 모두 삭제됩니다.")) return;
        try {
            await api.delete(`/api/auth/withdraw?email=${currentUser.email}`);
            alert("탈퇴 처리가 완료되었습니다.");
            handleLogout();
        } catch (error) {
            alert("탈퇴 실패: " + (error.response?.data || "오류 발생"));
        }
    };

    // --- 분석 기능 함수 ---
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

    // WebSocket 연결
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
        setResult(''); // 새로운 분석 시작 시 이전 결과 초기화
        try {
            const { data } = await api.post('/api/ai/resume-check', { resume });
            setResult(data.content);
            fetchHistory();
        } catch (error) {
            alert("분석 중 오류 발생");
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== "application/pdf") return alert("PDF 파일만 업로드 가능합니다.");

        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);
        setResult('');
        try {
            const { data } = await api.post('/api/ai/upload-resume', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setResult(data.content);
            fetchHistory();
        } catch (error) {
            alert("업로드 실패");
        } finally {
            setLoading(false);
        }
    };

    const sendChatMessage = () => {
        if (stompClient && inputChat.trim()) {
            const myMsg = { sender: 'User', content: inputChat };
            setMessages(prev => [...prev, myMsg]);
            stompClient.send(`/app/chat/${selectedId}`, {}, inputChat);
            setInputChat('');
        }
    };

    // --- 렌더링 ---



    if (!isLoggedIn) {
        return (
            <div style={styles.authContainer}>
                <div style={styles.authCard}>
                    <h2 style={{ color: '#4CAF50', marginBottom: '20px' }}>{authMode === 'login' ? '로그인' : '회원가입'}</h2>
                    <input name="email" placeholder="이메일" value={authData.email} onChange={handleAuthChange} style={styles.authInput} />
                    <input name="password" type="password" placeholder="비밀번호" value={authData.password} onChange={handleAuthChange} style={styles.authInput} />
                    {authMode === 'signup' && (
                        <input name="nickname" placeholder="닉네임" value={authData.nickname} onChange={handleAuthChange} style={styles.authInput} />
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

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>🚀 AI 이력서 검토 시스템</h1>
                <div style={styles.userSection}>
                    <span style={styles.userInfo}><strong>{currentUser?.nickname}</strong>님 환영합니다!</span>
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
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {/* 이메일 발송 버튼: 리포트 결과(result)가 있을 때만 표시 */}
                            {result && (
                                <button onClick={handleEmailSend} style={{ ...styles.downloadButton, backgroundColor: '#1976d2' }}>
                                    이메일 발송
                                </button>
                            )}

                            {/* PDF 저장 버튼: 저장된 데이터(selectedId)가 있을 때만 표시 */}
                            {selectedId && (
                                <button
                                    onClick={() => window.location.href=`http://localhost:8080/api/ai/download-pdf/${selectedId}`}
                                    style={styles.downloadButton}
                                >
                                    PDF 저장
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={styles.reportContent}>
                        {loading ? (
                            <div style={styles.skeletonContainer}>
                                <div style={styles.skeletonTitle}></div>
                                <div style={styles.skeletonLine}></div>
                                <div style={styles.skeletonLine}></div>
                                <div style={styles.skeletonLine}></div>
                                <p style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>AI가 이력서를 분석 중입니다...</p>
                            </div>
                        ) : result ? (
                            <div style={styles.markdownArea}><ReactMarkdown>{result}</ReactMarkdown></div>
                        ) : (
                            <div style={styles.emptyState}>분석할 이력서를 입력하거나 내역을 선택하세요.</div>
                        )}
                    </div>
                </section>

                <section style={styles.rightPanel}>
                    <h3 style={styles.cardTitle}>💬 AI 실시간 상담</h3>
                    <div style={styles.chatWindow}>
                        {messages.length > 0 ? messages.map((msg, i) => (
                            <div key={i} style={msg.sender === 'AI' ? styles.aiMsgBox : styles.userMsgBox}>
                                <div style={msg.sender === 'AI' ? styles.aiMsg : styles.userMsg}>{msg.content}</div>
                            </div>
                        )) : <div style={styles.emptyChat}>리포트에 대해 궁금한 점을 질문하세요.</div>}
                        <div ref={chatEndRef} />
                    </div>
                    <div style={styles.chatInputBox}>
                        <input style={styles.chatInput} value={inputChat} onChange={(e) => setInputChat(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()} placeholder={selectedId ? "질문 입력..." : "이력을 먼저 선택하세요"} disabled={!selectedId} />
                        <button onClick={sendChatMessage} disabled={!selectedId} style={styles.sendBtn}>전송</button>
                    </div>
                </section>
            </main>
        </div>
    );
}

const styles = {
    authContainer: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', backgroundColor: '#121212', position: 'fixed', top: 0, left: 0 },
    authCard: { backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '16px', width: '380px', textAlign: 'center', border: '1px solid #333', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
    authInput: { width: '100%', padding: '14px', marginBottom: '15px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '8px', color: 'white', boxSizing: 'border-box', fontSize: '14px', outline: 'none' },
    authBtn: { width: '100%', padding: '14px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '10px' },
    authToggle: { marginTop: '25px', fontSize: '14px', color: '#888', cursor: 'pointer', textDecoration: 'none' },

    // 스켈레톤 스타일 추가
    skeletonContainer: { display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px' },
    skeletonTitle: { height: '30px', width: '60%', backgroundColor: '#f0f0f0', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' },
    skeletonLine: { height: '15px', width: '100%', backgroundColor: '#f5f5f5', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' },

    userSection: { display: 'flex', alignItems: 'center', gap: '10px' },
    userInfo: { fontSize: '14px', color: '#ccc' },
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
    historyItem: { padding: '12px', marginBottom: '10px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' },
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