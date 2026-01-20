package org.example.resumepro.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email; // 로그인 아이디

    private String password; // 일반 로그인 비밀번호

    private String nickname;

    private String role; // "ROLE_USER" 형태로 저장

    private String provider; // "local" 또는 "kakao"

    private String providerId; // 카카오 고유 ID (카카오 로그인 시 사용)
}