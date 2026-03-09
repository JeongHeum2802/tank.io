/**
 * 리더보드 항목 정의
 * 상위 플레이어 목록에 표시될 각 요소의 스펙을 정의합니다.
 */
export interface LeaderboardEntry {
    sessionId: string;  // 각 접속자를 고유 식별하는 세션 ID (Colyseus 제공)
    nickname: string;   // 유저의 게임 닉네임
    level: number;      // 유저의 현재 레벨
    xp: number;         // 유저의 현재 경험치 양
}

/**
 * 플레이어 상태(스탯) 정의
 * 내 캐릭터의 전체 스탯 구조를 정의합니다. (UI 상태 표시용)
 */
export interface PlayerStats {
    level: number;          // 현재 레벨
    xp: number;             // 현재 레벨업 진행도(경험치)
    xpMax: number;          // 다음 레벨업에 필요한 최대 경험치
    damage: number;         // 현재 공격력
    attackSpeed: number;    // 현재 공격 간격(ms) (짧을수록 빠름)
    range: number;          // 총알 투사체 유지시간 또는 사거리 스펙
    hp: number;             // 현재 체력
    maxHp: number;          // 최대 체력
    levelUpsPending: number;// 사용하지 않고 적립된 레벨업 포인트
    magnetRadius: number;   // 자석 사거리 보너스 반경
    shotgunLevel: number;   // 샷건(다중 발사) 강화 레벨
    bulletSize: number;     // 총알 크기 스케일
}

/**
 * 레벨업 상태 모달을 위한 정의
 * 서버가 무작위로 추첨해준 3개의 스탯 선택지를 포함합니다.
 */
export interface LevelUpState {
    pending: number;        // 남은 레벨업 포인트
    choices: string[];      // 서버에서 전달받은 스탯 ID 3개 (예: ['damage', 'speed', 'bulletSize'])
    stats: {
        damage: number;
        attackSpeed: number;
        range: number;
        maxHp: number;
        speed: number;
        magnetRadius: number;
        shotgunLevel: number;
        bulletSize: number;
    };
}

/**
 * 각 스탯별 업그레이드 횟수를 추적하는 인터페이스
 * StatOverlay 컴포넌트에서 사용되며, 플레이어가 몇 번 어떤 스탯을 올렸는지 보여줍니다.
 */
export interface StatLevels {
    damage: number;
    attackSpeed: number;
    range: number;
    speed: number;
    maxHp: number;
    magnetRadius: number;
    shotgunLevel: number;
    bulletSize: number;
}
