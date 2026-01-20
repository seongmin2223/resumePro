package org.example.resumepro.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Map;

@Controller
@RequestMapping("/api/ai")
public class EmailController {

    @Autowired
    private JavaMailSender mailSender;

    @PostMapping("/send-email")
    public ResponseEntity<String> sendReport(@RequestBody Map<String, String> request) {
        // 프론트엔드에서 보낸 'email'과 'content' 키값을 정확히 매칭합니다.
        String email = request.get("email");
        String content = request.get("content");

        if (email == null || content == null) {
            return ResponseEntity.badRequest().body("이메일 주소나 내용이 누락되었습니다.");
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("[AI 이력서 분석] 검토 리포트 결과입니다.");
            message.setText(content);
            mailSender.send(message);
            return ResponseEntity.ok("발송 성공");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("발송 실패: " + e.getMessage());
        }
    }

}
