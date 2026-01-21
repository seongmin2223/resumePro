# 🚀 resumePro

## AI 이력서 검토 및 실시간 상담 플랫폼

**resumePro**는 Google Gemini API를 활용하여  
사용자의 이력서를 분석하고, 채용 관점에서 개선 방향을 제시하는  
AI 기반 이력서 검토 및 실시간 상담 플랫폼입니다.

텍스트 입력 또는 **PDF 업로드**를 통해 이력서를 분석할 수 있으며,  
분석 결과를 바탕으로 **AI와 실시간 채팅 상담**이 가능합니다.

---

## 🛠 Tech Stack

### Backend
- ☕ Java 17
- 🌱 Spring Boot
- 🔐 Spring Security (Session 기반 인증)
- 🔌 Spring WebSocket (STOMP)
- 🗄 Spring Data JPA
- 🐬 MySQL

### Frontend
- ⚛ React
- 📡 Axios
- 🔄 SockJS / STOMP

### AI
- 🤖 Google Gemini Pro (Spring AI)

---

## ✨ 주요 기능

### 👤 회원 관리
- 회원가입 / 로그인
- 세션 기반 인증
- 로그아웃 및 회원 탈퇴

### 📝 AI 이력서 분석
- 텍스트 입력 기반 이력서 분석
- PDF 이력서 업로드 분석
- AI를 통한 이력서 강점 / 약점 / 개선 방향 제시
- 분석 결과 자동 저장

### 💬 AI 실시간 채팅
- 이력서 분석 결과를 기반으로 한 AI 상담
- WebSocket(STOMP) 기반 실시간 메시지 처리
- 질문 맥락을 유지한 연속 대화 지원

### 🕒 분석 이력 관리
- 사용자별 이력서 분석 히스토리 조회
- 과거 분석 결과 확인
- 분석 결과 PDF 다운로드
- 분석 리포트 이메일 발송

---

## 🔄 시스템 흐름

1. 사용자가 이력서를 텍스트로 입력하거나 PDF 파일 업로드
2. 서버에서 로그인 세션 검증
3. Google Gemini API를 통해 이력서 분석 수행
4. 분석 결과를 데이터베이스에 저장
5. WebSocket을 통해 AI 실시간 채팅 제공

---

## ⚙ 실행 환경

- Java 17
- MySQL 8.x
- Google Gemini API Key 필요
- Node.js 18 이상

---

## 🚧 향후 개선 사항

- JWT 기반 인증 방식 도입
- OAuth2 소셜 로그인 연동
- 직무별 맞춤 이력서 분석 기능 추가
- 사용자별 분석 통계 및 대시보드 제공
