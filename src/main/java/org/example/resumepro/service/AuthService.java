package org.example.resumepro.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.example.resumepro.entity.User;
import org.example.resumepro.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    //회원가입
    @Transactional
    public void signup(User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("이미 존재하는 이메일입니다");
        }
        user.setPassword(passwordEncoder.encode(user.getPassword()));// 비밀번호 암호화
        user.setRole("ROLE_USER");
        user.setProvider("local");
        userRepository.save(user);
    }

    //로그인 검증
    public boolean login(String email, String password) {
        // 이메일로 유저찾기 (없으면 탈퇴 or 가입한적 없는 계정)
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        // 비밀번호 체크
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("비밀번호가 일치하지 않습니다.");
        }

        return passwordEncoder.matches(password, user.getPassword());
    }

    //회원탈퇴
    @Transactional
    public void withdraw(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        userRepository.delete(user);
    }

    //유저 이메일가져오기
    @Transactional
    public User getUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
        return user;
    }
}
