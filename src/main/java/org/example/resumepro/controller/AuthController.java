package org.example.resumepro.controller;

import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.example.resumepro.dto.LoginRequest;
import org.example.resumepro.dto.SignupRequest;
import org.example.resumepro.entity.User;
import org.example.resumepro.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<String> signup(@RequestBody SignupRequest request) {
        User user = User.builder()
                .email(request.getEmail())
                .password(request.getPassword())
                .nickname(request.getNickname())
                .build();

        authService.signup(user);
        return ResponseEntity.ok("회원가입 성공");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody LoginRequest request,
            HttpSession session
    ) {
        User user = authService.login(request.getEmail(), request.getPassword());

        session.setAttribute("user", user);

        Map<String, String> response = new HashMap<>();
        response.put("message", "로그인 성공");
        response.put("email", user.getEmail());
        response.put("nickname", user.getNickname());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok("로그아웃 완료");
    }

    @DeleteMapping("/withdraw")
    public ResponseEntity<String> withdraw(
            @RequestParam String email,
            HttpSession session
    ) {
        authService.withdraw(email);
        session.invalidate();
        return ResponseEntity.ok("회원탈퇴 완료");
    }
}
