/**
 * _XXX
 * 0: ETC ...
 * A: AUTH
 * B: 
 * C: PIXEL
 * D: 
 * E: VALIDATION
 * F: SERVER
 * G: ADMIN
 * H: API TOKEN
 */

// Internal Status Code
export const ISC = {
  SUCCESS: '0000',

  AUTH: {
    EMAIL_CONFLICT: 'A100',

    INVALID_CREDENTIALS: 'A110',

    /** 토큰은 유효하지만 그 유저가 더 이상 존재하지 않는다 (탈퇴/DB 초기화) */
    USER_NOT_FOUND: 'A120',

    /** 제재된 계정이라 쓰기 동작이 거부되었다 */
    RESTRICTED: 'A130',

    /** 관리자 권한이 필요한 요청을 일반 유저가 보냈다 */
    FORBIDDEN: 'A140',

    /** 자동 남용 탐지로 제재되었다 */
    AUTO_RESTRICTED: 'A150',
  },

  VALIDATION: {
    EMAIL_EMPTY: 'E100',
    EMAIL_INVALID: 'E101',
    EMAIL_TOO_LONG: 'E102',

    PASS_EMPTY: 'E110',
    PASS_TOO_SHORT: 'E111',
    PASS_TOO_LONG: 'E112',
  },

  SERVER: {
    FOLLOW_STATUS: 'F400', // HTTP 상태 코드에 맞춰 처리

    UNKNOWN_ERROR: 'F900', // = Internal Server Error
  },

  PIXEL: {
    FOUND_DATA: 'C100',
    NO_DATA: 'C101',

    /** 칠하기 쿼터를 모두 사용했다 */
    QUOTA_EXCEEDED: 'C110',

    /** 한 요청에 담을 수 있는 픽셀 수를 넘었다 */
    TOO_MANY_PIXELS: 'C111',

    /** 요청 빈도 제한(IP 기준)에 걸렸다 */
    RATE_LIMITED: 'C112',
  },

  TOKEN: {
    /** 토큰 개수 상한 초과 */
    LIMIT_EXCEEDED: 'H100',

    /** 토큰을 찾을 수 없음 */
    NOT_FOUND: 'H110',

    /** 유효하지 않은 API 토큰 */
    INVALID: 'H120',
  },

  ADMIN: {
    /** 대상 유저를 찾을 수 없다 */
    TARGET_NOT_FOUND: 'G100',

    /** 자기 자신에게는 할 수 없는 동작이다 (자기 제재/강등 등) */
    SELF_TARGET: 'G110',

    /** 요청한 좌표 범위가 캔버스를 벗어났거나 뒤집혀 있다 */
    INVALID_AREA: 'G120',
  },
} 