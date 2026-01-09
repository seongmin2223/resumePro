package org.example.resumepro.controller;

import lombok.RequiredArgsConstructor;
import org.example.resumepro.entity.ResumeHistory;
import org.example.resumepro.service.AiService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final org.example.resumepro.repository.ResumeRepository resumeRepository;

    @PostMapping("/ai/resume-check")
    public Map<String, String> checkResume(@RequestBody Map<String, String> request) {
        String userResume = request.get("resume");
        return Map.of("content", aiService.checkAndSaveResume(userResume));
    }

    @GetMapping("/ai/history")
    public List<ResumeHistory> getHistory() {
        return aiService.getAllHistory();
    }

    @GetMapping("/ai/download-pdf/{id}")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable Long id) {
        byte[] pdfBytes = aiService.generatePdf(id);
        String fileName = "사용자님의_이력서_피드백_결과.pdf";
        String encodedFileName = UriUtils.encode(fileName, StandardCharsets.UTF_8);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(encodedFileName).build());

        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    @PostMapping("/ai/upload-resume")
    public Map<String, String> uploadResume(@RequestParam("file") MultipartFile file) {
        String extractedText = aiService.extractTextFromPdf(file);
        if (extractedText.trim().isEmpty()) {
            return Map.of("content", "PDF에서 텍스트를 읽을 수 없습니다.");
        }
        return Map.of("content", aiService.checkAndSaveResume(extractedText));
    }
}