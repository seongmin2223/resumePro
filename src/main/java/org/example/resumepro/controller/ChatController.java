package org.example.resumepro.controller;

import lombok.RequiredArgsConstructor;
import org.example.resumepro.dto.ChatMessage;
import org.example.resumepro.entity.ResumeHistory;
import org.example.resumepro.repository.ResumeRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatClient chatClient;
    private final ResumeRepository resumeRepository;

    @MessageMapping("/chat/{historyId}")
    @SendTo("/topic/messages/{historyId}")
    public ChatMessage handleChat(@DestinationVariable Long historyId, String userMessage) {
        //1. 기존 이력서 분석 정보 조회
        ResumeHistory history = resumeRepository.findById(historyId).orElseThrow();

        //2. AI에게 이전 분석 맥락을 포함하여 질문
        String aiPrompt = String.format(
                "너는 이력서 분석 전문가야. 다음 이력서 분석 결과에 대해 사용자와 대화해줘.\n" +
                        "이력서 원문: %s\n기존 분석 내용: %s\n사용자 질문: %s",
                history.getUserResume(), history.getAiResponse(), userMessage
        );

        String aiResponse = chatClient.prompt().user(aiPrompt).call().content();

        return new ChatMessage("AI", aiResponse);
    }

}
