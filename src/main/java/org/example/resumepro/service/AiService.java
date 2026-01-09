package org.example.resumepro.service;

import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.example.resumepro.entity.ResumeHistory;
import org.example.resumepro.repository.ResumeRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.util.List;

@Service
public class AiService {

    private final ChatClient chatClient;
    private final ResumeRepository resumeRepository;

    public AiService(ChatClient.Builder builder, ResumeRepository resumeRepository) {
        this.chatClient = builder.build();
        this.resumeRepository = resumeRepository;
    }

    @Transactional
    public String checkAndSaveResume(String userResume) {
        if (userResume == null || userResume.trim().isEmpty()) {
            return "분석할 내용이 없습니다.";
        }

        // 마크다운 사용 금지를 명시한 시스템 지침
        String systemInstruction = """
            너는 10년차 베테랑 인사담당자야. 다음 규칙에 따라 이력서를 정밀하게 검토해줘.
            
            [반드시 지켜야 할 규칙]
            1. 모든 답변은 한국어로 작성할 것.
            2. ###, **, *, - 와 같은 마크다운 기호를 절대 사용하지 말 것.
            3. 제목은 [강점], [약점] 처럼 대괄호를 사용하고, 내용은 줄바꿈과 숫자(1., 2.) 또는 특수문자(•)만 사용하여 가독성을 높일 것.
            4. [강점], [약점], [개선 방향], [보완점], [면접 전략] 카테고리로 나누어 상세히 분석할 것.
            """;

        try {
            String response = chatClient.prompt()
                    .system(systemInstruction)
                    .user(userResume)
                    .call()
                    .content();

            if (response != null) {
                // 남아있을 수 있는 마크다운 기호(#, *)를 정규식으로 강제 제거
                response = response.replaceAll("[#*`]", "").replace("- ", "• ");
            } else {
                response = "AI가 결과를 생성하지 못했습니다.";
            }

            ResumeHistory history = ResumeHistory.builder()
                    .userResume(userResume)
                    .aiResponse(response)
                    .build();
            resumeRepository.save(history);

            return response;

        } catch (Exception e) {
            return "AI 분석 중 오류가 발생했습니다: " + e.getMessage();
        }
    }

    @Transactional(readOnly = true)
    public List<ResumeHistory> getAllHistory() {
        return resumeRepository.findAllByOrderByCreatedAtDesc();
    }

    public byte[] generatePdf(Long historyId) {
        ResumeHistory history = resumeRepository.findById(historyId)
                .orElseThrow(() -> new RuntimeException("내역을 찾을 수 없습니다."));

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Document document = new Document(PageSize.A4, 50, 50, 50, 50);
            PdfWriter.getInstance(document, out);
            document.open();

            BaseFont objBaseFont = BaseFont.createFont("c:/Windows/Fonts/malgun.ttf", BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
            Font titleFont = new Font(objBaseFont, 20, Font.BOLD);
            Font contentFont = new Font(objBaseFont, 11, Font.NORMAL);

            document.add(new Paragraph("사용자님의 AI 이력서 분석 리포트", titleFont));
            document.add(new Paragraph("분석 일시: " + history.getCreatedAt(), contentFont));
            document.add(new Paragraph("\n" + "-".repeat(60) + "\n\n"));

            // PDF 생성 시에도 기호 제거 확인
            String cleanText = history.getAiResponse().replaceAll("[#*`]", "");
            Paragraph resultPara = new Paragraph(cleanText, contentFont);
            resultPara.setLeading(18f);
            document.add(resultPara);

            document.close();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("PDF 생성 중 오류 발생");
        }
    }

    public String extractTextFromPdf(MultipartFile file) {
        try (PDDocument document = PDDocument.load(file.getInputStream())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (Exception e) {
            return "";
        }
    }
}