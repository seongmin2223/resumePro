package org.example.resumepro.repository;

import org.example.resumepro.entity.ResumeHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ResumeRepository extends JpaRepository<ResumeHistory, Long> {
    // 최신순 정렬 조회 메서드
    List<ResumeHistory> findAllByOrderByCreatedAtDesc();
    // 특정 사용자의 이메일로 작성된 히스토리만 최신순으로 가져오기
    List<ResumeHistory> findByUserEmailOrderByCreatedAtDesc(String userEmail);}
