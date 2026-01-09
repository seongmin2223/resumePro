import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

// API 설정: 백엔드 주소와 연동
const api = axios.create({
    baseURL: 'http://localhost:8080',
    withCredentials: true
});

function App() {
    const [resume, setResume] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputChat, setInputChat] = useState('');
    const [stompClient, setStompClient] = useState(null);

    // 자동 스크롤을 위한 Ref 설정
    const chatEndRef = useRef(null);

    // 1. 과거 검토 내역 로드
    const fetchHistory = async () => {
        try {
            const { data } = await api.get('/api/ai/history');
            setHistory(data);
        } catch (error) {
            console.error("이력 로드 실패:", error);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // 2. 실시간 채팅을 위한 웹소켓 연결
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

    // 3. 메시지 추가 시 자동 스크롤 함수
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // 4. 텍스트 직접 분석
    const handleCheck = async () => {
        if (!resume.trim()) return alert("이력서 내용을 입력해주세요.");
        setLoading(true);
        try {
            const { data } = await api.post('/api/ai/resume-check', { resume });
            setResult(data.content);
            fetchHistory();
        } catch (error) {
            alert("분석 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    // 5. 파일 업로드 분석 (경로: /api/ai/upload-resume)
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
            alert("파일 분석 완료!");
        } catch (error) {
            alert("파일 업로드 또는 분석 실패 (서버 연결을 확인하세요)");
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleDownload = (id) => {
        window.location.href = `http://localhost:8080/api/ai/download-pdf/${id}`;
    };

    const sendChatMessage = () => {
        if (stompClient && inputChat.trim()) {
            const myMsg = { sender: 'User', content: inputChat };
            setMessages(prev => [...prev, myMsg]);
            stompClient.send(`/app/chat/${selectedId}`, {}, inputChat);
            setInputChat('');
        }
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>🚀 AI 이력서 검토 시스템</h1>
            </header>

            <main style={styles.main}>
                {/* 왼쪽 패널 */}
                <section style={styles.leftPanel}>
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>📝 분석 시작</h3>
                        <label style={styles.fileButton}>
                            📁 PDF 업로드
                            <input type="file" accept=".pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                        <textarea
                            style={styles.textarea}
                            placeholder="이력서 내용을 입력하세요..."
                            value={resume}
                            onChange={(e) => setResume(e.target.value)}
                        />
                        <button onClick={handleCheck} disabled={loading} style={styles.actionButton}>
                            {loading ? '분석 중...' : '정밀 분석 실행'}
                        </button>
                    </div>

                    <div style={styles.historyCard}>
                        <h3 style={styles.cardTitle}>🕒 검토 히스토리</h3>
                        <div style={styles.historyList}>
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        setResult(item.aiResponse);
                                        setResume(item.userResume);
                                        setSelectedId(item.id);
                                    }}
                                    style={{
                                        ...styles.historyItem,
                                        backgroundColor: selectedId === item.id ? '#2e7d32' : '#2a2a2a',
                                        border: selectedId === item.id ? '1px solid #4CAF50' : '1px solid #444',
                                    }}
                                >
                                    <span style={styles.historyDate}>{new Date(item.createdAt).toLocaleString()}</span>
                                    <p style={styles.historyText}>{item.userResume.substring(0, 35)}...</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 중앙 패널 */}
                <section style={styles.middlePanel}>
                    <div style={styles.reportHeader}>
                        <h3 style={{...styles.cardTitle, color: '#fff', margin: 0}}>📋 분석 리포트</h3>
                        {selectedId && (
                            <button onClick={() => handleDownload(selectedId)} style={styles.downloadButton}>
                                PDF 저장
                            </button>
                        )}
                    </div>
                    <div style={styles.reportContent}>
                        {result ? (
                            <div style={styles.markdownArea}>
                                <ReactMarkdown>{result}</ReactMarkdown>
                            </div>
                        ) : (
                            <div style={styles.emptyState}>분석할 이력서를 입력하거나 내역을 선택하세요.</div>
                        )}
                    </div>
                </section>

                {/* 오른쪽 패널: 채팅 (자동 스크롤 적용) */}
                <section style={styles.rightPanel}>
                    <h3 style={styles.cardTitle}>💬 AI 실시간 상담</h3>
                    <div style={styles.chatWindow}>
                        {messages.length === 0 && <div style={styles.emptyChat}>리포트에 대해 궁금한 점을 질문하세요.</div>}
                        {messages.map((msg, i) => (
                            <div key={i} style={msg.sender === 'AI' ? styles.aiMsgBox : styles.userMsgBox}>
                                <div style={msg.sender === 'AI' ? styles.aiMsg : styles.userMsg}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {/* 스크롤 끝 지점 표시 */}
                        <div ref={chatEndRef} />
                    </div>
                    <div style={styles.chatInputBox}>
                        <input
                            style={styles.chatInput}
                            value={inputChat}
                            onChange={(e) => setInputChat(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder={selectedId ? "질문 입력..." : "이력을 먼저 선택하세요"}
                            disabled={!selectedId}
                        />
                        <button onClick={sendChatMessage} disabled={!selectedId} style={styles.sendBtn}>전송</button>
                    </div>
                </section>
            </main>
        </div>
    );
}

const styles = {
    // ... 기존 스타일 유지 ...
    container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: '#eee', padding: '20px', boxSizing: 'border-box' },
    header: { marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' },
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