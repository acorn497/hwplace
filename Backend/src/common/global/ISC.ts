/**
 * _XXX
 * 0: ETC ...
 * A: AUTH
 * B: 
 * C: 
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
} 