package org.example.resumepro.controller;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.example.resumepro.entity.ResumeHistory;
import org.example.resumepro.entity.User;
import org.example.resumepro.service.AiService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    // 1. 텍스트 분석 실행 (handleCheck와 매칭)
    @PostMapping("/resume-check")
    public ResponseEntity<?> checkResume(@RequestBody Map<String, String> request, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) return ResponseEntity.status(401).build();

        String userResume = request.get("resume");
        // Service의 checkAndSaveResume(String, String) 호출
        String response = aiService.checkAndSaveResume(userResume, user.getEmail());

        return ResponseEntity.ok(Map.of("content", response));
    }

    // 2. 히스토리 조회 (fetchHistory와 매칭)
    @GetMapping("/history")
    public ResponseEntity<List<ResumeHistory>> getHistory(HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) return ResponseEntity.status(401).build();

        // Service의 getMyHistory 호출
        return ResponseEntity.ok(aiService.getMyHistory(user.getEmail()));
    }

    // 3. PDF 업로드 분석 (handleFileUpload와 매칭)
    @PostMapping("/upload-resume")
    public ResponseEntity<?> uploadResume(@RequestParam("file") MultipartFile file, HttpSession session) {
        User user = (User) session.getAttribute("user");
        if (user == null) return ResponseEntity.status(401).build();

        // PDF에서 텍스트 추출
        String extractedText = aiService.extractTextFromPdf(file);
        if (extractedText == null || extractedText.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("content", "PDF에서 내용을 읽을 수 없습니다."));
        }

        // 추출된 텍스트로 분석 및 저장 실행 (user.getEmail() 전달)
        String response = aiService.checkAndSaveResume(extractedText, user.getEmail());

        return ResponseEntity.ok(Map.of("content", response));
    }

    // 4. PDF 다운로드
    @GetMapping("/download-pdf/{id}")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable Long id) {
        byte[] pdfBytes = aiService.generatePdf(id);
        String encodedFileName = UriUtils.encode("분석리포트.pdf", StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + encodedFileName + "\"")
                .body(pdfBytes);
    }
}