/**
 * 접속 클라이언트가 모바일 환경(스마트폰/태블릿)인지 파악하는 유틸리티 함수입니다.
 * User-Agent 파싱 및 터치 지원 여부를 통해 추정합니다.
 * @returns {boolean} 모바일 환경이면 true 반환
 */
export function isMobileDevice(): boolean {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || ('ontouchstart' in window) 
        || (navigator.maxTouchPoints > 0);
}
