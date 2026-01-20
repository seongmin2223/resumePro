package org.example.resumepro.controller;

import lombok.RequiredArgsConstructor;
import org.example.resumepro.dto.LoginRequest;
import org.example.resumepro.dto.SignupRequest;
import org.example.resumepro.entity.User;
import org.example.resumepro.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Controller
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    //회원가입
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@RequestBody SignupRequest signupRequest) {
        User user = User.builder()
                .email(signupRequest.getEmail())
                .password(signupRequest.getPassword())
                .nickname(signupRequest.getNickname())
                .build();
        authService.signup(user);
        return ResponseEntity.ok("회원가입 성공");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest loginRequest) {
        try {
            // 서비스에서 유저 정보를 가져오도록 수정
            User user = authService.getUserByEmail(loginRequest.getEmail());
            authService.login(loginRequest.getEmail(), loginRequest.getPassword());

            // 닉네임을 포함한 맵이나 객체를 반환
            Map<String, String> response = new HashMap<>();
            response.put("message", "로그인 성공");
            response.put("nickname", user.getNickname());
            response.put("email", user.getEmail());

            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }

    @DeleteMapping("/withdraw")
    public ResponseEntity<String> withdraw(@RequestParam("email") String email) {
        authService.withdraw(email);
        return ResponseEntity.ok("회원탈퇴가 완료되었습니다.");
    }

}
