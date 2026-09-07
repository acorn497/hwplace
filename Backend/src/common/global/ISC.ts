/**
 * _XXX
 * 0: ETC ...
 * A: AUTH
 * B: 
 * C: PIXEL
 * D: 
 * E: VALIDATION
 * F: SERVER
 */

// Internal Status Code
export const ISC = {
  SUCCESS: '0000',

  AUTH: {
    EMAIL_CONFLICT: 'A100',

    INVALID_CREDENTIALS: 'A110',

    /** 토큰은 유효하지만 그 유저가 더 이상 존재하지 않는다 (탈퇴/DB 초기화) */
    USER_NOT_FOUND: 'A120',
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
  }
} 